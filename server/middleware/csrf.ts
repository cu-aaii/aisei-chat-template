// Two independent layers against forged requests to /api/*, neither of which needs a
// session/data layer (this app deliberately has none — see AGENTS.md):
//
// 1. Same-origin check via `sec-fetch-site`/`Origin` — cheap, but a non-browser caller
//    can fake both headers in a single request.
// 2. A stateless double-submit cookie: `issueCsrfCookie` hands every browser a random
//    `XSRF-TOKEN` on its first page load (HTML responses only — see server/app.ts), and
//    `verifyCsrfToken` requires that exact value echoed back as `X-XSRF-TOKEN`. A bare
//    `curl -X POST` fails outright, even if it fakes layer 1's headers: no /api/*
//    response ever issues a cookie, so it has to fetch a page first to see one.
//
// Deliberately NOT using Hono's built-in `hono/csrf` middleware here: it only inspects
// requests with a form-like Content-Type (`application/x-www-form-urlencoded`,
// `multipart/form-data`, `text/plain`) — it exists to block <form>-based CSRF that dodges
// CORS preflight. Our chat POST sends `application/json`, which never matches that check,
// so it would silently provide zero protection on the endpoint that actually matters.
import type { Context, MiddlewareHandler } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import { config } from '../app.config.js';

const COOKIE_NAME = 'XSRF-TOKEN';
const HEADER_NAME = 'x-xsrf-token';

/**
 * Attaches a fresh double-submit token to an outgoing response, unless the request
 * already carried one. Called on the way out (the caller decides which responses are
 * worth a cookie — see server/app.ts), not as a middleware of its own.
 */
export function issueCsrfCookie(c: Context): void {
  if (getCookie(c, COOKIE_NAME)) return;
  setCookie(c, COOKIE_NAME, crypto.randomUUID(), {
    path: '/',
    sameSite: 'Strict',
    secure: config.isProduction,
    // Must be readable by client JS — it's echoed back as a request header, not read
    // by the server from the cookie jar of a privileged context.
    httpOnly: false,
  });
}

function checkSameOrigin(c: Context): { ok: true } | { ok: false; message: string } {
  const secFetchSite = c.req.header('sec-fetch-site');
  if (secFetchSite) {
    if (secFetchSite !== 'same-origin' && secFetchSite !== 'none') {
      return { ok: false, message: 'Cross-site requests are not allowed.' };
    }
    return { ok: true };
  }
  const origin = c.req.header('origin');
  if (!origin) return { ok: false, message: 'Missing Origin header.' };
  try {
    if (new URL(origin).host !== new URL(c.req.url).host) {
      return { ok: false, message: 'Cross-origin requests are not allowed.' };
    }
  } catch {
    return { ok: false, message: 'Invalid Origin header.' };
  }
  return { ok: true };
}

export function verifyCsrfToken(): MiddlewareHandler {
  return async (c, next) => {
    const originCheck = checkSameOrigin(c);
    if (!originCheck.ok) return c.json({ error: originCheck.message }, 403);

    const cookieToken = getCookie(c, COOKIE_NAME);
    const headerToken = c.req.header(HEADER_NAME);
    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
      return c.json({ error: 'Missing or invalid CSRF token.' }, 403);
    }

    return next();
  };
}
