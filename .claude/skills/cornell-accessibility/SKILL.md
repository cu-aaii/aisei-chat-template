---
name: cornell-accessibility
description: The web accessibility (WCAG 2.2 AA) rules this design system was built and tested to, written as rules for agents building or changing UI. TRIGGER when adding or changing any interactive element (button, link, form, menu, dialog, tabs, carousel, video, table, chat, focus handling, tabindex, ARIA), or when fixing an axe or screen reader problem. DO NOT TRIGGER for server code.
---

# Cornell accessibility

Everything below was applied in this system and is proven by two suites: `design-system/tools/check.mjs` (colour) and
`design-system/tools/a11y.mjs` (a real browser: 1,165 checks, plus axe on every showcase page in 6 themes x 2 modes).
Reference behaviour for every widget is `design-system/showcase/showcase.js`. Reproduce it, do not improvise.

## Native first, ARIA only where needed

- Use the native element: `<button>`, `<a href>`, `<details>`, `<dialog>`, `<input type=radio>`. They carry keyboard and
  screen reader behaviour for free. A `div` with a click handler is a bug.
- ARIA names and states only when HTML cannot say it: `aria-label` or `aria-labelledby` to name, `aria-expanded` and
  `aria-controls` on disclosure buttons, `aria-current` on the current page or slide dot, `aria-selected` on tabs,
  `aria-invalid` with `aria-describedby` on a field error.
- No redundant roles (`nav role=navigation`). The one deliberate exception is `ul role="list"` where CSS removes
  the bullets (Safari drops the list semantics otherwise).
- `aria-hidden="true"` only on decoration (icons, background pictures, duplicate image links), never on anything focusable.
- Live regions are rare. `role="status"` for a toast or update, `role="log"` for the chat transcript, one quiet status line
  for chat movement (speaks only at an edge or on return to the corner). A slideshow has no live region while it autoplays.

## Names (4.1.2, 2.5.3)

- Every control has a name. **The visible text must be contained in the accessible name**: a button that shows "Pause
  video" is named "Pause video", not "Stop media". An icon-only button needs an `aria-label`.
- An icon font ligature counts as text for axe: `<mat-icon>edit</mat-icon>` inside a button named "Set address" fails the
  label-in-name rule; "Edit address" passes. Prefer SVG sprite icons.
- Repeated landmarks need distinct names (`Main: Home header` on the headers page; `Utility`, `Main`, `Footer`).
  One `main`, one `h1`, no skipped heading levels, a skip link as the first tab stop.

## Focus and tab order

- **The ring is the design system's.** `outline: 3px solid var(--color-focus)` plus the halo. Never set an outline colour
  literally (a fixed blue once left the dark-mode ring at 1.9:1; `focus-ring.test.ts` guards it), never `outline: none`,
  never restyle focus per component.
- **Tab order follows the page.** No `tabindex` above 0, ever. `tabindex="0"` is allowed only on: a tabpanel with no
  focusable content, and a scrollable region *while it scrolls* (`ScrollRegionDirective` in Angular, `initScrollRegion` in the
  showcase; the region keeps `role="region"` and a name). `tabindex="-1"` is for programmatic focus targets: `main`, dialog
  and overlay panels, and decorative duplicate links (with `aria-hidden`).
- **Roving tabindex only in the standard patterns**: a tablist (one tab stop, arrows move, Home/End), a radio group (native),
  and menus with the CDS arrow-key model. Nothing else gets arrow-key handling. Do not rewrite tab order to be "helpful".
- **Focus never leaks.** An overlay moves focus in, keeps it in, and returns it on close. Modal overlays (dialog, the phone
  menu, the chat on phones): Tab wraps, the page behind is `inert`, `aria-modal`. Non-modal (the chat on desktop): Tab wraps
  inside, Escape is the way out, the pointer still reaches the page. The panel has `tabindex="-1"`, so a click on blank space
  inside it keeps focus there. Helpers: `modalPanel`, `wrapTab`, `pageBeside`, `setInert`.
- Safari does not focus a button on click: focus it yourself on pointer down when it must keep focus (the chat grip does).
- A control that moves something (the chat grip) must be a button with a text name and arrow keys: drag is never the only way.

## Moving content (2.2.2) and motion

- Anything that moves for more than 5 seconds has a pause control that works, always. Slideshows, sliders and video have
  one; autoplay stops for good once any control is used or focus enters it; it never starts with `prefers-reduced-motion`.
- **A video in a slide has its own text button, "Pause video" / "Play video"**, apart from the slideshow's buttons.
  Videos are muted, loop, `playsinline`, have a poster, no `autoplay` attribute (a still picture without script), WebM first
  and MP4 second, and a decorative video is `aria-hidden="true"`.
- Captions stay in the page, reachable (linked headings); focusing one shows its slide (CDS pattern). Slides that are not
  shown are transparent, never `inert` or `visibility:hidden`.
- Reveals and parallax: shown at once for reduced motion and print; focus inside reveals.

## Size, colour, reflow

- Targets at least 24px (2.5.8), 44px on coarse pointers (`--target-min`).
- Contrast: every text and UI pair is in the token files as `@pair` and checked in 12 combinations. Use tokens, never
  literals. Status is never colour alone. The focus ring and its halo are checked against every surface.
- Reflow at 320px and 200% text with no horizontal scroll; stacking tables respond to their container; text-spacing overrides
  clip nothing; never disable zoom. `forced-colors` and `prefers-contrast` are handled in `base/a11y.css`.
- Tables: `<th scope>`, a caption or label; wide tables sit in a labelled `.cu-table-wrap`.
- Diagrams and charts: a name (`accTitle`) and a text alternative (`accDescr` plus a visible sentence), and colours from tokens.

## Prove it before saying it works

```bash
node design-system/tools/check.mjs --manifest   # colour pairs, token rules
node design-system/tools/a11y.mjs               # real browser + axe (needs playwright and axe-core installed)
npm run verify                                  # lint, tests, build, changelog
```

A new widget needs new checks in `a11y.mjs` in the same change (keyboard, focus, names, reduced motion). Axe passing is the
floor, not the goal: tab through it, and read what a screen reader would say. Do not "fix" an axe finding by deleting the
feature; fix the name or the markup. Known gaps are listed in `design-system/README.md`; say so if you find another.
