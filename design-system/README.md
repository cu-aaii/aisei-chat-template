# Cornell design system (modular)

A tokenized, modular rebuild of the Cornell Design System (CDS), as **plain CSS with no build step**,
independent of any application. Open `showcase/index.html` in a browser (double-click it) to see
everything: every block, the two header kinds, brand themes in light and dark mode, phone/tablet/desktop widths, and a
live contrast table.

What it keeps from CDS: the Cornell look and type scale (16px body, 18px from 1024px), the brand palette,
mobile-first breakpoints, the skip link, `sr-only`, visible keyboard focus, native `<details>` and
`<dialog>`, official logo artwork at its required size. What it changes: nothing is hard-coded, themes are
one small file each, every block stands alone, there is no jQuery, no Sass and no `!important`.

## Layout

```
tokens/      primitives.css  semantic.css  scale.css      the only place a raw value lives
themes/      dark-header red-header light-bar dark-bar blue-bar  a theme overrides a few tokens (cornell = semantic.css)
base/        reset.css  typography.css  a11y.css           element defaults + accessibility
blocks/      button field notice card header nav footer tabs accordion dialog tooltip hovertabs backtotop slider cardslider toast motion modeswitch table layout …
assets/      official Cornell seal, wordmark and favicon (the CDS files, unchanged) + one inline sprite that takes its colour from a token
index.css    imports everything in cascade order
showcase/    index.html (frame)  gallery.html  public.html  page.html  dashboard.html  tokens.html  forms  layout  interactive  sliders …
tools/       check.mjs          the checker (node tools/check.mjs)
             build-pages.mjs    builds public.html and page.html from showcase/_pages and showcase/_parts (node tools/build-pages.mjs)
```

## How it fits together

1. **Three tiers of tokens.** Primitives (`--cu-carnelian`, `--gray-600`) are raw values. Semantic tokens
   (`--color-ink`, `--color-primary`, `--color-err`) say what a colour is *for*. Frame tokens
   (`--utility-*`, `--header-*`, `--seal-color`, `--wordmark-color`, `--nav-*`, `--footer-*`) style the page chrome. Blocks use only semantic and frame tokens.
2. **Mode and theme are separate settings.** *Mode* is light or dark: `data-mode="light|dark"`, and when it is
   absent the page follows the operating system. *Theme* is the brand frame (`cornell`, `dark-header`):
   `data-theme`. Any combination works (3 themes x 2 modes, all contrast-checked). Put the attributes on
   `<html>` for a page, or on any element for a region (`<section data-mode="dark">`); custom properties
   inherit, so nothing inside needs to know. This replaces CDS's `.dark` class and its ~230 per-component
   overrides. A colour that differs by mode is written **once**, as `light-dark(light, dark)`, so there is
   no duplicated dark block, and blocks never mention a mode (the checker forbids it).
3. **Cascade layers** (`tokens < base < blocks < utilities`) mean later layers win regardless of specificity,
   so blocks never need `!important` and an app can override anything with an ordinary rule.
4. **Blocks are independent.** Each file in `blocks/` uses tokens and its own `--_*` variables; take the ones
   you need. Naming is `.cu-block`, `.cu-block__part`, `.cu-block--variant`.
5. **Both app shells share one token set.** The public pages use `.cu-header` (home or inner kind); the admin is the
   app shell (`.cu-app`), built on the inner header's bar and `.cu-sidenav`. One theme restyles both.

## Adding a theme

Copy `themes/dark-header.css`, rename it (and the `[data-theme='…']` selector), change the tokens you want using
`light-dark(light, dark)` for anything that differs by mode, add one `@import` to `index.css`, then run
`node tools/check.mjs --manifest`. The checker discovers the theme from the file and checks every contrast
pair in it in both modes; add its name to the list in `showcase/index.html` to preview it.

## The checker

