# Components: the inventory

<!-- Built by tools/inventory.mjs from blocks/, showcase/, showcase.js and client/app: edit those, not this file. -->

Every block in the Cornell design system, what it is, where to see it and where the Angular app uses it. The rules for using the
blocks are in `.claude/skills/cornell-branding/` and `.claude/skills/cornell-accessibility/`; the header comment of each block file
has its markup pattern and what its behaviour must keep. A block is plain CSS (`@layer blocks`); behaviour is the reference script
`showcase/showcase.js`, which an app reproduces (Angular CDK or a small component) and `tools/a11y.mjs` proves.

39 blocks, 17 showcase pages, 17 reference behaviours.

## Blocks

| Block file | What it is | Root classes | Shown on | Used in the Angular app |
|---|---|---|---|---|
| `blocks/accordion.css` | accordion, built on native &lt;details&gt;/&lt;summary&gt; | `.cu-accordion` `.cu-accordion-set` | gallery, interactive, page, public | - |
| `blocks/app.css` | app shell: the frame for an application or dashboard (not in CDS; CDS frames websites) | `.cu-app` | dashboard | - |
| `blocks/backdrop.css` | media backdrops and banners | `.cu-backdrop` `.cu-banner` | layout | - |
| `blocks/backtotop.css` | back to top (CDS "Back-to-Top Button") | `.cu-back-to-top` | interactive | `shared/components/icon/icon.component.ts`, `shared/components/scroll-to-top/scroll-to-top.component.ts` |
| `blocks/band.css` | bands: full-width regions with their own surface (CDS .band.accent1–7) | `.cu-band` | layout, public | `shared/components/hero/hero.component.ts`, `shared/layout/public/inner-page-layout.component.ts` |
| `blocks/button.css` | button (CDS "buttons and link buttons") | `.cu-button` | customizer, dashboard, forms, gallery, headers | `features/public/home/home.component.ts`, `shared/components/chat/chat-panel.component.ts` |
| `blocks/callout.css` | callout (CDS .block-callout) | `.cu-callout` `.cu-callout-wrap` | layout, page, public | - |
| `blocks/card.css` | card | `.cu-card` | gallery, sliders | - |
| `blocks/cards.css` | cards (CDS .layout-cards) | `.cu-cards` | gallery, layout, page, public, sliders | - |
| `blocks/cardslider.css` | card slider (CDS "Card Slider") | `.cu-card-slider` | sliders | - |
| `blocks/chat.css` | agent chat (not in CDS) | `.cu-chat` | dashboard | `shared/components/chat-dialog/chat-dialog.component.ts` |
| `blocks/columns.css` | column layouts (CDS .layout-1-1 … .layout-1-2-1) | `.cu-columns` | layout | - |
| `blocks/dashboard.css` | dashboard parts for apps (not in CDS) | `.cu-stat` `.cu-badge` `.cu-pane` `.cu-filters` `.cu-page-header` `.cu-empty` | dashboard, forms, gallery, page, public | - |
| `blocks/dialog.css` | modal dialog (CDS "Modal Dialog"), on the native &lt;dialog&gt; element (dialog.showModal()) | `.cu-dialog` | gallery, interactive | - |
| `blocks/field.css` | form controls (CDS values) | `.cu-input` `.cu-select` `.cu-textarea` `.cu-description` `.cu-check` `.cu-form-item` | dashboard, forms, gallery, headers, index | `shared/components/chat/chat-panel.component.ts` |
| `blocks/figure.css` | figure, caption, aside, figure set, receded photo | `.cu-figure` `.cu-figure-set` `.cu-receded` `.cu-aside` | content, sidebars | - |
| `blocks/footer.css` | footer | `.cu-footer` | dashboard, gallery, page, public | `shared/layout/public/site-footer.component.ts` |
| `blocks/form.css` | form, form item, form actions, fieldset (CDS "custom forms" and "fieldsets") | `.cu-fieldset` `.cu-form-actions` `.cu-form` `.cu-sr-only` | customizer, dashboard, decisions, forms, gallery | `shared/components/chat/chat-panel.component.ts`, `shared/layout/site-header/site-header.component.ts` |
| `blocks/grid.css` | 12-column flex grid (CDS .flex-grid) | `.cu-grid` `.cu-col-1` `.cu-col-2` `.cu-col-3` `.cu-col-4` `.cu-col-5` | forms | - |
| `blocks/header.css` | site header, the CDS site banner | `.cu-header` `.cu-utility` `.cu-brand` `.cu-search` `.cu-seal` | dashboard, decisions, gallery, headers, page | `shared/layout/site-header/site-header.component.ts` |
| `blocks/heading.css` | heading variants | `.cu-heading` `.cu-h1` `.cu-h2` `.cu-h3` `.cu-h4` `.cu-h5` | content, gallery, interactive, layout, motion | - |
| `blocks/hovertabs.css` | hover tabs (CDS "Hover Tabs") | `.cu-hovertabs` | interactive | - |
| `blocks/icon.css` | icons: Google Material Symbols (Outlined, weight 300), named exactly as the app's &lt;mat-icon&gt; names (expand_more, verified_user, …), so a name from... | `.cu-icon` | content, dashboard, forms, interactive | `features/public/home/home.component.ts`, `shared/components/icon/icon.component.ts`, `shared/layout/site-header/site-header.component.ts` |
| `blocks/inline.css` | inline text styles: highlights, documentation notes, text tones, code bits, link variants | `.cu-note` `.cu-hl` `.cu-link-quiet` `.cu-text-soft` `.cu-text-dim` `.cu-text-red` | content, page, public | - |
| `blocks/layout.css` | layout primitives | `.cu-container` `.cu-shell` `.cu-with-sidebar` `.cu-stack` `.cu-layout` `.cu-cluster` | content, dashboard, decisions, forms, gallery | `features/public/home/home.component.ts`, `shared/components/hero/hero.component.ts`, `shared/layout/public/inner-page-layout.component.ts`, `shared/layout/public/site-footer.component.ts` |
| `blocks/list.css` | lists | `.cu-list` `.cu-deflist` | content | - |
| `blocks/modeswitch.css` | mode switch: Automatic / Light / Dark as one small segmented control | `.cu-mode-switch` | customizer, dashboard, page, public | `shared/layout/public/site-footer.component.ts` |
| `blocks/motion.css` | motion (CDS "Motion Design") | `.cu-motion-fadein` `.cu-motion-slidein` `.cu-motion-parallax` `.cu-motion-custom` | motion | - |
| `blocks/nav.css` | navigation | `.cu-nav` `.cu-section-nav` `.cu-sidenav` `.cu-nav-toggle` `.cu-breadcrumb` | dashboard, decisions, gallery, headers, interactive | `shared/layout/site-header/site-header.component.ts`, `shared/look/look.ts` |
| `blocks/notice.css` | notice (callout) and badge | `.cu-notice` | gallery, page, public | `shared/components/chat/chat-panel.component.ts` |
| `blocks/panel.css` | panel and pill (non-semantic containers) | `.cu-panel` `.cu-pill` | content, dashboard, forms, layout, sidebars | - |
| `blocks/quote.css` | blockquote | `.cu-quote` | content, page, public | - |
| `blocks/rule.css` | horizontal rules | `.cu-rule` | content, forms | - |
| `blocks/sidebar.css` | page region with sidebars (CDS .region-sidebar) | `.cu-region` `.cu-sidebar` | page, sidebars | - |
| `blocks/slider.css` | image slider (CDS "Image Slider", also the banner slider) | `.cu-slider` | sliders | - |
| `blocks/table.css` | data table | `.cu-table` | dashboard, gallery, page, public, tokens | - |
| `blocks/tabs.css` | tablist (CDS "Tablists") | `.cu-tabs` | gallery, interactive, page, public | - |
| `blocks/toast.css` | update message and toast (CDS .form-updates and .ui-toast) | `.cu-update` | interactive | - |
| `blocks/tooltip.css` | tooltip (CDS "Tooltips") | `.cu-tooltip` | interactive | - |

