// Fails `npm run verify` when the vendored design system differs from design-system.lock.json (#139).
// Offline: it only reads files. Skipped when there is no lock, the same bootstrap rule as check-changelog.mjs.
//
// A failure means someone edited design-system/ or a .claude/skills/cornell-* skill in this repo. Don't fix it
// here: fix it in cu-aaii/cornell-design-system and run `npm run sync:design-system -- --ref <sha>`.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOCK_FILE, diffLock, hashTree } from './design-system-lock.mjs';

/** Exit code and report lines for `root`. Exported for the unit test. */
export function checkDesignSystem(root) {
  const lockPath = join(root, LOCK_FILE);
  if (!existsSync(lockPath)) return { code: 0, lines: [`[design-system] skipped: no ${LOCK_FILE}`] };
  const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
  const { missing, extra, changed, ok } = diffLock(lock.files ?? {}, hashTree(root));
  if (ok) {
    const n = Object.keys(lock.files).length;
    return { code: 0, lines: [`[design-system] ok: ${n} files match ${lock.repo}@${lock.sha.slice(0, 7)}`] };
  }
  const lines = [`[design-system] FAIL: the synced copy differs from ${LOCK_FILE} (${lock.repo}@${lock.sha.slice(0, 7)}).`];
  for (const p of changed) lines.push(`  changed  ${p}`);
  for (const p of missing) lines.push(`  missing  ${p}`);
  for (const p of extra) lines.push(`  extra    ${p}`);
  lines.push(
    'These files are a pinned copy of cu-aaii/cornell-design-system. Fix them upstream, then',
    'run `npm run sync:design-system -- --ref <sha>`. App styles belong outside design-system/.',
  );
  return { code: 1, lines };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { code, lines } = checkDesignSystem(process.cwd());
  (code ? console.error : console.log)(lines.join('\n'));
  process.exit(code);
}
