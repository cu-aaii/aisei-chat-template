import { Hono } from 'hono';
import { compress } from 'hono/compress';
import { etag, RETAINED_304_HEADERS } from 'hono/etag';
import { logger } from 'hono/logger';
// import { requestId } from 'hono/request-id';
import { secureHeaders } from 'hono/secure-headers';
import { serveStatic } from '@hono/node-server/serve-static';
import { chatRouter } from './modules/chat/chat.routes.js';
import { issueCsrfCookie, verifyCsrfToken } from './middleware/csrf.js';

export const app = new Hono();

// `/api/chat` streams SSE via the AI SDK's UI Message Stream protocol — none of the
// three global middleware below may buffer or compress it, or the browser sees
// nothing until the whole response is done, which defeats streaming entirely.
const API_PREFIX = '/api/';

// Middleware
app.use('*', logger());
app.use('*', secureHeaders({ xFrameOptions: false }));
// app.use('*', requestId());

// Fingerprinted build output: `outputHashing: "all"` puts a content hash in every
// JS/CSS filename, so a changed file is a changed URL and the old one can never go
// stale. Anything matching this can be cached forever and never revalidated.
const FINGERPRINTED = /-[A-Z0-9]{8}\.(?:js|css)$/;

// Revalidation for everything that is NOT fingerprinted — which is all the HTML, and
// the HTML is what carries the asset hashes, so it has to be re-checked or a client
// pins itself to a stale build. `serveStatic` sets no validator of its own, so without
// this every navigation re-downloads the full document (~24 KB gzipped for the home
// page) even when nothing changed. With it, an unchanged page is a 304 with no body.
//
// Registered BEFORE compress on purpose, which makes it the outer middleware and so the
// last to run on the way out: it therefore hashes the compressed bytes. That is both
// cheaper (less to hash) and more correct than hashing the identity body, since an ETag
// is supposed to identify a specific content-coding. It also keeps compress off the 304
// path entirely — a 304 must not carry a body, and nothing tries to gzip one.
//
// `set-cookie` is added to the headers a 304 keeps. Hono drops everything outside
// RETAINED_304_HEADERS, and the CSRF issuer below runs *inside* this middleware, so its
// cookie would be discarded on exactly the responses a returning browser gets. That
// strands anyone holding a cached page but no XSRF-TOKEN — a session cookie, so dropped
// on browser restart while the disk cache survives it: every navigation revalidates to a
// 304, no new token is ever issued, and chat 403s until a hard reload. The spec's list is
// the minimum a 304 must carry, not the maximum it may.
const etagMiddleware = etag({ retainedHeaders: ['set-cookie', ...RETAINED_304_HEADERS] });
app.use('*', async (c, next) => {
  // Skip the immutable assets: they are never revalidated, so an ETag would only buy
  // the cost of buffering every JS chunk in memory to hash it. Also skip `/api/*`: an
  // ETag middleware buffers the full body to hash it, which would hold up every SSE
  // chunk from the chat stream until the model finished responding.
  if (FINGERPRINTED.test(c.req.path) || c.req.path.startsWith(API_PREFIX)) return next();
  return etagMiddleware(c, next);
});

// gzip/brotli for HTML, JS, CSS. Nothing upstream compresses for us — the ALB
// forwards responses byte-for-byte — and the prerendered pages plus the two big
// vendor chunks are ~400 KiB of text that shrinks by roughly 70%. Skips images,
// which are already compressed, and `/api/*`: compress buffers the full response
// before it can gzip it, which would break SSE streaming.
app.use('*', async (c, next) => {
  if (c.req.path.startsWith(API_PREFIX)) return next();
  return compress()(c, next);
});