## Reference behaviours (`showcase/showcase.js`)

The look is CSS; these are the behaviours the app has to keep. Each has tests in `tools/a11y.mjs`.

| Function | What it does |
|---|---|
| `initNav` | Menus and megamenus: disclosure buttons (aria-expanded) with the CDS arrow-key model, Escape closes and returns focus, focus-out closes. |
| `initNavToggle` | The phone menu button: opens the full-screen menu, Escape closes it and returns focus to the button. |
| `initExpandAll` | Expand all / Close all above an accordion set of two or more; added by script so there is no dead button without it. |
| `initTooltip` | Tooltip: hover 150ms or focus opens, hoverable, Escape dismisses from anywhere, aria-describedby on the trigger. |
| `initHoverTabs` | Hover tabs: labels are buttons (aria-expanded, aria-controls); a hidden panel is visibility:hidden so keyboard users never tab into it. |
| `initBackToTop` | Back to top: appears 800px down, moves focus to the target first, then scrolls (smoothly unless reduced motion). |
| `initSlider` | Image slider: persistent captions, focus on a caption shows its slide, Previous / Next / Pause / Play, pips with arrow keys, autoplay never with reduced motion; a slide may hold a video with its own button. |
| `initBackdropVideo` | A backdrop that holds a video: Pause / Play button, never starts with reduced motion, still picture without script. |
| `initCardSlider` | Card slider: native scroll with snap points, Previous / Next / pips added by script, aria-disabled at the ends. |
| `initMotion` | Reveal and parallax: once per element, shown at once for reduced motion and in print, focus inside reveals. |
| `initModeSwitch` | Automatic / Light / Dark: sets data-mode on html and remembers it (key cu-mode). |
| `initApp` | App shell: the side menu hides from 960px (remembered) and is a modal panel below it (focus to Close, Tab wraps, rest inert). |
| `initChatGrip` | Moving the chat: a grip button, arrows 20px (Shift 80px), End returns to the corner, clamped to the window, a quiet status line for edges. |
| `initChat` | Agent chat: launcher opens a non-modal panel, focus to the field, Escape closes and returns focus, Tab wraps inside, modal on phones, messages in a log. |
| `initScrollRegion` | A scrollable region is a tab stop only while its content overflows. |
| `initDensitySwitch` | Showcase only: ?density=compact or a switch, for previewing the app scale. |
| `initBannerSlides` | Slideshow banner: pictures cross-fade behind the header, caption and controls like the slider, Pause always works, a slide may hold a video with its own button. |

