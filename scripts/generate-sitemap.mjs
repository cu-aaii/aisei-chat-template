// Build-time sitemap generator. Runs last in `npm run build`, after both `ng build` and
// `scripts/export-chat-content.mjs`, because it reads the output of each.
//
// The URL set comes from the built output rather than from `app.routes.ts`: every route in
// this app is prerendered (see client/app/app.routes.server.ts — `**` plus every `:slug`
// route via getPrerenderParams), so each `dist/client/browser/**/index.html` is a real
// page that a crawler can fetch. Deriving the list from what shipped means the sitemap
// cannot promise a URL that isn't there.
//
// Nothing here needs a server route or a Dockerfile change: server/app.ts already serves
// dist/client/browser as static files, and the Dockerfile copies dist/ wholesale after
// running `npm run build`.
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const rootDir = path.resolve(import.meta.dirname, '..');
const browserDir = path.join(rootDir, 'dist', 'client', 'browser');
const siteIndexPath = path.join(rootDir, 'dist', 'content', 'site-index.json');

// Set SITE_URL when you run `npm run build` to your deployed origin, e.g.
// SITE_URL=https://my-project.example.cornell.edu npm run build. The default is only
// right for local builds.
const DEFAULT_SITE_URL = 'http://localhost:4318';

// Prerendered routes that should stay out of the sitemap (none by default).
const EXCLUDED_PATHS = new Set([]);

function resolveSiteUrl() {
  const raw = (process.env.SITE_URL ?? DEFAULT_SITE_URL).trim();
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`SITE_URL is not a valid absolute URL: ${raw}`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`SITE_URL must be http or https, got: ${raw}`);
  }
  // <loc> values must be absolute, so a trailing slash here would double up on every URL.
  return raw.replace(/\/+$/, '');
}

/** Every prerendered route, as a site-absolute path. `index.csr.html` is the SPA shell, not a route. */
async function findPrerenderedRoutes(dir, prefix = '') {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (error) {
    // Only the top-level failure means "you haven't built yet"; a nested one is a real
    // filesystem error and should say so rather than send you to run a build you just ran.
    if (prefix === '') throw new Error(`No build output at ${browserDir} — run \`npm run build\` first.`);
    throw error;
  }

  const routes = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    if (entry.isDirectory()) {
      routes.push(...(await findPrerenderedRoutes(path.join(dir, entry.name), `${prefix}/${entry.name}`)));
    } else if (entry.name === 'index.html') {
      routes.push(prefix === '' ? '/' : prefix);
    }
  }
  return routes;
}

/** Dated entries keyed by path, for `lastmod` (none in the base template — add a `posts` array with `date` to site-index.json to use it). */
async function readLastmodByPath() {
  let siteIndex;
  try {
    siteIndex = JSON.parse(await readFile(siteIndexPath, 'utf-8'));
  } catch {
    console.warn(
      'generate-sitemap: no readable dist/content/site-index.json — emitting a sitemap without lastmod dates',
    );
    return { lastmod: new Map(), indexedPaths: null };
  }

  const lastmod = new Map();
  for (const post of siteIndex.posts ?? []) {
    // Content dates are human-readable ("June 15, 2026"); <lastmod> wants W3C date format.
    // Formatted from local components rather than toISOString(): the parsed date is local
    // midnight, so converting to UTC would shift it a day earlier east of Greenwich.
    const parsed = new Date(post.date);
    if (Number.isNaN(parsed.getTime())) continue;
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    lastmod.set(post.path, `${parsed.getFullYear()}-${month}-${day}`);
  }

  // Every group in the index, so a new content type added to export-chat-content.mjs is
  // covered by the drift check below without also having to be listed here.
  const indexedPaths = new Set(
    Object.values(siteIndex)
      .filter(Array.isArray)
      .flat()
      .map((entry) => entry?.path)
      .filter(Boolean),
  );
  return { lastmod, indexedPaths };
}

