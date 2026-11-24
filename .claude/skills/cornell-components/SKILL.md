---
name: cornell-components
description: How to find, choose and use the Cornell design system's components (blocks), and how to add one. TRIGGER when building any page or screen, adding a button, form, table, card, tabs, menu, dialog, slider, banner or layout, or asked "is there a component for X". DO NOT TRIGGER for server code.
---

# Cornell components

**Start at `design-system/COMPONENTS.md`.** It is the full inventory, generated from the files (so it is never stale): every
block, what it is, its root classes, which showcase pages show it, which Angular components use it, every reference
behaviour in `showcase.js`, every showcase page, the tokens and the themes. `check.mjs` fails if it is out of date.

## Choosing

1. Find the block in `COMPONENTS.md`. Open its file in `design-system/blocks/`: the header comment has the markup pattern
   and what its behaviour must keep. Open a showcase page it is shown on and copy the working markup.
2. **Native HTML + a block first.** Buttons, links, text inputs, checkboxes, radios, simple selects, tables, tabs,
   accordions, badges and panels are native elements with `cu-` classes: they bring their accessibility with them.
3. **Angular Material only where it earns its place:** select and multi-select, autocomplete, the date picker, menus, dialogs
   and the snack bar. `client/app/shared/theme/design-system-bridge.css` gives them the Cornell look. A `mat-select` is
   `<mat-form-field class="cu-select-look" appearance="outline" subscriptSizing="dynamic">` with a `.cu-label` above it.
4. If nothing fits, compose from tokens and layout primitives (`.cu-stack`, `.cu-cluster`, `.cu-container`, `.cu-grid`). Do
   not copy a look from Material or another library, and do not add one-off colours (see `cornell-branding`).

## Using in Angular

- Components are standalone, signals, `inject()`, native control flow, `host: {}` (no `@HostBinding`). See `angular-component`.
- The page shells are done: `lib-app-shell` (admin), `lib-site-header` and the public layout and footer. Do not rebuild a header.
  The look is `provideLook({...})` (see `cornell-look`).
- Behaviours in `showcase.js` are the reference: reproduce them (CDK or a small component) and keep their keyboard and
  focus rules (see `cornell-accessibility`). One already exists as a directive: `ScrollRegionDirective` for scrollable tables.
- Tables follow "server filtering and pagination only" (see `admin-data-table`).

## Adding a block

1. `design-system/blocks/<name>.css`, inside `@layer blocks`, tokens only, with a header comment: what it is, the markup, what
   its behaviour must keep, and any deliberate difference from CDS and why.
2. Import it in `design-system/index.css`. Give it a section on the right showcase page (or a new page).
3. If it has behaviour, add the reference `init*` function in `showcase.js` and tests in `tools/a11y.mjs`: keyboard, focus,
   names, reduced motion, phone width.
4. Add the function's line to `BEHAVIOURS` in `tools/inventory.mjs`, run `node design-system/tools/inventory.mjs`, and
   `node design-system/tools/check.mjs --manifest`.
5. Update the README section, add a `docs/changelog.d/` fragment, run `npm run verify`, and mirror `design-system/` into the
   factory (`cornell-port`).

## Source of truth for a question

| Question | Look here |
|---|---|
| Is there a component for X? | `design-system/COMPONENTS.md` |
| How is block X marked up? | the header comment of `blocks/X.css`, then the showcase page |
| What does CDS do? | `design-system-source/cds-full/` (`js.html`, `banners.html`, `blocks.html`, the SCSS) |
| What colours or sizes exist? | `showcase/tokens.html`, `tokens/*.css` |
| What must the keyboard do? | `showcase/showcase.js` and the matching tests in `tools/a11y.mjs` |
| Why is it different from CDS? | "Deliberate differences" in `design-system/README.md` |
