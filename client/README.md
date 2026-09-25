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
blocking or text goes invisible rather than merely unstyled. What paints
during the block period is `freight-fallback` from
`app/shared/theme/fonts.css`, metric-matched so the swap doesn't move
anything.

A Source Sans 3 stylesheet used to sit here as an off-domain fallback.
Removed: the kit turned out not to be domain-restricted (font files return
200 for any Referer, localhost included), and freight always won the family
match anyway, so Source Sans 3's font files were never once requested — it
was a render-blocking request that changed nothing. The Google Fonts
preconnects went with it.
