// Where the chat tools are allowed to read from. Both dev (`tsx watch`) and prod
// (the Docker image) read the same `dist/content/**` snapshot written by
// `scripts/export-chat-content.mjs` at the end of `npm run build` — see that
// script for why (the prod image never contains `client/**/*.ts` or `docs/**/*.md`).
import { existsSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';

// Deliberately visitor-facing content only. `/api/chat` is public and unauthenticated, so
// never add a root that holds internal notes, source code, env files, or anything you
// would not publish — least privilege means a successful prompt injection has nothing
// internal to reach.
//
// To give the assistant structured data (a JSON catalog, say), write it to dist/content/
// in scripts/export-chat-content.mjs, add its key to CONTENT_ROOT_KEYS, and add a
// `kind: 'file'` entry to getContentRoots() below. The tools' `root` enums follow.
export const CONTENT_ROOT_KEYS = ['pages'] as const;
export type ContentRootKey = (typeof CONTENT_ROOT_KEYS)[number];

export interface ContentRoot {
  key: ContentRootKey;
  description: string;
  /** A single JSON file or a directory to walk. */
  kind: 'file' | 'dir';
  /** Realpath-resolved absolute path. Undefined if the target doesn't exist yet — e.g. before the first `npm run build`. */
  base?: string;
  extensions: string[];
}

// `import.meta.dirname`-relative math breaks once tsc compiles this file: the source
// sits 3 levels under the repo root (server/modules/chat), but the compiled output
// sits 4 levels under it (dist/server/modules/chat), landing one directory short. Both
// `tsx watch server/index.ts` (dev) and `node dist/server/index.js` (prod, incl. the
// Docker WORKDIR) are always launched from the repo root, so cwd is the reliable anchor.
const repoRoot = resolve(process.cwd());
const pagesDir = resolve(repoRoot, 'dist/client/browser');

function resolveExisting(path: string): string | undefined {
  if (!existsSync(path)) return undefined;
  try {
    return realpathSync(path);
  } catch {
    return undefined;
  }
}

export function getContentRoots(): ContentRoot[] {
  return [
    {
      key: 'pages',
      description:
        'Prerendered site pages (raw HTML — always read with read_content format "markdown", never "raw")',
      kind: 'dir',
      base: resolveExisting(pagesDir),
      extensions: ['.html'],
    },
  ];
}