**The two demo pages** (`showcase/public.html`, the home page, and `showcase/page.html`, the content page) are built, not written by hand: `showcase/_parts/` holds the header (`top`), the footer (`bottom`) and each content element (cards, callout, tabs, quote, table, accordion, form, notice, text tones) once, and `showcase/_pages/` lays them out for each page type. Edit a part or a page, run `node tools/build-pages.mjs`, and commit the result; `tools/check.mjs` fails when a built page is out of date. Both pages show the same content, so a change to an element appears on both, and in the customizer's preview.

`node tools/check.mjs` (Node 18+, no dependencies; `--table` prints every contrast ratio, `--manifest`
regenerates `showcase/manifest.js`). It fails on: any contrast pair under WCAG 2.2 AA in any theme and mode
(2,412 checks today); a seal or wordmark colour that is not carnelian, black or white; a graphic-only brand accent used as text colour; non-hex colour tokens; raw colours,
`light-dark()`, `!important`, `#id` selectors, undefined tokens or unlisted breakpoints in `base/` and
`blocks/`; non-token `z-index`; malformed comments.

## Accessibility built in

Contrast pairs for every theme · status is never colour alone (symbol + label) · a 3px focus ring with a halo
that is checked against each surface · skip link · 40px controls, 44px on touch · `prefers-reduced-motion`,
`prefers-contrast: more` and `forced-colors` handled · native `details`/`dialog` · links always underlined ·
tables scroll or stack on phones.

## Switching mode and theme in the app

The system only reads the attributes; something has to set them. In Angular that is one small service that
sets `data-mode` / `data-theme` on `<html>`, stores the choice in `localStorage`, and applies it before first
paint (a few lines in `index.html`) to avoid a flash. "Auto" is simply no `data-mode` attribute. Browser
support: `light-dark()` needs Chrome/Edge 123, Safari 17.5 or Firefox 120 (2024) or newer.

## Accessibility: what is built in

WCAG is more than contrast. CDS gets its accessibility from behaviour as well as colour, and this system keeps
that. Two automated suites guard it: `tools/check.mjs` (colour, no browser) and `tools/a11y.mjs` (a real browser,
1,165 checks plus axe-core on every page in every theme and mode).

| Area (WCAG) | How it is covered | Where |
|---|---|---|
| Skip to content (2.4.1) | `.cu-skip` is the first tab stop, appears on focus, and lands focus on `<main tabindex="-1">` | `base/a11y.css`, every showcase page |
| Focus visible, not obscured (2.4.7, 2.4.11, 2.4.13) | 3px ring plus halo, tested on every tab stop; stretched card links ring the whole card | `base/a11y.css`, `blocks/card.css` |
| Keyboard (2.1.1, 2.1.2) | Native `<details>`, `<dialog>` (focus trap, Esc, focus return); tabs with roving tabindex, arrows, Home/End; nav toggle closes on Esc and returns focus | `showcase.js` is the reference behaviour |
| Names, roles, state (4.1.2) | `aria-expanded`/`controls` on toggles, `aria-current`, `aria-selected`, `aria-invalid` + `aria-describedby`, labelled landmarks and regions | markup patterns in each block's header comment |
| Status messages (4.1.3) | `.cu-notice` with `role="status"` / `role="alert"` | `blocks/notice.css` |
| Reflow and zoom (1.4.4, 1.4.10, 1.4.12) | Nothing needs horizontal scroll at 320px or 200% text; stacking tables respond to their container, not the screen; text spacing overrides clip nothing; zoom is never disabled | tested in `a11y.mjs` |
| Target size (2.5.8) | 24px minimum, 44px on coarse pointers (`--target-min`) | `tokens/scale.css` |
| Motion, contrast, forced colours (2.3.3, 1.4.11) | `prefers-reduced-motion` zeroes durations; `prefers-contrast: more`; `forced-colors` keeps borders and focus | `base/a11y.css` |
| Works without JavaScript | The nav stays open if the script never loads | tested (tabs and the dialog opener do need script) |
| Overlays keep focus (2.1.2, 2.4.3, 2.4.11) | A modal overlay (dialog, phone menu, the chat on phones) moves focus in, wraps Tab inside, makes the page behind inert and returns focus on close. A non-modal one (the chat from 768px) wraps Tab inside it too, with Escape as the way out, and the pointer still reaches the page. Every overlay panel carries `tabindex="-1"`, so a click on blank space inside it keeps focus there and Escape and the wrap keep working | `blocks/chat.css`, `blocks/app.css`, `showcase.js` (one set of overlay helpers, `modalPanel`, `wrapTab`, `pageBeside`, used by `initChat`, `initApp` and the header menu; the image slider and the slideshow banner share one `carousel` core) |
| Colour is never the only signal (1.4.1) | Status uses a symbol and a label as well as a colour | `blocks/notice.css` |