## Showcase pages

| Page | Shows |
|---|---|
| `showcase/content.html` | Content: Headings, rules, figures, asides, quotes, panels, pills, lists, icons and inline styles. Every block here is its own file under blocks/. |
| `showcase/customizer.html` | Choose a look |
| `showcase/dashboard.html` | App dashboard |
| `showcase/decisions.html` | Header bars: The top bar that carries the Cornell wordmark comes in the CDS navbar fills. Red is the default; the others are a theme on the header. View at desktop |
| `showcase/forms.html` | Forms: Fieldsets, inputs, errors, checkboxes, radios, selects, grids of fields, and every CDS button colour, size and shape. |
| `showcase/gallery.html` | Gallery: Intro paragraph: a tagline or opening sentence, set lighter and larger. Body text is 16px on phones and 18px from 960px up. |
| `showcase/headers.html` | Headers: Two kinds of site header, as in CDS: the home header (seal) and the inner-page header (wordmark in the bar). Light or dark, and the brand theme, come  |
| `showcase/index.html` | Cornell design system |
| `showcase/interactive.html` | Interactive: Tablists, accordions, hover tabs, tooltips, the modal dialog and back to top. Sliders follow in the next batch. Everything here works with the keyboar |
| `showcase/layout.html` | Layout: Bands, column layouts, cards, callouts, backdrops and banners. |
| `showcase/motion.html` | Motion: Reveals as an element scrolls into view, and parallax (CDS Motion Design). An element reveals once, when its top reaches 85% of the viewport height. |
| `showcase/navigation.html` | Navigation: Every CDS navigation variant: bar tones, alignment, active and hover styles, dropdowns, megamenus, vertical lists and section navigation. Resize below |
| `showcase/page.html` | Content page: Draft, edit and summarise with an AI model that runs under Cornell's data protections. |
| `showcase/public.html` | Public page: Shared tools, patterns and support for teams across campus. Everything here is built from one set of design tokens. |
| `showcase/sidebars.html` | Sidebars: Primary and secondary sidebars, on the left or the right. On phones the primary sidebar (with the section navigation) sits above the article and the s |
| `showcase/sliders.html` | Sliders: The image slider, the banner slider and the card slider. Slides never move on their own for people who ask for reduced motion, there is always a pause |
| `showcase/tokens.html` | Tokens: Every colour, size and space the blocks use. Values below are resolved for the theme and mode selected above. Generated from tokens/ and themes/ by to |

## Tokens, themes and base

- Tokens: `tokens/primitives.css`, `tokens/scale.css`, `tokens/semantic.css` (primitives are the brand-book values; semantic tokens are what blocks use, flipped by `light-dark()`).
- Themes (a `data-theme` on the header or app bar): `blue-bar`, `dark-bar`, `dark-header`, `light-bar`, `red-header`, plus the default carnelian.
- Base: `base/a11y.css`, `base/reset.css`, `base/typography.css`.
- Angular: `client/app/shared/layout/` (site header, public layout and footer, app shell, side menu), `client/app/shared/look/` (`provideLook`), `client/app/shared/services/theme/` (mode and theme), `client/app/shared/directives/` (scroll region).
