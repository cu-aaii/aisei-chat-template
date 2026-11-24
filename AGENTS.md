# AGENTS.md

Guidance for AI coding agents (Claude Code, Codex, Cursor, Copilot, Gemini CLI, and
others) working in this repository. This is the single source of truth: `CLAUDE.md`
only imports this file, so edit here.

## What this is

`aisei-chat-template` — a starter site from the Cornell AI Innovation Hub: two public
pages (`/` and `/about`) inside the Cornell design system's header and footer, plus a streaming AI chat
assistant that answers from the site's own pages. No database, no auth. Students clone
it as a starting point, so keep changes simple and explained.

## Tech stack

- **Server**: Hono on Node 24 (`@hono/node-server`), ESM only (`"type": "module"`)
- **Client**: Angular 22 — standalone components, signals, OnPush, every route prerendered
- **Look**: the Cornell design system (`design-system/`, a pinned read-only copy of cu-aaii/cornell-design-system);
  plain CSS, no Angular Material
- **Chat**: Vercel AI SDK (`ai`, `@ai-sdk/openai-compatible`) → Cornell LiteLLM gateway
- **Dev**: Angular on :4200 proxies `/api/*` to Hono on :4318 (the container uses :8000)

## Layout

```
server/
  index.ts              Starts Hono
  app.ts                Middleware chain — ORDER IS LOAD-BEARING (ETag, compress,
                        cache-control, CSRF; /api/* is exempt from anything that buffers,
                        or SSE stops streaming). /health, /api/chat, static dist/client/browser
  app.config.ts         Reads only PORT / GATEWAY_API_KEY / CHAT_ENABLED / BUILD_SHA / CHAT_TRANSCRIPT_LOG / CSRF_ENABLED;
                        model, gateway URL and rate limits are constants here
  middleware/csrf.ts    Same-origin check + double-submit cookie on /api/chat/* (opt-in: CSRF_ENABLED=true)
  modules/chat/
    chat.routes.ts      Real router when GATEWAY_API_KEY is set, stub otherwise
    chat-router.ts      POST / (streaming) + GET /config; size caps, rate limit
    transcript-log.ts   CHAT_TRANSCRIPT_LOG: one `chat.transcript` JSON line per turn (off by default)
    prompt.ts           System prompt (SITE_NAME, scope, refusals) + embedded site index
    content-roots.ts    What the tools may read — visitor-facing content ONLY
    tools/              search_content, read_content, ToolRegistry
client/app/
  app.routes.ts         Routes (AppRoute; data.menu, title, description)
  app.routes.server.ts  Prerender config (`**`)
  features/public/      home/, about/
  shared/layout/public/ public-layout (CDS header + footer, mounts the chat widget), nav-items.ts,
                        site-footer (.cu-footer + the Appearance switch), inner-page-layout (title band + body)
  shared/layout/site-header/  The CDS site banner (.cu-header + .cu-nav, phone menu overlay)
  shared/look/          provideLook(): the site's Cornell look (header style, nav, mode)
  shared/components/    hero, icon (svg[appIcon], from the sprite in index.html), scroll-to-top
                        (.cu-back-to-top), chat/ (panel, markdown pipe), chat-dialog/ (.cu-chat widget),
                        localist-events-widget/ (third-party script embed example)
  shared/services/      ChatEngineService (conversation state); theme/ (ThemeService: light/dark, CssColorProbe)
  shared/theme/         layers.css (cascade layers), styles.css, accessability.css, app.css
design-system/          Cornell design system: tokens, blocks, themes. READ-ONLY (design-system.lock.json)
scripts/
  sync-design-system.mjs, check-design-system.mjs, check-raw-colours.mjs  The design system's lock + colour checks
  export-chat-content.mjs  Build step: dist/content/site-index.json (STATIC_PAGES)
  generate-sitemap.mjs     Build step: sitemap.xml + robots.txt Sitemap: line ($SITE_URL)
evals/
  chat.test.ts          The gate: asks the real assistant every case via app.request() (CSRF if on,
                        rate limit, prompt, tools, gateway); fails on any wrong answer
  chat-cases.ts         Case schema + deterministic grader (substring/regex, no second model)
  chat-cases.json       Reviewed cases. A person reads every one; a model only drafts them
  draft-chat-cases.ts   Model drafts cases from the prompt + pages into chat-cases.draft.json
```

## Commands

```bash
npm run dev      # Angular :4200 + Hono :4318
npm run build    # Angular prerender + tsc server + chat index + sitemap
npm start        # Serve the production build
npm run check    # design-system lock + contrast, raw colours, tsc, unit tests, ng build — run before every commit
npm run lint
npm test         # the key-free unit tests (scripts/, client/)
npm run check:design-system  # the vendored copy matches its lock; 2,412 contrast pairs
npm run check:colours        # no #hex / rgb() / hsl() in client/ (use design-system tokens)
npm run test:chat        # After a build: ask the real assistant every case in evals/chat-cases.json
npm run test:chat:draft  # After a build: model drafts cases into evals/chat-cases.draft.json
```

