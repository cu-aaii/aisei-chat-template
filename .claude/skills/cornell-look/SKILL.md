---
name: cornell-look
description: Apply or change an app's Cornell look (header style, top bar or thin line, banner photo, app bar, headings, navigation, colour mode, footer switch, app density). TRIGGER when the owner hands over a cornell-look.md or a customizer link, or asks to change how the header, navigation, headings or dark mode look. DO NOT TRIGGER for new pages or components (use the design-system blocks).
---

# Cornell look

Every look option lives in ONE object, `provideLook({...})` in `client/app/app.config.ts`. The type, the allowed
values and the defaults are in `client/app/shared/look/look.ts` (`Look`, `DEFAULT_LOOK`). The public header,
its navigation, the footer's light/dark switch, the app shell and `ThemeService` all read it.

## Options

| Key | Values | Default |
| --- | --- | --- |
| `publicHeader` | `cornell` (white banner), `red-header`, `dark-header`, `light-bar`, `dark-bar`, `blue-bar` | `cornell` |
| `topBar` | `line` (the CDS website look: only the 4px red line on the home page), `bar` (a top bar with the utility links the public layout is given; inner pages always have the bar) | `line` |
| `bannerPhoto` | a path (`/images/banner.jpg`) or `https://` URL, or `null`; **an array of two to six** makes a slideshow: the pictures cross-fade behind the banner, each slide may be `{ src, title, text, href, linkLabel }` (headline, text, link), with Previous / Next / Pause buttons and a dot per slide; reduced motion gets the first picture, no autoplay. A slideshow is never shorter than `medium`. **Needs `publicHeader: 'dark-header'`**; with any other header it is dropped | `null` |
| `logoSide` | `'left'` \| `'right'`: which side the Cornell seal sits on in the home banner (the title takes the other side; CDS `logo-right`) | `'left'` |
| `bannerHeight` | `'short'` (the plain banner) \| `'medium'` \| `'tall'`. Needs a `bannerPhoto`; without one it stays `short` | `'short'` |
| `appHeader` | `cornell`, `light-bar`, `dark-bar`, `blue-bar` (no banners: the app shell has no brand zone) | `cornell` |
| `headings` | `serif`, `sans` | `serif` |
| `mode` | `auto`, `light`, `dark` (the first-visit mode; visitors can still switch) | `auto` |
| `modeSwitch` | `true`, `false` (the Appearance switch in the public footer) | `true` |
| `nav` | `{ align: 'start' \| 'center' \| 'end' \| 'even', style: 'tint' \| 'underlines' \| 'red-bar' \| 'red-button', overlay: boolean }`. `red-bar` is a flat red fill; `red-button` makes every link a button with space around it. **`overlay` (a see-through bar on the photo) needs `bannerPhoto`**; without it it is dropped | `start`, `tint`, `false` |
| `appDensity` | `compact`, `website` | `compact` |

## Options that need another option

`bannerPhoto` needs the dark banner, and `nav.overlay` needs `bannerPhoto`. `resolveLook` drops them when the option they need is missing, and the customizer shows them as "not available yet" with the reason and a button that turns the missing option on. If you are asked for one without its prerequisite, set the prerequisite too (or tell the owner).
When the owner gives you a `bannerPhoto` path, make sure the file exists and is dark where the title and navigation sit: the design system cannot test a photograph's contrast, so look at the real page.

## How to apply a choice

1. The owner picks in `design-system/showcase/customizer.html` (open it in a browser, no server). It previews the
   public site and the admin app live, offers recommended combinations, and writes the line to use.
2. Replace the existing `...provideLook(...)` entry in `app.config.ts` with the line from the customizer (or from
   the owner's `cornell-look.md`). Only non-default keys need to be there.
3. Do not set `data-theme`, `data-headings` or `data-density` by hand, add colours, or edit `design-system/`:
   every option already passes the design system's contrast checks, and anything else breaks that guarantee.
4. Check: `npm run verify`, then look at the public home page and `/admin` in light and dark mode against the
   customizer preview.

An option the customizer does not offer is a design-system change, not an app change: raise it with the
design-system owner rather than overriding CSS in the app.
