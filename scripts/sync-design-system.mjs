// Re-syncs the vendored Cornell design system from cu-aaii/cornell-design-system (#139).
//
//   npm run sync:design-system                      # upstream main
//   npm run sync:design-system -- --ref <sha|branch|tag>
//   npm run sync:design-system -- --source ../cornell-design-system   # a local checkout, no download
//
// It replaces design-system/ and .claude/skills/cornell-*/ with the upstream files at that ref, rebuilds
// design-system/COMPONENTS.md for this app, and rewrites design-system.lock.json. It touches no other path.
// The repo is private, so a download needs GITHUB_TOKEN or a signed-in `gh` (only here: verify, Docker
// and CodePipeline never fetch). Commit the result as one PR, with the upstream log it prints in the body.
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { LOCK_FILE, hashTree, listFiles, mapPath, ownedRoots } from './design-system-lock.mjs';

const REPO = 'cu-aaii/cornell-design-system';
const root = process.cwd();

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}

function token() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  try {
    return execFileSync('gh', ['auth', 'token'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    throw new Error('No GitHub credential: set GITHUB_TOKEN or sign in with `gh auth login` (the source repo is private).');
  }
}

async function gh(path, accept, tok) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: { Authorization: `Bearer ${tok}`, Accept: accept, 'X-GitHub-Api-Version': '2022-11-28' },
  });
  if (!res.ok) throw new Error(`GitHub ${path}: ${res.status} ${res.statusText}`);
  return res;
}

/** Downloads and unpacks the repo at `ref`; returns { dir, sha }. */
async function download(ref, tok) {
  const sha = (await (await gh(`/repos/${REPO}/commits/${encodeURIComponent(ref)}`, 'application/vnd.github.sha', tok)).text()).trim();
  const tmp = mkdtempSync(join(tmpdir(), 'cds-sync-'));
  const tgz = join(tmp, 'src.tgz');
  writeFileSync(tgz, Buffer.from(await (await gh(`/repos/${REPO}/tarball/${sha}`, 'application/vnd.github+json', tok)).arrayBuffer()));
  execFileSync('tar', ['-xzf', tgz, '-C', tmp]);
  const top = readdirSync(tmp).find((n) => n !== 'src.tgz');
  return { dir: join(tmp, top), sha, tmp };
}

function localSha(dir) {
  try {
    return execFileSync('git', ['-C', dir, 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return 'local';
  }
}

async function main() {
  const ref = arg('ref') ?? 'main';
  const source = arg('source');
  const old = existsSync(join(root, LOCK_FILE)) ? JSON.parse(readFileSync(join(root, LOCK_FILE), 'utf8')) : null;

  let src;
  let sha;
  let tmp;
  let tok;
  if (source) {
    src = source;
    sha = localSha(source);
  } else {
    tok = token();
    ({ dir: src, sha, tmp } = await download(ref, tok));
  }

  const upstream = listFiles(src).filter((p) => mapPath(p));
  if (!upstream.some((p) => p.startsWith('design-system/'))) throw new Error(`${src} has no design-system/ folder`);

  for (const r of ownedRoots(root)) rmSync(join(root, r), { recursive: true, force: true });
  for (const p of upstream) {
    const to = join(root, mapPath(p));
    mkdirSync(dirname(to), { recursive: true });
    cpSync(join(src, p), to);
  }
  if (tmp) rmSync(tmp, { recursive: true, force: true });

  // COMPONENTS.md lists this app's uses of each block, so it is rebuilt here, not copied (see APP_GENERATED).
  execFileSync(process.execPath, ['design-system/tools/inventory.mjs'], { cwd: root, stdio: 'inherit' });

  const lock = { repo: REPO, ref, sha, files: hashTree(root) };
  writeFileSync(join(root, LOCK_FILE), `${JSON.stringify(lock, null, 2)}\n`);
  console.log(`[design-system] synced ${Object.keys(lock.files).length} files from ${REPO}@${sha.slice(0, 7)} (${ref})`);

  if (old && old.sha !== sha && tok) {
    try {
      const cmp = await (await gh(`/repos/${REPO}/compare/${old.sha}...${sha}`, 'application/vnd.github+json', tok)).json();
      console.log(`\nUpstream changes ${old.sha.slice(0, 7)}..${sha.slice(0, 7)} (paste into the PR body):`);
      for (const c of cmp.commits) console.log(`- ${c.sha.slice(0, 7)} ${c.commit.message.split('\n')[0]}`);
    } catch (e) {
      console.log(`(could not list upstream changes: ${e.message})`);
    }
  }
}

main().catch((e) => {
  console.error(`[design-system] sync failed: ${e.message}`);
  process.exit(1);
});