**What the system cannot do for you.** CSS provides the look and the markup patterns; the behaviours above
(tabs, nav toggle, dialog opener) live in the app, where Angular CDK/Material or a small component supplies them.
The Angular wiring must keep these patterns; `a11y.mjs` is how to prove it did.

**Navigation variants** (all on the Navigation showcase page, all one block, `.cu-nav`, with modifiers):
tone (light, dark, red, blue, gradient), alignment (start, center, end) and spread (even, around, between), current-page
style (tint, `--active-red`), hover style (`--accent-red`), `--tall`, `--underlines`, dropdown menus (`--menu`, three
levels), megamenu (`--mega`, plus `--mega-headings` and `--mega-merge`, with a feature panel and link descriptions),
`--vertical`, a phone fold button (`.cu-nav-toggle`) and section navigation (`.cu-section-nav`). Menus are
disclosure buttons (`aria-expanded`) with the CDS arrow-key model layered on top; the reference behaviour is `initNav()`
in `showcase.js`. Left out on purpose: the Mega Man easter egg, and the JS-assigned `col1a…` grid cells (the panel
flows its columns with CSS grid, so tab order still follows the columns).


## Branding rules built in

From the Cornell brand book (brand.cornell.edu): primary colours are carnelian `#B31B1B`, white and dark gray `#222222`
(about 20% / 55% / 15% of a design); secondary light gray `#F7F7F7`, dark warm gray, sea gray (about 7%); accents link
blue `#006699`, green, orange, secondary red and navy (about 3%). An accent is never the main colour of a unit.

- Primitives (`tokens/primitives.css`) hold exactly those values. Accents that the brand limits carry the limit in
  their name: `-graphic` (graphic elements only, never text) and `-large` (large text only). `check.mjs` fails a text
  pair that uses either wrongly.
- Logos are carnelian, black or white only (enforced for `--seal-color` and `--wordmark-color` in every theme and mode).
- **Two header kinds, never mixed.** The home header shows the seal with the title; the carnelian bar has no logo. The
  inner-page header shows the Cornell wordmark ("mini logo") in the bar and the title, with no seal. The wordmark is
  not allowed on a home page. Below 960px both collapse to the CDS Search and Menu buttons and a full-screen menu.
- Fonts are Cornell's Typekit kit, as in CDS: add `<link rel="stylesheet" href="https://use.typekit.net/nwp2wku.css">`
  to every page (or the Angular `index.html`). Without it the browser falls back to `sans-serif` and `serif`.
- Dark mode uses the neutrals CDS uses on its dark sections (`#222222`, near-white text, white links). It adds no new hues.

## Header bar and top line

`showcase/decisions.html` shows them.
- **Thin line or top bar.** The home header with no `.cu-utility` is the CDS website look: only the 4px line, with Search as a
  red tab hanging from it. It is the template's default (`topBar: 'line'`); `topBar: 'bar'` adds the utility bar for links and search.
  Inner pages always have the bar (it carries the wordmark).
- **Over a photo.** `dark-header` with `bannerPhoto` puts a picture behind the banner; with `nav.overlay` (`cu-nav--gradient`) the
  photo runs on behind the navigation too, so the see-through bar has something to sit on. Contrast depends on the picture: keep it dark. The showcase and the customizer stand in three placeholder pictures (`showcase/images/banner-1..3.svg`, picked with `?photo=1|2|3`) so the overlay can be seen without a real photo; they are the same three pictures the sliders page uses, so there is one set of sample pictures.
