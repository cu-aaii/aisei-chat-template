// Shared by scripts/sync-design-system.mjs and scripts/check-design-system.mjs (#139).
//
// The Cornell design system (cu-aaii/cornell-design-system) is vendored here as a byte-identical, pinned copy.
// design-system.lock.json records the source commit and a sha256 for every synced file, so `npm run verify`
// can prove offline that nobody edited the copy. Fix the design system upstream, then re-sync.
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

export const LOCK_FILE = 'design-system.lock.json';

/**
 * Where each upstream path lands in this repo. Only these roots are ever written or hashed; a sync never
 * touches anything else. The skills are matched by prefix so a new upstream `cornell-*` skill arrives on
 * the next sync with no change here.
 */
export const MAPPINGS = [
  { from: 'design-system', to: 'design-system' },
  { from: 'agent-skills', to: '.claude/skills', prefix: 'cornell-' },
];

/**
 * Files inside a synced root that differ per app by design, so they are not hashed. COMPONENTS.md lists
 * which of *this app's* Angular files use each block (design-system/tools/inventory.mjs reads ../client/app),
 * so it is rebuilt here after every sync and committed. Upstream Q-I1 asks to move it out of the folder.
 */
export const APP_GENERATED = ['design-system/COMPONENTS.md'];

export const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

const posix = (p) => p.split(sep).join('/');

/** Every file under `dir`, as posix paths relative to `base`, sorted. A missing dir is an empty list. */
export function listFiles(dir, base = dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...listFiles(p, base));
    else out.push(posix(relative(base, p)));
  }
  return out.sort();
}

/** The repo-relative roots the mappings own, given the skill folder names that exist under `skillsDir`. */
export function ownedRoots(root) {
  const roots = [];
  for (const m of MAPPINGS) {
    if (!m.prefix) {
      roots.push(m.to);
      continue;
    }
    const dir = join(root, m.to);
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir).sort()) {
      if (name.startsWith(m.prefix) && statSync(join(dir, name)).isDirectory()) roots.push(`${m.to}/${name}`);
    }
  }
  return roots;
}

/** `{ path: sha256 }` for every synced file under `root`, excluding the app-generated ones. */
export function hashTree(root) {
  const files = {};
  for (const r of ownedRoots(root)) {
    for (const f of listFiles(join(root, r))) {
      const path = `${r}/${f}`;
      if (APP_GENERATED.includes(path)) continue;
      files[path] = sha256(readFileSync(join(root, path)));
    }
  }
  return Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b)));
}

/**
 * Compares the lock's hashes with the files on disk. Pure: both arguments are `{ path: sha256 }`.
 * `missing` are in the lock but not on disk, `extra` on disk but not in the lock, `changed` differ.
 */
export function diffLock(locked, actual) {
  const missing = Object.keys(locked).filter((p) => !(p in actual));
  const extra = Object.keys(actual).filter((p) => !(p in locked));
  const changed = Object.keys(locked).filter((p) => p in actual && locked[p] !== actual[p]);
  return { missing, extra, changed, ok: !missing.length && !extra.length && !changed.length };
}

/** Upstream path → repo path, or null when no mapping owns it (the path is not synced). */
export function mapPath(upstream) {
  for (const m of MAPPINGS) {
    if (!upstream.startsWith(`${m.from}/`)) continue;
    const rest = upstream.slice(m.from.length + 1);
    if (m.prefix && !rest.startsWith(m.prefix)) return null;
    return `${m.to}/${rest}`;
  }
  return null;
}
