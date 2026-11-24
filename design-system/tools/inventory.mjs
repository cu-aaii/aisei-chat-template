/* Builds COMPONENTS.md, the inventory of every block in the system, from the files themselves, so it cannot drift:
     blocks/*.css       what each block is (the first sentence of its header comment) and its classes
     showcase/*.html    which pages show it
     showcase/showcase.js   which reference behaviours exist (the init* functions and the line of comment above them)
     ../client/app      which Angular components use it
   The built file is committed; check.mjs fails when it is out of date. Run:
     node design-system/tools/inventory.mjs            writes COMPONENTS.md
     node design-system/tools/inventory.mjs --check    exits 1 when COMPONENTS.md is not what the files say (no writes) */
import { readFileSync, readdirSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DS = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(DS, 'COMPONENTS.md');
const read = (p) => readFileSync(p, 'utf8');
const list = (dir, ext) => readdirSync(dir).filter((f) => f.endsWith(ext)).sort();

function walk(dir, ext, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, ext, acc);
    else if (f.endsWith(ext) && !f.endsWith('.test.ts')) acc.push(p);
  }
  return acc;
}

/** The first sentence of a block's header comment, without the "Block —" lead, short enough for a table cell. */
function summary(css) {
  const m = css.match(/^\/\*\s*(?:Blocks?)\s*[—:-]\s*([\s\S]*?)\*\//);
  if (!m) return '';
  let text = m[1].replace(/\s+/g, ' ').trim();
  const dot = text.search(/\.(\s|$)/);
  if (dot > 0) text = text.slice(0, dot);
  const colon = text.indexOf(': ');
  if (colon >= 20) text = text.slice(0, colon);
  if ((text.match(/\(/g) || []).length > (text.match(/\)/g) || []).length) text += ')';
  if (text.length > 150) text = text.slice(0, 147).replace(/\s\S*$/, '') + '...';
  return text.replace(/[|]/g, '/').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Every block name (the cu-name before any __part or --modifier) in a block file, with how often it is used there. */
function rootCounts(css) {
  const body = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const n = {};
  for (const m of body.matchAll(/\.(cu-[a-z0-9]+(?:-[a-z0-9]+)*)(?:__|--|(?![\w-]))/g)) n[m[1]] = (n[m[1]] || 0) + 1;
  return n;
}

/** One line for each reference behaviour in showcase.js. A new init function without a line here fails the build, so none goes undocumented. */
const BEHAVIOURS = {
  initNav: 'Menus and megamenus: disclosure buttons (aria-expanded) with the CDS arrow-key model, Escape closes and returns focus, focus-out closes.',
  initNavToggle: 'The phone menu button: opens the full-screen menu, Escape closes it and returns focus to the button.',
  initExpandAll: 'Expand all / Close all above an accordion set of two or more; added by script so there is no dead button without it.',
  initTooltip: 'Tooltip: hover 150ms or focus opens, hoverable, Escape dismisses from anywhere, aria-describedby on the trigger.',
  initHoverTabs: 'Hover tabs: labels are buttons (aria-expanded, aria-controls); a hidden panel is visibility:hidden so keyboard users never tab into it.',
  initBackToTop: 'Back to top: appears 800px down, moves focus to the target first, then scrolls (smoothly unless reduced motion).',
  initSlider: 'Image slider: persistent captions, focus on a caption shows its slide, Previous / Next / Pause / Play, pips with arrow keys, autoplay never with reduced motion; a slide may hold a video with its own button.',
  initBackdropVideo: 'A backdrop that holds a video: Pause / Play button, never starts with reduced motion, still picture without script.',
  initCardSlider: 'Card slider: native scroll with snap points, Previous / Next / pips added by script, aria-disabled at the ends.',
  initMotion: 'Reveal and parallax: once per element, shown at once for reduced motion and in print, focus inside reveals.',
  initModeSwitch: 'Automatic / Light / Dark: sets data-mode on html and remembers it (key cu-mode).',
  initApp: 'App shell: the side menu hides from 960px (remembered) and is a modal panel below it (focus to Close, Tab wraps, rest inert).',
  initChatGrip: 'Moving the chat: a grip button, arrows 20px (Shift 80px), End returns to the corner, clamped to the window, a quiet status line for edges.',
  initChat: 'Agent chat: launcher opens a non-modal panel, focus to the field, Escape closes and returns focus, Tab wraps inside, modal on phones, messages in a log.',
  initScrollRegion: 'A scrollable region is a tab stop only while its content overflows.',
  initDensitySwitch: 'Showcase only: ?density=compact or a switch, for previewing the app scale.',
  initBannerSlides: 'Slideshow banner: pictures cross-fade behind the header, caption and controls like the slider, Pause always works, a slide may hold a video with its own button.',
};

export function build() {
  const blocks = list(join(DS, 'blocks'), '.css');
  const pages = list(join(DS, 'showcase'), '.html').filter((f) => !f.startsWith('_'));
  const pageText = Object.fromEntries(pages.map((p) => [p, read(join(DS, 'showcase', p))]));
  const ng = walk(join(DS, '..', 'client', 'app'), '.ts').map((p) => [p.slice(join(DS, '..').length + 1), read(p)]);
  const js = read(join(DS, 'showcase', 'showcase.js')).split('\n');
  const behaviours = [];
  js.forEach((line) => {
    const m = line.match(/^  function (init[A-Za-z]+)\(/);
    if (!m) return;
    if (!(m[1] in BEHAVIOURS)) throw new Error(`showcase.js has ${m[1]}() and tools/inventory.mjs has no description for it: add it to BEHAVIOURS`);
    behaviours.push([m[1], BEHAVIOURS[m[1]]]);
  });

  // A class belongs to the block file that uses it most (so .cu-icon is the icon block's, not every block that draws one).
  const counts = Object.fromEntries(blocks.map((f) => [f, rootCounts(read(join(DS, 'blocks', f)))]));
  const owner = {};
  for (const f of blocks) for (const [c, k] of Object.entries(counts[f])) if (!owner[c] || k > counts[owner[c]][c]) owner[c] = f;
  const own = (f) => Object.entries(counts[f]).filter(([c]) => owner[c] === f).sort((a, b) => b[1] - a[1]).map(([c]) => c);

  const L = [];
  L.push('# Components: the inventory', '');
  L.push('<!-- Built by tools/inventory.mjs from blocks/, showcase/, showcase.js and client/app: edit those, not this file. -->', '');
  L.push('Every block in the Cornell design system, what it is, where to see it and where the Angular app uses it. The rules for using the');
  L.push('blocks are in `.claude/skills/cornell-branding/` and `.claude/skills/cornell-accessibility/`; the header comment of each block file');
  L.push('has its markup pattern and what its behaviour must keep. A block is plain CSS (`@layer blocks`); behaviour is the reference script');
  L.push('`showcase/showcase.js`, which an app reproduces (Angular CDK or a small component) and `tools/a11y.mjs` proves.', '');
  L.push(`${blocks.length} blocks, ${pages.length} showcase pages, ${behaviours.length} reference behaviours.`, '');
  L.push('## Blocks', '', '| Block file | What it is | Root classes | Shown on | Used in the Angular app |', '|---|---|---|---|---|');
  for (const f of blocks) {
    const css = read(join(DS, 'blocks', f));
    const rs = own(f);
    const shown = pages.filter((p) => rs.some((r) => new RegExp(`class="[^"]*\\b${r}\\b`).test(pageText[p]))).map((p) => p.replace('.html', ''));
    const used = [...new Set(ng.filter(([, t]) => rs.some((r) => new RegExp(`\\b${r}\\b`).test(t))).map(([p]) => p.replace(/^client\/app\//, '')))].slice(0, 4);
    L.push(`| \`blocks/${f}\` | ${summary(css)} | ${rs.slice(0, 6).map((r) => '`.' + r + '`').join(' ') || '-'} | ${shown.slice(0, 5).join(', ') || '-'} | ${used.length ? used.map((u) => '`' + u + '`').join(', ') : '-'} |`);
  }
  L.push('', '## Reference behaviours (`showcase/showcase.js`)', '', 'The look is CSS; these are the behaviours the app has to keep. Each has tests in `tools/a11y.mjs`.', '', '| Function | What it does |', '|---|---|');
  for (const [name, what] of behaviours) L.push(`| \`${name}\` | ${what.replace(/\|/g, '/')} |`);
  L.push('', '## Showcase pages', '', '| Page | Shows |', '|---|---|');
  for (const p of pages) {
    const t = pageText[p].match(/<title>([^<]*)<\/title>/);
    const i = pageText[p].match(/<p class="cu-intro">([\s\S]*?)<\/p>/);
    L.push(`| \`showcase/${p}\` | ${((t ? t[1].replace(/ · .*/, '') : p) + (i ? ': ' + i[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 150) : '')).replace(/\|/g, '/')} |`);
  }
  const tokens = list(join(DS, 'tokens'), '.css'), themes = list(join(DS, 'themes'), '.css'), base = list(join(DS, 'base'), '.css');
  L.push('', '## Tokens, themes and base', '');
  L.push(`- Tokens: ${tokens.map((t) => '`tokens/' + t + '`').join(', ')} (primitives are the brand-book values; semantic tokens are what blocks use, flipped by \`light-dark()\`).`);
  L.push(`- Themes (a \`data-theme\` on the header or app bar): ${themes.map((t) => '`' + t.replace('.css', '') + '`').join(', ')}, plus the default carnelian.`);
  L.push(`- Base: ${base.map((t) => '`base/' + t + '`').join(', ')}.`);
  L.push('- Angular: `client/app/shared/layout/` (site header, public layout and footer, app shell, side menu), `client/app/shared/look/` (`provideLook`), `client/app/shared/services/theme/` (mode and theme), `client/app/shared/directives/` (scroll region).');
  return L.join('\n') + '\n';
}

export const staleInventory = () => (existsSync(OUT) && read(OUT) === build() ? [] : ['COMPONENTS.md']);

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--check')) {
    if (staleInventory().length) { console.error('COMPONENTS.md is out of date: run node design-system/tools/inventory.mjs'); process.exit(1); }
    console.log('COMPONENTS.md is up to date');
  } else { writeFileSync(OUT, build()); console.log('Wrote COMPONENTS.md'); }
}