- **Banner height and slideshow.** With a photo, `bannerHeight` is `short` (the plain banner), `medium` or `tall`
  (`cu-header--medium|--tall`). As in CDS, where the picture is what grows, the seal and title stay at the top and the
  navigation stays under the logo, with the picture below it. `bannerPhoto` may be a list of two to six slides (`{ src, title, text, href, linkLabel }`, or just
  a path): a slideshow (`cu-header--slides`, never shorter than Medium) whose pictures cross-fade behind the whole header
  (decoration, hidden from assistive technology). Under the seal and title, lower than the middle with a clear gap above the navigation, sit the current slide's caption (headline, text,
  link) and its controls: Previous, Next, Pause and a dot per slide, the CDS slider pattern with the same buttons as
  `cu-slider`. Autoplay stops for good after any control or focus in it (the Pause button always works) and never starts
  for people who prefer reduced motion. The seal can sit on the right (`logoSide: 'right'` =
  CDS `logo-right`), on the home banner only.
- **Red top line.** As CDS, the 4px carnelian line runs along the top of the header at every width, except where the bar right under it is carnelian too (it would only make that bar 4px taller). `.cu-header--topline` forces it on a red bar.
- **Bar colour.** Red is the default. `data-theme="light-bar"` (CDS `.navbar.fill`, #ededed, carnelian wordmark), `data-theme="dark-bar"` (CDS `.navbar.fill.dark`, #2b2b2b, white wordmark) and `data-theme="blue-bar"` (the navy of `cu-nav--blue`, white wordmark) on the header.

## Breakpoints

480 · 768 (seal and title side by side) · 960 (desktop header and navigation; below it the menu collapses to the overlay) · 1024 (larger type, wider container padding) · 1200 · 1440. These are the widths where CDS itself changes. Media queries cannot read custom properties,
so these are written out and enforced by the checker (max-width queries use the value minus 1px).

## Using it in the Angular app

Wired in on `redesign`. `angular.json` loads `client/theme.css` (Material), `client/app/shared/theme/layers.css`
(puts the app's older theme files into layers below and above this system), `design-system/index.css`,
`client/app/shared/theme/design-system-bridge.css` (maps Material's `--mat-sys-*` and component tokens onto these
tokens and restores the per-mode `color-scheme`), then `client/styles.css`. The shells use the blocks directly:
`lib-site-header` (`client/app/shared/layout/site-header/`) renders `.cu-header` + `.cu-nav` and does the menu
overlay's focus, inert and Escape handling; the public footer is `.cu-footer`; the admin frame is the app shell
(`lib-app-shell`, below).
`ThemeService` sets `data-mode` / `data-theme` (Admin → Settings and the public footer's `.cu-mode-switch`);
`client/index.html` holds the logo sprite, the pre-paint script and the Material Symbols font (weight 300) that
`mat-icon` uses.

## Choosing a look: the customizer

`showcase/customizer.html` lets an app owner pick every look option (public header style, the top of the home page
as the CDS thin line or a top bar, a photo behind the dark banner, app bar, headings, navigation alignment, current-page
style including red buttons, navigation over the photo, first-visit colour mode, the footer's light/dark switch, app
density) from recommended combinations or one by one, with the public site and the admin app previewed live at desktop,
tablet and phone widths, in light and dark. The default is the CDS website look: a white banner under the thin red line.
Some options need another one (the photo needs the dark banner; navigation over the photo needs the photo). Those stay
visible but unavailable, say why, and carry a button that turns the missing option on; the choice is kept and comes
back when the prerequisite does. Changing an option that lives on the other side (the admin app, or the public site)
switches the preview to it, so a change is never made out of sight. It writes the one line the app needs (`provideLook({...})` in
`client/app/app.config.ts`), a shareable link, and `cornell-look.md` for the implementing agent. The skill
`.claude/skills/cornell-look/` tells agents how to apply it.

## Apps: the app shell, compact density and dashboard parts

CDS is built for websites. An app or dashboard carries many more elements and is for scanning and working, so the
system adds an app layer on top. It is **additive**: nothing on the public pages changes, and every app part is built
from CDS parts, so the brand is the same (Freight, the Cornell wordmark and carnelian bar, link blue, square and flat
surfaces, the same focus ring and contrast pairs). Reference page: `showcase/dashboard.html`.

- **Compact density** (`tokens/scale.css`): `data-density="compact"` on `<html>` or any container re-points the
  scale tokens only (body 15px, tables and secondary text 14px, nothing under 13px, a shorter heading scale, about
  3/4 the spacing, 32px controls). Every block tightens without being rewritten. Phones keep the website scale and a
  coarse pointer keeps 44px targets. The Angular app shell sets it on `<html>` (so Material overlays follow).
- **App shell** (`blocks/app.css`, `.cu-app`): the CDS inner header's carnelian bar with the wordmark and utility
  links, a slim title bar with the menu toggle, then `.cu-sidenav` (grouped, with headings) beside a full-width main.
  The toggle says "Menu" in visible text and swaps its icon with the state (open-menu icon while shown, plain menu icon while hidden; the name stays "Menu", `aria-expanded` carries the state). From 960px it hides or shows the menu (remembered as `cu-app-nav`); below it the menu is a modal panel
  (focus to Close, Tab kept inside, the rest inert, Escape / Close / scrim return focus to the toggle). Without
  script the menu is always shown. Angular: `lib-app-shell` + `AppShellService`.
- **Dashboard parts** (`blocks/dashboard.css`): page header (title, tags, meta, actions), `.cu-lead` (reading
  width), stats (a `<dl>`; a state is a badge, a word, never only a colour), panes (header, count, meta, filters,
  body), the filter bar (CDS fields with the label above, buttons on the fields' bottom edge), the empty state,
  `.cu-badge--plain` (dot and word, for priority and urgency), `.cu-kind--project` / `--initiative` (the two kinds of
  work, marked the same way everywhere), and app table extras (`.cu-table--app`, `.cu-num`, `.cu-cell-sub`,
  `.cu-cell-aside`, `.cu-clamp`, `.cu-table-wrap--scroll` for a header that stays in view).
- **Agent chat** (`blocks/chat.css`, `.cu-chat`): a launcher fixed in the bottom corner and the non-modal chat
  panel it opens; the page keeps room under its last row and focus never scrolls under the launcher.

**Native HTML first, Material where it earns its place.** Buttons, links, text inputs, checkboxes, radios, simple
selects, tables, tabs, accordions, badges and panels are native elements with these blocks: they bring their
accessibility with them and CDS already has the look. Angular Material stays only for select and multi-select,
autocomplete, the date picker, menus, dialogs and the snack bar; `design-system-bridge.css` gives those the CDS look
through Material's own CSS tokens (square, Freight, link blue, a hairline and a light lift for overlays, the density's
heights, one focus ring) with ripples switched off. A `mat-select` looks like the CDS select with
`<mat-form-field class="cu-select-look" appearance="outline" subscriptSizing="dynamic">` and a `.cu-label` above it
(`aria-labelledby`), never a floating `<mat-label>`. All of it is plain CSS: no Sass.

## Icons

One set: Google Material Symbols (Outlined, weight 300), the same family the app already uses through `<mat-icon>`, with the same names.
Self-hosted as an SVG sprite (`assets/icons.sprite.html`, pasted once per page): no Google Fonts request, `currentColor` so icons follow text and mode, and decorative by default.

```html
<svg class="cu-icon" aria-hidden="true" focusable="false"><use href="#cu-i-expand_more"/></svg>
```

Migrating from the app: `<mat-icon>expand_more</mat-icon>` becomes the line above; a name that comes from data or a signal is bound as `[attr.href]="'#cu-i-' + name"`.
An icon on its own (no visible text) belongs in a button or link that carries the text label. Add an icon by copying its path from `@material-symbols/svg-300`. The only other font is the Cornell.edu glyph font (`assets/fonts/`, opt in) for brand and social marks Material does not have.

## Forms and buttons

Class-based and matched to CDS: `blocks/field.css` (inputs, textarea, select with the CDS blue band, 18px checkbox and radio, file input, descriptions and errors), `blocks/form.css` (form, form item, form actions, fieldsets: default, semantic, nested, hidden legend), `blocks/grid.css` (the 12-column grid forms use for side-by-side fields), `blocks/button.css` (all CDS colours, sizes, shapes, finishes and icon placement).
Deliberate differences from CDS, all for contrast: placeholder text is darker (CDS #aaa fails 4.5:1), the light-red and green hover colours are darker rather than lighter (the CDS ones fail), and a button never drops below the 24px target size. Secondary, quiet and danger buttons are app extensions beyond CDS.
Showcase: `showcase/forms.html`.

## Layout

Page: `showcase/layout.html`.

| Block | Classes | CDS source |
|---|---|---|
| Bands | `cu-band--accent1…7` (aliases `--blue`, `--gray`, `--dark-gray`, `--charcoal`, `--white`, `--near-black`, `--black`), `cu-band--padded[-small\|-medium\|-large]` | `.band.accent*`, `.padded*` |
| Columns | `cu-columns cu-columns--1-1 … 1-2-1` with `cu-columns__section` | `.layout-*` |
| Cards | `cu-cards`, `--tiles`, `--no-overlay`, `--max-1/2/4/4-2/3-1`, `--one-plus-max-3/4`, `--animate`, `--collapse` | `.layout-cards` |
| Callout | `cu-callout` (+ `cu-callout-wrap` for the container query) | `.block-callout` |
| Backdrop | `cu-backdrop`, `--overlay`, `--gradient`, `--dark`, `--to-top`, `__pause` (video only) | `.media-backdrop` |
| Banner | `cu-banner`, `--short`, `--tall`, `--tall-16x9`, `__caption` | `.responsive-banner` |

A backdrop can hold a `<video>` instead of an `<img>` (muted, looping, `playsinline`, a poster, no `autoplay` attribute; list WebM first and MP4 second). Without script it is a still picture. The page script adds the Pause / Play button and starts the video unless the person asks for reduced motion; pausing stays until the button is used. Keep the clip around 1280px wide with no sound track (`showcase/images/video-demo.*`: 217 KB WebM, 652 KB MP4, from the 23 MB CDS demo), use `--overlay` so text stays readable, and mark a decorative video `aria-hidden="true"` (or give an informative one an `aria-label`).

Dark bands and dark backdrops set `color-scheme: dark`, so everything inside them uses its dark-mode values without extra classes.

Deviations from CDS, on purpose:
- Card breakpoints 1080 and 1400 became 1024 and 1440, so the system keeps one breakpoint scale.
- The pause button is 40px with a surface-coloured ring and ink glyph (CDS draws a white ring on any image, which fails 3:1 on light washes). It is a real button with `aria-pressed`.
- Card listing images are `aria-hidden` links with `tabindex="-1"`; the title link is the one stop per card.
- The scrolling card slider is in the Sliders section below.

## Interactive blocks

Page: `showcase/interactive.html`. The look is CSS; the behaviour is the reference script in `showcase/showcase.js`, which
the app must reproduce (Angular CDK or small components) and `tools/a11y.mjs` proves. Everything works with the keyboard alone.

| Block | Classes | Behaviour (kept from CDS unless noted) | CDS source |
|---|---|---|---|
| Tablist | `cu-tabs`, `--navbar`, `--lined`, `--dark`, `--large` | ARIA tabs: arrows move focus and wrap, Home/End, Enter/Space select, roving tabindex, hidden panels. Sizes are the measured CDS boxes: default (CDS `.tabs-classic`) tabs 0.4em/1.25em padding and about 6px apart; navbar 20/40/60px apart at phone/768/1024; `--large` is CDS `.large` on the tablist (18, 20 from 1024, 24px from 1200); lined tabs touch, with the rail under them and 15px below it | `.ui-tabs`, `.tabs-navbar`, `.lined-bottom`, `[role=tablist].dark` |
| Accordion | `cu-accordion` (+`-set`), `--compact`, `--classic`, `--simple`, `--menu`, `--no-bg`, panel `--accent` / `--slide` | native `<details>`; shared `name` = single select; as in CDS every set of two or more (not single-select) gets Expand all / Close all at the top, added by script (`data-expand-all="false"` opts out) | `details`, `.accordion-set`, `.no-background` |
| Hover tabs | `cu-hovertabs`, `--right`, `--red`, `--small`, `__label` (`--rad`), `__panel`, `__content` (`--plain`) | Two kinds, either on the left or right. **Content tabs**: the labels are buttons with `aria-expanded`/`aria-controls`, and the panel holds a heading, text and a CTA (add a visually hidden "Learn more about" before it) over a 55% tint across the whole picture. Tab goes from a label into its panel; below 768px the labels hide and the panels stack. **Link tabs**: each label is the link and its panel is a bare picture (no tint, no tab stop). A carnelian underline grows under the current one, and `--rad` adds an arrow on hover (otherwise a boxed arrow from 960px). Below 768px each link becomes a black bar over its picture. Both: 100ms hover or focus; tighter padding from 6 and from 8 labels | `.ui-hover-tabs` (`tabs-right`, `active-tab-red`, `.rad`, `no-bg-tint`) |
| Tooltip | `cu-tooltip` with `__trigger` (`--info`, `--icon`) and `__tip` (`--bottom`, `--dark`, `--borderless`, `--wide`) | hover 150ms or focus opens; the tip is hoverable and stays open while the pointer or focus is in it; it closes 300ms after both leave; Tab from the trigger reaches a link in the tip; Esc dismisses from anywhere and, from inside the tip, returns focus to the trigger; `aria-describedby`; `role=tooltip` only when the tip holds no link or control; flips and slides to stay on screen | `.tooltip`, `.ui-tooltip` |
| Modal | `cu-dialog` (`__header`, `__body`, `__footer`, `__close`) | native `<dialog>`: Close first, focus kept in, Esc, backdrop click, held Enter ignored, focus returns. Title is the page h2; 30/40px under it, actions 4em below the text, CDS shadow | `.ui-modal` |
| Back to top | `cu-back-to-top`, `--floating` | appears 800px below the top of `<main>`; moves focus to the target, then scrolls (smooth unless reduced motion) | `button.back-to-top` |
| Update and toast | `cu-update` (`__close`, `__content`), `--toast` | polite live region, present and empty from the start; the toast slides in bottom right and closes after 4s unless the pointer or focus is on it (`data-timeout`, 0 = never); Esc or Dismiss closes and returns focus. Shown by confirming the modal, as in CDS | `.form-updates`, `.ui-toast` |
| Motion | `cu-motion-fadein`, `-slidein`, `-custom`, `-parallax`, `+ cu-motion-onload` | reveal once when the top reaches 85% of the viewport (on-load: as soon as it shows); parallax drifts by a quarter of the height. Hidden only after the script marks it (`.is-scripted`); reduced motion shows everything and moves nothing; focus inside reveals; print shows all. `showcase/motion.html` | `.cds-motion-*` |
| Mode switch | `cu-mode-switch` (`__options`) | not in CDS: Automatic / Light / Dark as one radio group (one Tab stop, arrows move); Automatic removes `data-mode`, the others set it and are remembered (`cu-mode`, the app's ThemeService key); takes the footer's colours inside `.cu-footer`; choices drop under the legend on narrow screens | none |

Deliberate differences from CDS, all for accessibility or for there being no jQuery:
- Hover-tab panels that are not showing are `visibility:hidden` (CDS only fades them, so keyboard users tab into invisible links); labels are real buttons, not focusable divs.
- CDS's own `-active-tab-red` hover-tab demos have the class switched off (leading dash), so the default current label is black.
- Tab buttons and the Expand all button are as tall as in CDS (41-46px and 30px), over the 24px AA target, so they no longer carry our 44px minimum.
- Card-slider pips keep 24px targets (CDS dots sit 11px apart, under the 2.5.8 spacing rule); toasts pause while hovered or focused (CDS dismisses after 4s regardless).
- Tooltip placement is computed from the trigger's rectangle and clamped to the viewport; Esc also works with focus anywhere, and does not close a dialog around the tip on the same press.
- The modal is the browser's `<dialog>` (top layer, inert page), not a wrapped `div`; its close button is 28px (44px on touch) and the scrim is one token.
- "Expand all" is added by script, so there is no dead button without script. Single select uses the native `name` attribute (Firefox 130, Chrome 120, Safari 17.2).
- The accordion icons are CDS artwork drawn as masks, so they follow ink and accent colours in light and dark. Dark-mode values for hover tabs, tooltips and the dialog are new (CDS has none): they reuse the CDS neutrals.

## Headings

As CDS (`content/_type-freight.scss`): h1-h3 are Freight Text (serif), h4-h6 Freight Sans; the look classes `.cu-h4`-`.cu-h6` stay sans on any element. `data-headings="sans"` on `<html>` (or any container) is CDS's "use only Sans" switch.

## Sliders

Page: `showcase/sliders.html`. Behaviour: `initSlider()` and `initCardSlider()` in `showcase/showcase.js`.

| Block | Classes | Behaviour | CDS source |
|---|---|---|---|
| Image slider | `cu-slider`, `--banner`, `--reduced-overlay`, `--no-overlay`, `--nav-end`, `--captions-end`, `--captions-center`, `--caption-bottom`; parts `__slides`, `__slide`, `__image`, `__caption` | cross-fade; previous, next, pause/play and a pip per slide, built by script; autoplay with `data-autoplay` and `data-interval` (seconds) | `.cds-slider`, `cds_slider.js` |
| Card slider | `cu-card-slider`, `--max-1…--max-6`, `--side-padding`, `--pips-bottom`, `--pips-large`, `--no-background`; parts `__viewport` (holds a `cu-cards--tiles` list) | native scrolling with snap points; previous, next and a pip per screen added by script | `.card-slider`, `cds_card_slider.js` |

Deliberate differences from CDS:
- **A pause button always exists while a slider can autoplay** (WCAG 2.2.2); CDS has none. Autoplay never starts for `prefers-reduced-motion`, stops for good after any control is used or when focus enters the slider (as CDS), and hovering holds it still.
- As in CDS, every caption stays in the page, reachable and read out: slides that are not showing are only transparent (`opacity:0`, `pointer-events:none`), never `inert` or `visibility:hidden`. Focusing a caption (Tab, or a screen reader moving through the headings) shows its slide and stops autoplay. The controls (and Left/Right, Home, End on a dot) also move between slides; after Previous, Next or a dot a visually hidden status line says "Slide n of N: title". There is no live region, since nothing is added to or removed from the page when a slide changes.
- Without script the image slider shows its first slide and caption and no controls; the card slider is an ordinary scrolling row.
- The card slider has no autoplay, so nothing to pause. Its buttons use `aria-disabled` instead of `disabled` (focus is never lost at either end). It scrolls on phones too, where CDS stacks the cards unless told otherwise. Tabbing to an off-screen card scrolls it into view by itself.
- No random starting slide (CDS default) and no image preloader or buffer layers: slides are ordinary `<img>` elements with real alternative text (empty when the picture is decorative, as in the showcase).
- Card slider buttons overlap the cards' outer edges; `--side-padding` puts them beside the cards. The 1080px and 624px card breakpoints became 1024 and 600.
