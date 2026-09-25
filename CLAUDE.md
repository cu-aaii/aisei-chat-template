# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

`aisei-chat-template` — a starter site from the Cornell AI Innovation Hub: two public
pages (`/` and `/about`) inside the Hub's header/footer theme, plus a streaming AI chat
assistant that answers from the site's own pages. No database, no auth. Students clone
it as a starting point, so keep changes simple and explained.

## Tech stack

- **Server**: Hono on Node 24 (`@hono/node-server`), ESM only (`"type": "module"`)
- **Client**: Angular 22 — standalone components, signals, OnPush, every route prerendered
- **Chat**: Vercel AI SDK (`ai`, `@ai-sdk/openai-compatible`) → Cornell LiteLLM gateway
- **Dev**: Angular on :4200 proxies `/api/*` to Hono on :4318 (the container uses :8000)

## Layout

```
server/
  index.ts              Starts Hono
  app.ts                Middleware chain — ORDER IS LOAD-BEARING (ETag, compress,
                        cache-control, CSRF; /api/* is exempt from anything that buffers,
                        or SSE stops streaming). /health, /api/chat, static dist/client/browser
  app.config.ts         Reads only PORT / GATEWAY_API_KEY / CHAT_ENABLED; model, gateway URL
                        and rate limits are constants here
  middleware/csrf.ts    Same-origin check + double-submit cookie on /api/chat/*
  modules/chat/
    chat.routes.ts      Real router when GATEWAY_API_KEY is set, stub otherwise
    chat-router.ts      POST / (streaming) + GET /config; size caps, rate limit
    prompt.ts           System prompt (SITE_NAME, scope, refusals) + embedded site index
    content-roots.ts    What the tools may read — visitor-facing content ONLY
    tools/              search_content, read_content, ToolRegistry
client/app/
  app.routes.ts         Routes (AppRoute; data.menu, title, description)
  app.routes.server.ts  Prerender config (`**`)
  features/public/      home/, about/
  shared/layout/public/ Masthead, nav-items.ts, footer, public-layout (mounts the chat
                        widget), inner-page-layout (title band + body)
  shared/components/    hero, button (a[appButton]), icon, lab-wordmark, scroll-to-top,
                        chat/ (panel, markdown pipe), chat-dialog/ (floating widget),
                        localist-events-widget/ (third-party script embed example)
  shared/services/      ChatEngineService (conversation state singleton)
  shared/theme/         variables.css (tokens), fonts, typography, utilities
scripts/
  export-chat-content.mjs  Build step: dist/content/site-index.json (STATIC_PAGES)
  generate-sitemap.mjs     Build step: sitemap.xml + robots.txt Sitemap: line ($SITE_URL)
```

## Commands

```bash
npm run dev      # Angular :4200 + Hono :4318
npm run build    # Angular prerender + tsc server + chat index + sitemap
npm start        # Serve the production build
npm run check    # tsc --noEmit + ng build — run before every commit
npm run lint
```

`check` runs neither script in `scripts/`, and its `ng build` wipes `dist/client/browser`
(so no sitemap afterwards). After touching either script, run it by hand and look at the
output in `dist/`. Adding a page = route in `app.routes.ts` + link in `nav-items.ts` + a
line in `STATIC_PAGES` (`generate-sitemap.mjs` warns if you forget the last one).

## Docker

```bash
docker build --target app -t aisei-chat-template:local .
docker run --rm -p 8000:8000 -e GATEWAY_API_KEY=... aisei-chat-template:local
```

Don't pass `--env-file .env` to `docker run`: its `PORT=4318` overrides the image's 8000.

## Rules

- Components: standalone (don't set `standalone: true`), `inject()` not constructor
  injection, `input()`/`output()` signals, `ChangeDetectionStrategy.OnPush`
- Templates: `@if` / `@for` / `@switch` — never `*ngIf`, `*ngFor`, `ngClass`, `ngStyle`
- Host bindings go in the `host:` object, not `@HostBinding` / `@HostListener`
- Browser-only DOM work (third-party scripts, canvas, `window`) goes in `afterNextRender`
  — it must not run during prerender
- Server imports use `.js` extensions (ESM)
- Reuse the shared components and CSS variables before writing new styles
- `/api/chat` is public and paid per request: keep the rate limit, size caps, CSRF check
  and prompt guard rails; never register a content root holding anything internal;
  never commit a key (`.env` is git-ignored)

## Skills

| Skill | Purpose |
|---|---|
| [Angular Component](.claude/skills/angular-component/SKILL.md) | Angular component patterns (signals, host bindings, a11y) |
