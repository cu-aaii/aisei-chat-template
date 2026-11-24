#!/usr/bin/env node
// Design-system checker. Zero dependencies. Run:  node tools/check.mjs            (report + exit code)
//                                                 node tools/check.mjs --table    (print every contrast ratio)
//                                                 node tools/check.mjs --manifest (also write showcase/manifest.js)
//
// What it enforces (the rules that keep the system modular and accessible):
//  1. CONTRAST   every `@pair fg bg text|large|ui` annotation passes WCAG 2.2 AA in EVERY theme and
//                EVERY colour mode (text 4.5:1, large 3:1, ui 3:1). A pair in tokens/semantic.css is
//                checked everywhere; a pair inside themes/x.css only in theme x.
//  2. TOKENS     colour tokens hold a hex, a var() alias, or light-dark(a, b) of those; non-hex colour
//                functions are allowed only in --shadow-* tokens and the composed photo scrim (--header-scrim).
//  3b. BRAND     a pair may not use a graphic-only accent as text colour or a large-text-only accent as body text.
//  3. LOGO       --seal-color and --wordmark-color resolve to carnelian, black or white only (brand rule), everywhere.
//  4. BLOCKS     base/ and blocks/ never use a raw colour, light-dark() (mode differences belong in
//                tokens), `!important`, an #id selector or an undefined var(); z-index uses a token;
//                @media uses only the six breakpoints.
//  5. THEMES     every token a theme overrides exists in the default theme.
//  6. COMMENTS   a browser ends a comment at the first closing marker; a stray nested one corrupts the
//                next rule silently, so nested openers and unbalanced markers are errors.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname, basename } from 'node:path';
import { stalePages } from './build-pages.mjs';
import { staleInventory } from './inventory.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const THRESHOLDS = { text: 4.5, large: 3, ui: 3 };
const MODES = ['light', 'dark'];
const BREAKPOINTS = new Set(['480px', '600px', '768px', '960px', '1024px', '1200px', '1440px']);
// max-width queries are the min breakpoint minus one pixel, so the two ranges never overlap
const MAX_ALLOWED = new Set(['479px', '767px', '959px', '1023px', '1199px', '1439px']);
const LOGO_COLOURS = new Set(['#ffffff', '#b31b1b', '#000000']); // Cornell: carnelian, black or white only
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const list = (d) => readdirSync(join(ROOT, d)).filter((f) => f.endsWith('.css')).sort();

// ---------- colour maths (WCAG 2.x) ----------
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
function rgb(hex) {
  let h = hex.slice(1);
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}
const lum = (hex) => {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
const fmt = (n) => (Math.floor(n * 100) / 100).toFixed(2); // truncated, never rounded up

// ---------- parsing ----------
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');
/** Every innermost `selector { body }` — enough for these flat token files. */
function rules(css) {
  const out = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(strip(css)))) out.push({ selector: m[1].trim(), body: m[2] });
  return out;
}
function decls(body) {
  const out = {};
  for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}