// A crawler rejects a malformed sitemap wholesale rather than skipping the bad <url>, so one
// unescaped `&` in a slug would silently deindex the site. Nothing in the content produces
// one today; escaping here means nothing ever can.
function escapeXml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Only the two fields that still matter. Google ignores <changefreq> and <priority>
// outright, and a <lastmod> that moves on every deploy teaches crawlers to distrust the
// field — so pages without a real content date get none at all.
function renderSitemap(siteUrl, routes, lastmodByPath) {
  const urls = routes.map((route) => {
    const loc = escapeXml(`${siteUrl}${route}`);
    const lastmod = lastmodByPath.get(route);
    return [
      '  <url>',
      `    <loc>${loc}</loc>`,
      ...(lastmod ? [`    <lastmod>${lastmod}</lastmod>`] : []),
      '  </url>',
    ].join('\n');
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n');
}

// Appends to the built copy of robots.txt, not the committed source, so the canonical host
// stays out of version control. Idempotent — the script is safe to re-run against a dist
// that already has the line.
async function addSitemapLineToRobots(siteUrl) {
  const robotsPath = path.join(browserDir, 'robots.txt');
  let robots;
  try {
    robots = await readFile(robotsPath, 'utf-8');
  } catch {
    console.warn(`generate-sitemap: no robots.txt at ${robotsPath} — skipping the Sitemap: line`);
    return;
  }

  const line = `Sitemap: ${siteUrl}/sitemap.xml`;
  if (robots.includes(line)) return;

  // Drop any Sitemap: line from an earlier run with a different SITE_URL.
  const withoutOldLine = robots.replace(/^Sitemap:.*$\n?/gim, '');
  await writeFile(robotsPath, `${withoutOldLine.trimEnd()}\n\n${line}\n`, 'utf-8');
}

// The one check that catches a page added to app.routes.ts but never added to the index:
// the router and site-index.json are compared against each other. A static page belongs in
// STATIC_PAGES; a new `:slug` route needs its own group in export-chat-content.mjs's
// `siteIndex`. A warning, not a failure — a stale index entry should never block a deploy.
function warnOnDrift(routes, indexedPaths) {
  if (!indexedPaths) return;
  const shipped = new Set(routes);

  const missingFromIndex = routes.filter((route) => !indexedPaths.has(route));
  if (missingFromIndex.length > 0) {
    console.warn(
      `generate-sitemap: ${missingFromIndex.length} prerendered route(s) missing from site-index.json — ` +
        'the chat assistant cannot link them. Add them to STATIC_PAGES (or their own ' +
        `siteIndex group) in scripts/export-chat-content.mjs: ${missingFromIndex.join(', ')}`,
    );
  }

  const notShipped = [...indexedPaths].filter((p) => !shipped.has(p) && !EXCLUDED_PATHS.has(p));
  if (notShipped.length > 0) {
    console.warn(
      `generate-sitemap: ${notShipped.length} site-index.json path(s) were not prerendered — ` +
        `the chat assistant may link a 404: ${notShipped.join(', ')}`,
    );
  }
}

const siteUrl = resolveSiteUrl();
const { lastmod, indexedPaths } = await readLastmodByPath();
const allRoutes = await findPrerenderedRoutes(browserDir);
const routes = allRoutes.filter((route) => !EXCLUDED_PATHS.has(route)).sort();

warnOnDrift(routes, indexedPaths);

await writeFile(path.join(browserDir, 'sitemap.xml'), renderSitemap(siteUrl, routes, lastmod), 'utf-8');
await addSitemapLineToRobots(siteUrl);

const datedCount = routes.filter((route) => lastmod.has(route)).length;
console.log(
  `generate-sitemap: wrote ${routes.length} URLs (${datedCount} with lastmod) for ${siteUrl} to ${path.join(browserDir, 'sitemap.xml')}`,
);