app.use('*', async (c, next) => {
  await next();
  if (c.req.path.startsWith(API_PREFIX)) return;
  // Unconditional, because this middleware runs *inside* compress: on the way out it
  // finishes before compress has attached `content-encoding`, so testing for that header
  // here would never match. Any response that could be compressed must carry this, or a
  // shared cache in front (CloudFront, a corporate proxy) may hand a gzipped body to a
  // client that never asked for one. Hono's compress middleware does not set it itself.
  c.res.headers.set('vary', 'Accept-Encoding');
  // Only describe the caching of a real response. Without this guard a 404 or a
  // redirect inherits the immutable header below, which is a cache-poisoning shape:
  // one bad response pinned for a year under a URL that may later become valid.
  if (c.res.status !== 200 || c.res.headers.has('cache-control')) return;
  const path = c.req.path;
  if (FINGERPRINTED.test(path)) {
    c.res.headers.set('cache-control', 'public, max-age=31536000, immutable');
  } else if (path.startsWith('/assets/')) {
    // Not fingerprinted — images and media are overwritten in place, so a long TTL
    // would serve a replaced file. A day, then revalidate.
    c.res.headers.set('cache-control', 'public, max-age=86400');
  } else {
    // HTML. Storable, but always revalidated, so the ETag above does the real work and
    // a new deploy is picked up on the next navigation rather than after a TTL.
    c.res.headers.set('cache-control', 'public, max-age=0, must-revalidate');
  }
});

// Hands every browser a random XSRF-TOKEN cookie — see server/middleware/csrf.ts.
//
// Only HTML responses carry it, because an HTML document is the only response that
// bootstraps a browser: the cookie has to exist before the app's first /api/chat call,
// and the document that loads the app always precedes it. Deliberately a positive test
// on the response rather than a skip-list of asset paths — a `Set-Cookie` is wasted (or
// actively wrong) on everything else, and enumerating "everything else" doesn't stay
// correct. It previously fired on /health for every ALB health check, on robots.txt and
// favicon.ico, and on every 404, while a shared cache in front of us could store one
// browser's token attached to a cacheable response.
//
// In practice that means one `Set-Cookie` per browser, on its first page load: the
// issuing side is a no-op once the request arrives carrying the cookie, so later
// navigations add nothing. No /api/* response ever sets it — a client that loses its
// cookie mid-session gets a 403 and recovers on the next page load, not on retry.
app.use('*', async (c, next) => {
  await next();
  if (c.res.headers.get('content-type')?.startsWith('text/html')) issueCsrfCookie(c);
});

// API routes
app.get('/health', (c) => {
  return c.json({ status: 'ok', uptime: process.uptime() });
});

// Two-layer CSRF check (same-origin + double-submit cookie) on every method/route under
// /api/chat, including GET /api/chat/config — see server/middleware/csrf.ts.
app.use('/api/chat/*', verifyCsrfToken());

app.route('/api/chat', chatRouter);

// Static file serving (production/local mode). All 33 routes are prerendered to
// `<route>/index.html`, so a normal navigation is served as a real static file here and
// never reaches the SPA fallback below.
app.use('/*', serveStatic({ root: './dist/client/browser' }));

// A request that looks like a file but wasn't found is a genuine 404, not a route.
// Without this it fell through to the SPA fallback and got `200 text/html` — so a client
// still running an old build, asking for a lazy chunk that this deploy no longer has,
// received index.html *as* the chunk. It would then fail to parse as JS, and (before the
// status guard above) be cached under `immutable` for a year, making the failure
// permanent for that URL. Answering 404 lets Angular's own chunk-load error path run,
// which reloads the page onto the current build.
const LOOKS_LIKE_A_FILE =
  /\.(?:js|mjs|css|map|woff2?|ttf|otf|eot|png|jpe?g|gif|svg|webp|avif|ico|json|txt|xml|webmanifest)$/i;
app.get('*', async (c, next) => {
  if (LOOKS_LIKE_A_FILE.test(c.req.path)) return c.notFound();
  return next();
});

app.get('*', serveStatic({ root: './dist/client/browser', path: '/index.html' }));