const themeOf = (sel) => {
  const names = [...sel.matchAll(/\[data-theme=['"]?([\w-]+)['"]?\]/g)].map((m) => m[1]);
  if (/(^|,)\s*:root\b/.test(sel)) names.push('cornell');
  return names;
};
const pairs = (css) =>
  [...css.matchAll(/\/\*\s*@pair\s+(\S+)\s+(\S+)\s+(text|large|ui)\s*\*\//g)].map((m) => ({
    fg: m[1],
    bg: m[2],
    kind: m[3],
  }));
/** Split "a, b" at the top level only (so var(--x, y) and rgb() keep their commas). */
function splitTop(s) {
  const out = [];
  let depth = 0, cur = '';
  for (const ch of s) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}
const LD = /^light-dark\(([\s\S]*)\)$/;

// ---------- load tokens ----------
const errors = [];
const base = {}; // :root tokens from primitives + semantic + scale (cornell)
const overrides = {}; // theme -> its own overrides
const themePairs = {}; // theme -> theme-only pairs
const allPairs = []; // checked in every theme
const themeFiles = list('themes');
const themes = ['cornell', ...themeFiles.map((f) => basename(f, '.css'))];

for (const f of ['primitives.css', 'semantic.css', 'scale.css']) {
  const css = read(`tokens/${f}`);
  for (const r of rules(css)) if (themeOf(r.selector).includes('cornell')) Object.assign(base, decls(r.body));
  if (f === 'semantic.css') allPairs.push(...pairs(css));
}
for (const f of themeFiles) {
  const name = basename(f, '.css');
  const css = read(`themes/${f}`);
  overrides[name] = {};
  for (const r of rules(css)) if (themeOf(r.selector).includes(name)) Object.assign(overrides[name], decls(r.body));
  themePairs[name] = pairs(css);
}
// the mode switches themselves
const sem = strip(read('tokens/semantic.css'));
if (!/color-scheme:\s*light dark/.test(sem)) errors.push('tokens/semantic.css: :root must set color-scheme: light dark (follow the OS by default)');
for (const m of MODES)
  if (!new RegExp(`\\[data-mode=['"]?${m}['"]?\\]\\s*\\{[^}]*color-scheme:\\s*${m}`).test(sem))
    errors.push(`tokens/semantic.css: missing the [data-mode='${m}'] rule that sets color-scheme: ${m}`);

/** Resolve a token to a hex for a theme + mode, following var() aliases and light-dark(). */
function resolveValue(v, theme, mode, seen) {
  v = v.trim();
  if (HEX.test(v)) return v.toLowerCase();
  const ld = v.match(LD);
  if (ld) {
    const parts = splitTop(ld[1]);
    if (parts.length !== 2) throw new Error(`light-dark() needs two values: ${v}`);
    return resolveValue(parts[mode === 'light' ? 0 : 1], theme, mode, seen);
  }
  const m = v.match(/^var\(\s*(--[\w-]+)\s*\)$/);
  if (m) return resolve(m[1], theme, mode, seen);
  throw new Error(`not a hex, alias or light-dark(): ${v}`);
}
function resolve(token, theme, mode, seen = new Set()) {
  if (seen.has(token)) throw new Error(`alias cycle at ${token}`);
  seen.add(token);
  const v = (overrides[theme] && overrides[theme][token]) ?? base[token];
  if (v === undefined) throw new Error(`undefined token ${token} in theme ${theme}`);
  return resolveValue(v, theme, mode, seen);
}

// ---------- rule 6: comments ----------
for (const dir of ['tokens', 'themes', 'base', 'blocks']) {
  for (const f of list(dir)) {
    const raw = read(`${dir}/${f}`);
    for (const m of raw.matchAll(/\/\*([\s\S]*?)\*\//g)) {
      if (m[1].includes('/*')) {
        const line = raw.slice(0, m.index).split('\n').length;
        errors.push(`${dir}/${f}:${line}: a comment contains an opening marker - the browser ends it at the first closing marker, and the leftover text corrupts the next rule`);
      }
    }
    const open = (raw.match(/\/\*/g) || []).length;
    const close = (raw.match(/\*\//g) || []).length;
    if (open !== close) errors.push(`${dir}/${f}: ${open} comment openers but ${close} closers`);
  }
}

// ---------- rule 2/5: token values ----------
const colourish = /#|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color-mix|light-dark)\s*\(/i;
const scan = [];
for (const [k, v] of Object.entries(base)) scan.push(['default', k, v]);
for (const [t, o] of Object.entries(overrides))
  for (const [k, v] of Object.entries(o)) {
    scan.push([t, k, v]);
    if (!(k in base)) errors.push(`themes/${t}.css: overrides ${k}, which the default theme does not define`);
  }
for (const [where, k, v] of scan) {
  if (k === '--header-scrim' || k.startsWith('--overlay-') || k.startsWith('--shadow-') || !colourish.test(v)) continue;
  const ld = v.match(LD);
  const parts = ld ? splitTop(ld[1]) : [v];
  for (const p of parts)
    if (!(HEX.test(p) || /^var\(\s*--[\w-]+\s*\)$/.test(p)))
      errors.push(`${where} ${k}: a colour token must be a hex, a var() alias, or light-dark() of those; got "${p}"`);
}

// ---------- rule 1/3: contrast and logo, per theme x mode ----------
const rows = [];
for (const theme of themes)
  for (const mode of MODES) {
    for (const p of [...allPairs, ...(themePairs[theme] || [])]) {
      try {
        const fg = resolve(p.fg, theme, mode);
        const bg = resolve(p.bg, theme, mode);
        const r = ratio(fg, bg);
        rows.push({ theme, mode, ...p, fgHex: fg, bgHex: bg, min: THRESHOLDS[p.kind], ratio: r, pass: r >= THRESHOLDS[p.kind] });
      } catch (e) {
        errors.push(`pair ${p.fg} / ${p.bg} (${theme}/${mode}): ${e.message}`);
      }
    }
    for (const tok of ['--seal-color', '--wordmark-color']) {
      try {
        const c = resolve(tok, theme, mode);
        if (!LOGO_COLOURS.has(c)) errors.push(`logo ${theme}/${mode}: ${tok} is ${c}; Cornell allows only carnelian, black or white`);
      } catch (e) {
        errors.push(`logo ${theme}/${mode}: ${e.message}`);
      }
    }
  }
for (const r of rows.filter((r) => !r.pass))
  errors.push(`contrast ${r.theme}/${r.mode}: ${r.fg} on ${r.bg} is ${fmt(r.ratio)}:1, needs ${r.min}:1 (${r.kind})  [${r.fgHex} on ${r.bgHex}]`);

// ---------- rule 3b: brand colour-use limits ----------
// Hex values from the brand book that may not be the colour of text (graphic elements only), or only of large text.
const GRAPHIC_ONLY = new Set(['#6eb43f', '#f8981d', '#ef4035']);
const LARGE_ONLY = new Set(['#578e32', '#d47500']);
for (const r of rows) {
  if (r.kind !== 'ui' && GRAPHIC_ONLY.has(r.fgHex.toLowerCase()))
    errors.push(`brand ${r.theme}/${r.mode}: ${r.fg} (${r.fgHex}) is graphic-elements-only and may not colour text`);
  if (r.kind === 'text' && LARGE_ONLY.has(r.fgHex.toLowerCase()))
    errors.push(`brand ${r.theme}/${r.mode}: ${r.fg} (${r.fgHex}) is large-text-only but is paired as ordinary text`);
}

// ---------- rule 4: base/ and blocks/ ----------
const defined = new Set([...Object.keys(base), ...Object.values(overrides).flatMap((o) => Object.keys(o))]);
const stats = [];
for (const dir of ['base', 'blocks']) {
  for (const f of list(dir)) {
    const raw = read(`${dir}/${f}`);
    const css = strip(raw);
    const where = `${dir}/${f}`;
    const local = new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
    css.split('\n').forEach((line, i) => {
      const at = `${where}:${i + 1}`;
      const noUrl = line.replace(/url\([^)]*\)/g, '');
      if (/:\s*[^;]*#[0-9a-f]{3,8}\b/i.test(noUrl)) errors.push(`${at}: raw hex colour (use a token)`);
      if (/\b(?:rgba?|hsla?)\(/i.test(noUrl)) errors.push(`${at}: raw rgb()/hsl() colour (use a token)`);
      if (/light-dark\(/.test(noUrl)) errors.push(`${at}: light-dark() belongs in a token, not a block (so every block follows the mode automatically)`);
      if (/!important/.test(line)) errors.push(`${at}: !important`);
      if (/^[^{}:;]*#[a-z][\w-]*[^;{}]*\{/i.test(line) || /^\s*#[a-z][\w-]*\s*[,{]/i.test(line)) errors.push(`${at}: #id selector`);
      if (/z-index\s*:\s*(?!var\()\S/.test(line)) errors.push(`${at}: z-index must use a --z-* token`);
      for (const m of line.matchAll(/@media[^{]*/g))
        for (const w of m[0].matchAll(/\(\s*(min|max)-width\s*:\s*([\d.]+px)\s*\)/g))
          if (!(w[1] === 'min' ? BREAKPOINTS : MAX_ALLOWED).has(w[2]))
            errors.push(`${at}: ${w[1]}-width ${w[2]} is not one of ${[...(w[1] === 'min' ? BREAKPOINTS : MAX_ALLOWED)].join(', ')}`);
      // var(--x, fallback) is an optional knob an author may set (e.g. --grid-gap); it needs no definition
      for (const m of line.matchAll(/var\(\s*(--[\w-]+)\s*(,?)/g))
        if (!m[2] && !defined.has(m[1]) && !local.has(m[1])) errors.push(`${at}: var(${m[1]}) is not defined anywhere`);
    });
    stats.push({ file: where, lines: raw.split('\n').length, bytes: Buffer.byteLength(raw) });
  }
}

// ---------- rule 7: the two demo pages are what their shared parts build ----------
// showcase/public.html (home page) and page.html (content page) are built by tools/build-pages.mjs from showcase/_pages and
// showcase/_parts, so the header, the footer and every content element exist once. A page edited by hand, or a part changed without a
// rebuild, fails here.
{
  const stale = stalePages();
  if (stale.length) errors.push(`showcase/${stale.join(', showcase/')}: not what showcase/_pages and _parts build - run node design-system/tools/build-pages.mjs`);
}

// ---------- rule 8: the component inventory is what the files say ----------
// COMPONENTS.md is built by tools/inventory.mjs from blocks/, showcase/, showcase.js and client/app. A block added or renamed
// without a rebuild fails here, so the inventory an agent reads is never stale.
{
  const stale = staleInventory();
  if (stale.length) errors.push(`${stale.join(', ')}: out of date - run node design-system/tools/inventory.mjs`);
}

// ---------- report ----------
const passed = rows.filter((r) => r.pass).length;
console.log(`Themes: ${themes.join(', ')}   Modes: ${MODES.join(', ')}   (${themes.length * MODES.length} combinations)`);
console.log(`Contrast pairs: ${passed}/${rows.length} pass`);
if (process.argv.includes('--table')) {
  for (const r of rows) console.log(`${r.theme.padEnd(8)} ${r.mode.padEnd(5)} ${r.fg.padEnd(26)} ${r.bg.padEnd(26)} ${r.kind.padEnd(5)} ${String(r.min).padEnd(4)} ${fmt(r.ratio).padStart(6)} ${r.pass ? 'pass' : 'FAIL'}`);
}
console.log(`Files checked: ${stats.length} (${stats.reduce((n, s) => n + s.lines, 0)} lines)`);
if (errors.length) {
  console.log(`\n${errors.length} problem(s):`);
  for (const e of errors) console.log(`  - ${e}`);
}

if (process.argv.includes('--manifest')) {
  const colours = {};
  for (const t of themes) {
    colours[t] = {};
    for (const m of MODES) {
      colours[t][m] = {};
      for (const k of Object.keys(base)) {
        try { colours[t][m][k] = resolve(k, t, m); } catch { /* non-colour token */ }
      }
    }
  }
  const manifest = {
    themes,
    modes: MODES,
    pairs: rows.map(({ theme, mode, fg, bg, kind, min, ratio: r, pass, fgHex, bgHex }) => ({ theme, mode, fg, bg, kind, min, ratio: Math.floor(r * 100) / 100, pass, fgHex, bgHex })),
    colours,
    files: stats,
  };
  writeFileSync(join(ROOT, 'showcase/manifest.js'), `// Generated by tools/check.mjs --manifest. Do not edit.\nwindow.CU_MANIFEST = ${JSON.stringify(manifest, null, 1)};\n`);
  console.log('Wrote showcase/manifest.js');
}
process.exit(errors.length ? 1 : 0);
