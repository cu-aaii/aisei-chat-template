/* Builds the two demo pages (showcase/public.html, the home page, and showcase/page.html, the content page) from shared parts, so
   the header, the footer and every content element exist once:
     showcase/_pages/<page>.html   the page's own layout: its <main>, and which parts go where   ({{> part}} includes a part)
     showcase/_parts/<part>.html   header ("top"), footer ("bottom") and the content elements the two pages share
   {{title}} and {{current.welcome|tools|about}} are the page's own values (see PAGES). The built files are committed; check.mjs
   fails when they are out of date. Edit the parts and pages, then run:
     node design-system/tools/build-pages.mjs            writes both pages
     node design-system/tools/build-pages.mjs --check    exits 1 when a page is not what the parts build (no writes) */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SHOWCASE = join(dirname(fileURLToPath(import.meta.url)), '..', 'showcase');
export const PAGES = {
  'public.html': { title: 'Public page', current: 'welcome' },
  'page.html': { title: 'Content page', current: 'tools' },
};
const BANNER = '<!-- Built by tools/build-pages.mjs from showcase/_pages and showcase/_parts: edit those, not this file. -->\n';

const read = (dir, name) => readFileSync(join(SHOWCASE, dir, name + '.html'), 'utf8');

function render(text, vars, trail) {
  return text
    // a part goes in at the indentation of its {{> part}} line, so the built page reads as if written by hand
    .replace(/^([ \t]*)\{\{>\s*([\w-]+)\s*\}\}/gm, (_, indent, part) => {
      if (trail.includes(part)) throw new Error(`part "${part}" includes itself (${trail.join(' > ')})`);
      const html = render(read('_parts', part).replace(/\n$/, ''), vars, [...trail, part]);
      return html.split('\n').map((line, i) => (i === 0 || !line ? indent + line : indent + line)).join('\n');
    })
    .replace(/\{\{([\w.]+)\}\}/g, (_, key) => {
      const v = key.split('.').reduce((o, k) => (o == null ? o : o[k]), vars);
      if (v === undefined) throw new Error(`unknown value {{${key}}}`);
      return v;
    });
}

/** The built pages: { 'public.html': '<!doctype html>…', … }. */
export function buildAll() {
  const out = {};
  for (const [file, page] of Object.entries(PAGES)) {
    const vars = {
      title: page.title,
      current: Object.fromEntries(['welcome', 'tools', 'about'].map((k) => [k, k === page.current ? ' aria-current="page"' : ''])),
    };
    const html = render(read('_pages', file.replace(/\.html$/, '')), vars, []);
    out[file] = html.replace(/^(<!doctype html>\n)/i, `$1${BANNER}`);
  }
  return out;
}

/** The names of the pages whose file on disk is not what the parts build. */
export function stalePages() {
  const built = buildAll();
  return Object.keys(built).filter((f) => {
    try { return readFileSync(join(SHOWCASE, f), 'utf8') !== built[f]; } catch { return true; }
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv.includes('--check')) {
    const stale = stalePages();
    if (stale.length) { console.error(`out of date: ${stale.join(', ')} - run node design-system/tools/build-pages.mjs`); process.exit(1); }
    console.log('pages are up to date');
  } else {
    for (const [f, html] of Object.entries(buildAll())) { writeFileSync(join(SHOWCASE, f), html); console.log('wrote showcase/' + f); }
  }
}
