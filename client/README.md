# client/index.html — head tag notes

Rationale for a few non-obvious tags, kept out of `index.html` itself so the
production build doesn't ship internal implementation notes to visitors.

## `<meta name="description">`

Default description. Per-route overrides come from `data.description` in
`app.routes.ts`, applied by `SiteTitleStrategy` on each navigation (prerender
included).

## Typekit preconnects

Font origins, each behind a render-blocking stylesheet — warm the DNS/TLS
handshakes up front or they serialize ahead of first paint. `p.typekit.net` is
here because the kit CSS opens with `@import url(p.typekit.net/p.css)`: an
`@import` inside a blocking stylesheet is a *second* blocking round trip that
can't even start until the first finishes, and it lands on an origin the
browser has never seen. Preconnecting it in parallel with the first request
takes the handshake off that second hop.

## Typekit stylesheet link

Cornell freight-sans-pro Typekit kit. The kit ships
`font-display: auto`, which Chrome treats as block — that's set in the Adobe
Fonts kit settings, not overridable from here, so this link has to stay
blocking or text goes invisible rather than merely unstyled. The font stacks
are the design system's (`--font-sans`, `--font-serif`); the app's old
metric-matched `freight-fallback` face was retired in #22, because those
stacks never name it.

A Source Sans 3 stylesheet used to sit here as an off-domain fallback.
Removed: the kit turned out not to be domain-restricted (font files return
200 for any Referer, localhost included), and freight always won the family
match anyway, so Source Sans 3's font files were never once requested — it
was a render-blocking request that changed nothing. The Google Fonts
preconnects went with it.

## `assets/pre-paint.js`

Applies the stored colour mode (`cu-mode`) and theme before first paint, so a
dark-mode visitor never sees a light flash. A file, not an inline script: a
Content-Security-Policy without `'unsafe-inline'` would block an inline one.
`pre-paint.test.ts` keeps its names in step with `ThemeService`.

## The two sprites

The official Cornell seal and wordmark (`#cu-seal`, `#cu-wordmark`), copied
from `design-system/assets/cornell-logos.sprite.html`, and the icons the site
uses (`#cu-i-*`), copied symbol by symbol from
`design-system/assets/icons.sprite.html`. `logo-sprite.test.ts` and
`icon-sprite.test.ts` fail if either drifts. To add an icon, copy its symbol
element here and its name into `shared/components/icon/icon-names.ts`.
