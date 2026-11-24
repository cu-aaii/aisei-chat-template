---
name: cornell-port
description: How to port the Cornell design system (from iahub-template, branch redesign) into the live factory console or another app, where to look for answers, and the decisions that were made and must not be reopened. TRIGGER when porting, merging or syncing design-system changes into factory, or when a factory screen looks different from the showcase. DO NOT TRIGGER for new features that only use the existing blocks (use cornell-components).
---

# Porting the design system to the factory

## The rule

`design-system/` is copied **as is**. It is identical in the template (`iahub-template`) and the factory
(`factory-main/design-system`). Never edit the factory's copy: fix it upstream, then copy the folder over. The factory's
own code is where the wiring lives.

## Order

1. Copy `design-system/` (and the logo and icon sprites into `client/index.html`, the Typekit link, the Material Symbols
   font, the pre-paint script that sets `data-mode` and `data-theme`).
2. Styles: `angular.json` loads, in this order, the Material theme, `layers.css` (app theme files into layers either side of
   the design system), `design-system/index.css`, `design-system-bridge.css` (Material tokens mapped onto ours), then the
   app's own styles. Check `iahub-template/angular.json` for the exact list.
3. Services and look: `ThemeService` (mode and theme on `<html>`), `provideLook`, `AppShellService`.
4. Shells: `app-shell`, `site-header`, the public layout. The console already has its shell on the Cornell frame (see below).
5. Screens one feature at a time: native elements plus blocks, Material only where listed in `cornell-components`.
6. Prove it: `check.mjs`, `a11y.mjs`, `npm run verify` (factory's root, runs cert, check, test, docker).

## What the factory port already changed (the `redesign` patch)

`app/angular.json`, `app/client/index.html`, `styles.scss`, `theme/*.css` (the bridge, hub guard, console tokens),
`app.component.ts`, `app.config.ts`, the `chat-dock` component, `packages/chat-ui` (chat header, input, message, tool call),
`packages/console-ui` (app shell, admin layout, page header, stat card, status chip, empty state, focus-wrap).
Not yet ported from the template since that patch: the chat grip in the design-system chat block, the video slide and button,
the labelled slider changes, the scroll-region directive, the focus-ring fix (`accessability.css`), the Documentation page.
Check `git log` on `redesign` for everything after commit `ca74a20`.

## Factory differences to expect

- The factory still has `styles.scss` and other Sass; the design system and the template do not. Do not add Sass to the design
  system. Port the factory's own stylesheet pieces to plain CSS only when asked.
- Console screens are denser and agent-driven: use `data-density="compact"`, the app shell and dashboard parts.
- The chat dock lives in `app/client/app/shared/components/chat-dock/`. Its grip (a real focusable button, arrows, End,
  clamped) is the model for `blocks/chat.css`. The two should stay behaviourally identical.
- `npm run dev` in the factory is `:4330`, never `ng serve` (see its `AGENTS.md`).

## Decisions already made (do not reopen without the owner)

| Decision | Why |
|---|---|
| Sliders follow CDS: every caption is reachable, focus on a caption shows its slide, no live region | CDS's tested pattern; the owner chose it |
| A video in a slide has its own text button | WCAG 2.2.2 and 2.5.3; one tab stop, visible words = name |
| Image alt text is a fallback for image-only slides only | CDS behaviour: shown only when there is no title or caption |
| Native elements first, Material only for select, autocomplete, date picker, menus, dialogs, snack bar | Accessibility comes with native; one look |
| Text tones (soft, dim, red) are fixed tokens, not options | Contrast was chosen once |
| Pruned only undocumented classes; kept `cu-shell`, `cu-toolbar`, `cu-num`, `cu-nav__desc` | Documented, or CDS vocabulary |
| The chat grip stays a focusable button | Drag must have a keyboard way; the original's problem was bleeding focus, solved by keeping focus on the grip and in the panel |
| `tabindex="0"` on a scroll region only while it scrolls | A stop with nothing to scroll is noise |
| Deliberate differences from CDS (placeholder contrast, hover colours, 24px targets, pip spacing, `<dialog>`) | Each is listed in `design-system/README.md` with its reason |

## Still open

- The legacy Material theme (`client/theme.css`, `design-system-bridge.css`) is only partly retired; Material colours still
  depend on it. Plan: build the app, screenshot before and after, retire in one separate commit.
- Never run in a real browser: the Angular header slideshow and its video button, the taller banners, and anything in the
  factory beyond node tests. iOS Safari is untested. The first real `npm run verify` and click-through is the check.
- `client/app/shared/theme/styles.css` has a light-only `#f7f7f7` sidebar tint rule.

## Where to look

| Need | File |
|---|---|
| Everything about the system, rules, deliberate CDS differences | `design-system/README.md` |
| Inventory of blocks and behaviours | `design-system/COMPONENTS.md` |
| Brand rules, accessibility rules | `cornell-branding`, `cornell-accessibility` skills |
| What CDS does | `design-system-source/cds-full/` |
| How the app is wired | `client/README.md`, `docs/identity.md`, `CLAUDE.md` |
| Why a thing is the way it is | `docs/changelog.d/`, the commit messages on `redesign`, `showcase/decisions.html` |
| A decision to change | ask the owner (Irina) before changing it |
