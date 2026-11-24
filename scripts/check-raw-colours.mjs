// Fails `npm run verify` when app code gains a raw colour (#139 S7, the app-code half of #123).
//
// The Cornell design system is the only place a colour is written down: components use its tokens
// (`var(--color-ink)`), so they follow the theme and dark mode. This scans client/ (not design-system/, which has
// its own check.mjs) for `#hex`, `rgb()`/`rgba()` and `hsl()`/`hsla()`, outside comments and tests.
//
//   npm run check:colours                      fail on any colour not in the baseline
//   npm run check:colours -- --write-baseline  record today's colours (an app mid-port), then only shrink
//
// The baseline (scripts/raw-colours.baseline.json) is keyed by file and colour, with a count. A file may lose
// colours freely; any new one, or one more of an old one, fails. base-template's baseline is empty: it has none.
// Named colours (`white`, `red`) are not checked; they are rare in code and common in prose.
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const BASELINE = 'scripts/raw-colours.baseline.json';
const ROOTS = ['client'];
const SKIP_DIRS = new Set(['node_modules', 'assets', 'test-support']);

/** Source with comments blanked out, so `#139` in a comment is not a colour. Line numbers are kept. */
export function stripComments(src, isTs) {
  const blank = (m) => m.replace(/[^\n]/g, ' ');
  let out = src.replace(/\/\*[\s\S]*?\*\//g, blank);
  if (isTs) out = out.replace(/(^|[^:'"`\w\\])\/\/[^\n]*/g, (m, lead) => lead + blank(m.slice(lead.length)));
  return out.replace(/<!--[\s\S]*?-->/g, blank);
}

const HEX = /(?<![\w&#])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])/g;
const FUNC = /(?<![\w-])(?:rgba?|hsla?)\(/gi;

/** Every raw colour in `src`: `{ token, line }`, the token lower-cased (`#b31b1b`, `rgb(`). */
export function findColours(src, isTs) {
  const text = stripComments(src, isTs).replace(/&#\d+;/g, (m) => ' '.repeat(m.length)); // HTML entities like &#64;
  const lineOf = (i) => text.slice(0, i).split('\n').length;
  const found = [];
  for (const re of [HEX, FUNC]) for (const m of text.matchAll(re)) found.push({ at: m.index, token: m[0].toLowerCase() });
  return found.sort((a, b) => a.at - b.at).map(({ at, token }) => ({ token, line: lineOf(at) }));
}

/** `{ file: { token: count } }` for a list of `[file, findings]`, dropping files with none. */
export function tally(entries) {
  const out = {};
  for (const [file, found] of entries) {
    if (!found.length) continue;
    const counts = {};
    for (const { token } of found) counts[token] = (counts[token] ?? 0) + 1;
    out[file] = Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
  }
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
}

/** What `current` has beyond `baseline`: `[{ file, token, extra }]`. Fewer than the baseline is fine. */
export function overBaseline(current, baseline) {
  const over = [];
  for (const [file, counts] of Object.entries(current)) {
    for (const [token, n] of Object.entries(counts)) {
      const allowed = baseline[file]?.[token] ?? 0;
      if (n > allowed) over.push({ file, token, extra: n - allowed });
    }
  }
  return over;
}

function walk(dir, root, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (!SKIP_DIRS.has(name)) walk(p, root, acc);
    } else if (/\.(ts|css|html)$/.test(name) && !/\.(test|spec)\.ts$/.test(name) && name !== 'theme.css') {
      acc.push(relative(root, p).split(sep).join('/'));
    }
  }
  return acc;
}

/** Scans `root` and compares with its baseline. Returns `{ code, lines, current }`. */
export function checkRawColours(root, { writeBaseline = false } = {}) {
  const files = ROOTS.flatMap((r) => walk(join(root, r), root)).sort();
  const scanned = files.map((f) => [f, findColours(readFileSync(join(root, f), 'utf8'), f.endsWith('.ts'))]);
  const current = tally(scanned);
  const path = join(root, BASELINE);
  if (writeBaseline) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify(current, null, 2)}\n`);
    const n = Object.values(current).reduce((s, c) => s + Object.values(c).reduce((a, b) => a + b, 0), 0);
    return { code: 0, lines: [`[colours] wrote ${BASELINE}: ${n} raw colour(s) in ${Object.keys(current).length} file(s)`], current };
  }
  const baseline = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};
  const over = overBaseline(current, baseline);
  if (!over.length) {
    const left = Object.values(current).reduce((s, c) => s + Object.values(c).reduce((a, b) => a + b, 0), 0);
    return { code: 0, lines: [`[colours] ok: ${left} raw colour(s) in client/, none new`], current };
  }
  const where = new Map(scanned);
  const lines = ['[colours] FAIL: raw colours in app code. Use a design-system token (var(--color-…)) instead:'];
  for (const { file, token } of over) {
    const at = where.get(file).filter((f) => f.token === token).map((f) => f.line);
    lines.push(`  ${file}:${at.join(',')}  ${token}`);
  }
  lines.push(
    'Map each to the token for its role (cornell-components; design-system-port § Step 3). Canvas or diagram',
    'colours: name the token and resolve it with shared/services/theme/css-colors.ts.',
  );
  return { code: 1, lines, current };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { code, lines } = checkRawColours(process.cwd(), { writeBaseline: process.argv.includes('--write-baseline') });
  (code ? console.error : console.log)(lines.join('\n'));
  process.exit(code);
}
