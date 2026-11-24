---
name: cornell-branding
description: The Cornell brand rules every page, component and screen must follow (colours, type, logos, headers, footers, surfaces, dark mode, density). TRIGGER when building or restyling any UI, adding a colour, font, logo, header, footer or icon, or when a design looks "off brand". DO NOT TRIGGER for server code, or for choosing the header style of an app (use cornell-look).
---

# Cornell branding

The brand is already built into `design-system/` (tokens, themes, blocks). Your job is to use it, not to
re-decide it. Source: the Cornell brand book (brand.cornell.edu) and the Cornell Design System (CDS) at
`design-system-source/cds-full/`. Full detail: `design-system/README.md` ("Branding rules built in").

## Rules

1. **Colour comes from tokens, never from a literal.** Use `var(--color-*)`, `var(--cu-*)` and the other tokens in
   `design-system/tokens/`. No `#hex`, `rgb()` or named colours in a component, template or stylesheet. A token flips
   in dark mode by itself (`light-dark()`); a literal does not, and is the usual cause of "unreadable in dark mode".
2. **Never invent a hue.** Primary: carnelian `#B31B1B`, white, dark gray `#222222` (about 20 / 55 / 15% of a design).
   Secondary: light gray `#F7F7F7`, dark warm gray, sea gray (about 7%). Accents (link blue `#006699`, green, orange,
   secondary red, navy) about 3%, never the main colour of a unit. Primitives with `-graphic` are for graphics only,
   `-large` for large text only: `tools/check.mjs` fails a misuse.
3. **Logos.** Carnelian, black or white only. The seal and the wordmark never appear together.
   - **Home header**: seal + title, no wordmark, and **no top bar**: only the 4px carnelian line (utility links, if any, go in the menu on a phone and are left out on the home page; `look.topBar: 'line'` is the default). Never put the small red bar on a home page.
   - **Inner-page header**: the Cornell wordmark ("mini logo") in the bar + title, no seal.
   - Apps use the inner header's bar (`.cu-app`). Use the sprite symbols (`#cu-seal`, `#cu-wordmark`), never a re-drawn logo.
4. **Fonts.** Cornell's Typekit kit (Freight Text serif for h1 to h3, Freight Sans for h4 to h6 and body). Page head must
   carry `<link rel="stylesheet" href="https://use.typekit.net/nwp2wku.css">`. `data-headings="sans"` is the only
   sanctioned switch. Do not add another font family.
5. **Surfaces are flat, square and bordered.** Controls and cards have no rounding (`--radius-control` and `--radius-card`
   are 0). Gradients exist only in documented variants (the photo scrim, `cu-nav--gradient`, `cu-backdrop--gradient`).
   Shadows are for things that float (overlays, the chat). Links are always underlined.
6. **Use a block before writing CSS.** Check `design-system/COMPONENTS.md`. If a block exists, use it as documented in its
   header comment. If none fits, build from tokens and say so in the PR: do not copy a Material look.
7. **Status is never colour alone** (a symbol and a word: `.cu-badge`, `.cu-notice`, `.cu-kind`). Text tones (soft, dim, red)
   are fixed tokens, not options: they were chosen for contrast.
8. **Icons**: one set, Material Symbols Outlined weight 300, from the sprite: `<svg class="cu-icon" aria-hidden="true"
   focusable="false"><use href="#cu-i-NAME"/></svg>`. In Angular, `<mat-icon>` is still used (same names); an icon on its
   own sits in a button or link that has a text name.
9. **Footer.** Required links: Cornell University copyright, University Privacy, Web Accessibility Assistance (the TDX
   request form, `https://tdx.cornell.edu/TDClient/39/Portal/Requests/ServiceDet?ID=373`). Use `.cu-footer`. Visitor preferences (Appearance, Density) go in the content band above the legal line, in a second column (`cu-footer__secondary`), never in the sub-footer. Markup order is the phone order: primary content first, then the preferences.
10. **Density.** Websites use the website scale. Apps and dashboards use `data-density="compact"` on `<html>` (the Angular
    shell sets it). Phones keep the website scale and 44px targets on coarse pointers.
11. **Dark mode** uses the CDS neutrals (`#222222`, near-white text, white links) and adds no new hues. Always check a
    screen in light and dark.
12. **No Sass.** Plain CSS only, in `@layer`. The design system's layer order is `tokens < base < blocks < utilities`.

## What the look options are

An app's header, banner photo or slideshow, navigation style, headings and colour mode are chosen once, in
`provideLook({...})`: see the `cornell-look` skill. Do not hand-style the header to get a different look.

## Prove it

`node design-system/tools/check.mjs --manifest` checks every contrast pair (2,400 across 6 themes and 2 modes), the logo
colours, the breakpoints, and that no block hard-codes a colour. `npm run verify` runs it with the rest.