Both `test:chat` scripts call the gateway with `GATEWAY_API_KEY`, so they cost money per run and
need `npm run build` first (the assistant reads the prerendered pages). `check` runs neither,
but it does type-check `evals/` and run the grader's own tests (`evals/chat-cases.test.ts`, no
key needed), so a grader edit that makes it pass everything fails `check`.

`check` runs neither script in `scripts/`, and its `ng build` wipes `dist/client/browser`
(so no sitemap afterwards). After touching either script, run it by hand and look at the
output in `dist/`. Adding a page = route in `app.routes.ts` + link in `nav-items.ts` + a
line in `STATIC_PAGES` (`generate-sitemap.mjs` warns if you forget the last one).

## Cornell design system

The look is the Cornell design system, vendored in `design-system/` with its skills in
`.claude/skills/cornell-*`: a byte-identical copy of cu-aaii/cornell-design-system at the commit in
`design-system.lock.json`. Start at `design-system/COMPONENTS.md` (every block and its markup).

- **Never edit `design-system/` or `.claude/skills/cornell-*`.** `check` fails on any change. Fix it upstream,
  then `npm run sync:design-system -- --ref <sha>`. After a template starts or stops using a `cu-*` class, run
  `node design-system/tools/inventory.mjs` (COMPONENTS.md lists this app's uses; `check` fails until you do).
- **The look** (header style, navigation, headings, first-visit colour mode, the footer's Appearance switch) is
  one object, `provideLook({...})` in `client/app/app.config.ts`. Pick it in
  `design-system/showcase/customizer.html` (open it in a browser). No theme files of the app's own.
- **Use a block before writing CSS**: `cu-button`, `cu-container`, `cu-notice`, `cu-band`, … Component CSS uses
  the design system's tokens only (`var(--color-ink)`, `var(--space-4)`): no raw colours, so dark mode works.
- **Global CSS** goes in a layer (`client/app/shared/theme/layers.css`): never an unlayered file in `angular.json`.
- **Logos and icons** come from the sprites in `client/index.html` (`<use href="#cu-seal">`,
  `<svg appIcon="send">`). Never redraw "Cornell University"; the seal and the wordmark never appear together.

## Transcript log

`CHAT_TRANSCRIPT_LOG=true` (default off) makes the chat router write one JSON line per turn to
stdout: `event: "chat.transcript"`, `conversationId`, `turn`, the last user message, the final
assistant text (each capped at 8,000 characters, with `truncated`), tool names, model, token
counts, `cachedInputTokens` and `cacheReported` (true only if the gateway sent
`prompt_tokens_details.cached_tokens` or
`cache_read_input_tokens`; the SDK reports 0 otherwise), `msToFirstChunk` (request
to first text chunk, `null` if none) and `msTotal`, `sha`, `ts`. Never add an IP, NetID, email or header to it,
and never log earlier turns.
The client sends a conversation id as `body.id`; `ChatEngineService.clear()` starts a new one.
`GET /api/chat/config` reports `transcriptLog` so the UI can say chats are saved. Tests:
`evals/transcript-log.test.ts` (no key needed).
When `transcriptLog` is true the chat shows "Test version: conversations are saved for review." above the input
(`client/app/shared/components/chat/transcript-notice.component.ts`, placed in `chat-panel.component.ts`); false or
a failed config fetch shows nothing.

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
- Reuse the design system's blocks and tokens, then the shared components, before writing new styles;
  never a raw colour (`npm run check:colours`)
- `/api/chat` is public and paid per request: keep the rate limit, size caps and prompt
  guard rails. The CSRF check is opt-in (`CSRF_ENABLED=true`, off by default) — don't
  remove it, and don't key it on NODE_ENV; never register a content root holding anything internal;
  never commit a key (`.env` is git-ignored)
- `evals/chat-cases.json` is what a person signed off on. When `test:chat` fails, fix the
  prompt or the pages, not the case, unless the person agrees the case is wrong; never replace
  the file with an unreviewed draft

## Longer guides

Task-specific instructions live under `.claude/skills/` (the folder name is Claude
Code's convention; the files are plain Markdown any agent can read):

| Guide | Read it when |
|---|---|
| [Angular Component](.claude/skills/angular-component/SKILL.md) | Creating or refactoring a component (signals, host bindings, a11y) |
| [Cornell Components](.claude/skills/cornell-components/SKILL.md) | Building any page or UI: which design-system block to use |
| [Cornell Branding](.claude/skills/cornell-branding/SKILL.md) | Colours, logos, header, footer, dark mode |
| [Cornell Accessibility](.claude/skills/cornell-accessibility/SKILL.md) | Any interactive element, focus, ARIA, an axe finding |
| [Cornell Look](.claude/skills/cornell-look/SKILL.md) | Changing the header style, navigation, headings or colour mode |
