// Build-time content snapshot for the chat assistant.
//
// Writes `dist/content/site-index.json` — every public page with its title — which the
// assistant's system prompt embeds (server/modules/chat/prompt.ts) so it can link pages
// without searching first, and which scripts/generate-sitemap.mjs reads.
//
// The page text itself is not copied here: the assistant's search/read tools read the
// prerendered HTML in dist/client/browser directly (the "pages" content root in
// server/modules/chat/content-roots.ts).
//
// To add structured content the assistant can search (a JSON catalog of items, say),
// import the data array here, add it to `jsonFiles`, and register a matching root in
// content-roots.ts. Only ever export visitor-facing content: /api/chat is public.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const rootDir = path.resolve(import.meta.dirname, '..');
const contentDir = path.join(rootDir, 'dist', 'content');

await mkdir(contentDir, { recursive: true });

// The site's indexable pages, titled as client/app/app.routes.ts titles them. Keep this
// in step with the router — scripts/generate-sitemap.mjs warns at build time when a
// prerendered page is missing from this list.
const STATIC_PAGES = [
  { path: '/', title: 'Home' },
  { path: '/about', title: 'About' },
];

const siteIndex = { staticPages: STATIC_PAGES };

const jsonFiles = {
  'site-index.json': siteIndex,
};

const manifestFiles = [];

for (const [name, data] of Object.entries(jsonFiles)) {
  const contents = JSON.stringify(data, null, 2);
  await writeFile(path.join(contentDir, name), contents, 'utf-8');
  manifestFiles.push({ path: `${name}`, bytes: Buffer.byteLength(contents) });
}

await writeFile(
  path.join(contentDir, 'manifest.json'),
  JSON.stringify({ generatedAt: new Date().toISOString(), files: manifestFiles }, null, 2),
  'utf-8',
);

console.log(`export-chat-content: wrote ${manifestFiles.length} files to ${contentDir}`);
