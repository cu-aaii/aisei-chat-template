# aisei-chat-template

A starter website with a built-in AI chat assistant, from the Cornell AI Innovation Hub.
Clone it, run two commands, and you have a Cornell-themed site with a working
assistant that can answer questions about your own pages. Then make it yours.

What's in the box:

- **Two pages** — a landing page and an About page — inside the Hub's header and footer.
- **A chat assistant** in the bottom-right corner. It streams answers from a model on
  Cornell's AI gateway and can search and read the site's own pages to answer from them.
- **An embedded events widget** on the home page, as a worked example of dropping a
  third-party `<script>` widget into an Angular page.

Stack: Angular 22 (standalone components, signals, prerendered to static HTML) on the
front, [Hono](https://hono.dev) on Node 24 on the back, the
[Vercel AI SDK](https://ai-sdk.dev) for streaming chat.

## Quick start

You need Node 24 or newer.

```bash
npm install
cp example.env .env        # then put your gateway key in GATEWAY_API_KEY (optional)
npm run dev
```

Open http://localhost:4200. Angular serves the pages on 4200 and proxies `/api/*` to the
Hono server on 4318.

**No key yet?** Leave `GATEWAY_API_KEY` blank. Everything still runs; the assistant just
replies that it isn't configured. Get a key from the Cornell AI Platform
(https://ai.it.cornell.edu) and restart `npm run dev`.

**Never commit your key.** `.env` is in `.gitignore`. `example.env` is not — keep it blank.

## Other commands

| Command | What it does |
|---|---|
| `npm run build` | Production build into `dist/` (prerendered pages, compiled server, chat index, sitemap) |
| `npm start` | Run the production build on `PORT` from `.env` |
| `npm run run:local` | Build, then start |
| `npm run check` | Type-check the server and build the client |
| `npm run lint` | ESLint over the client |
| `docker build --target app -t my-site . && docker run -p 8000:8000 -e GATEWAY_API_KEY=... my-site` | Run it in a container |

## Where to change things

| You want to… | Edit |
|---|---|
| Change the home page | `client/app/features/public/home/home.component.ts` |
| Change the About page | `client/app/features/public/about/about.component.ts` |
| Add a page | Copy the About component, add a route in `client/app/app.routes.ts`, a link in `client/app/shared/layout/public/nav-items.ts`, and a line in `STATIC_PAGES` in `scripts/export-chat-content.mjs` |
| Change the header or footer | `client/app/shared/layout/public/public-masthead.component.ts`, `site-footer.component.ts` |
| Change colours and fonts | `client/app/shared/theme/variables.css` |
| Change what the assistant says and refuses | `server/modules/chat/prompt.ts` — start with `SITE_NAME` and the `<scope>` block |
| Change the model or rate limit | `server/app.config.ts` |
| Give the assistant structured data | `scripts/export-chat-content.mjs` + `server/modules/chat/content-roots.ts` (comments in both explain how) |
| Add a tool the assistant can call | `server/modules/chat/tools/` — copy `search-content.ts`, register it in `chat.routes.ts`, label it in `tool-labels.ts` |
| Show a different events calendar, or remove it | `client/app/shared/components/localist-events-widget/localist-events-widget.component.ts`, or delete the section in the home page |

## How the assistant works

1. The browser widget (`client/app/shared/components/chat-dialog/`) sends the
   conversation to `POST /api/chat`.
2. The server (`server/modules/chat/chat-router.ts`) forwards it to the Cornell AI
   gateway with a system prompt and two tools, and streams the reply back as it arrives.
3. When the model needs facts, it calls `search_content` / `read_content`, which read
   the prerendered HTML pages in `dist/client/browser` — so the assistant can only talk
   about what your site actually says. Run `npm run build` (or `npm run dev`) after
   changing page text so it sees the new version.

`/api/chat` is public and costs money per request, so the template ships with guard
rails you should keep: a per-IP rate limit (15 requests/minute), size caps on each
request, a CSRF check (`server/middleware/csrf.ts`), a system prompt that keeps the
assistant on topic, and a `CHAT_ENABLED=false` kill switch.

Only ever let the assistant read content you would publish. If you add a content root,
don't point it at notes, source code, or anything internal.

## Project layout

```
server/
  index.ts, app.ts        Hono entry + middleware (order matters; comments say why)
  app.config.ts           PORT / GATEWAY_API_KEY / CHAT_ENABLED; everything else is a constant
  middleware/csrf.ts      CSRF protection for /api/chat
  modules/chat/           The assistant: router, prompt, rate limit, tools
client/
  app/app.routes.ts       Routes
  app/features/public/    home/, about/
  app/shared/layout/      Header, footer, page shells
  app/shared/components/  hero, button, icon, wordmark, chat panel + widget, events widget
  app/shared/theme/       CSS variables, fonts, typography, utilities
scripts/                  Build steps: chat page index, sitemap
.claude/skills/           Longer task guides for AI coding agents (plain Markdown)
```

## Working with an AI coding agent

`AGENTS.md` tells an AI coding agent how this repo is put together and which rules to
keep: stack, layout, commands, component conventions, and the chat guard rails. Most
agents (Codex, Cursor, Copilot, Gemini CLI, ...) read it automatically; `CLAUDE.md` just
imports it for Claude Code. Open the folder in your agent and ask for what you want
("add a Team page with three cards", "make the assistant also answer from a FAQ list").
If you change how the project works, update `AGENTS.md` so the next agent knows.

## License

The code is MIT — see `LICENSE`. That grant covers the code only:

- **Branding.** The Cornell name, seal, and logos in `client/assets/branding/` are
  Cornell trademarks and are not covered by the MIT license. This theme is meant for
  Cornell applications; follow Cornell's brand guidelines (https://brand.cornell.edu).
  If you are building something that is not a Cornell application, replace them.
- **Fonts.** `client/index.html` loads freight-sans-pro from Cornell's Adobe Fonts
  (Typekit) kit. The fonts are licensed by Adobe to Cornell, not by this repository.
  Outside Cornell, swap the `<link>` for your own kit or a free font; the metric-matched
  fallback in `client/app/shared/theme/fonts.css` keeps the layout stable either way.
