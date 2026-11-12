# library#40 — "Test version: conversations are saved" notice

Refs cu-aaii/ai-lab-fa26-library-resource-discovery#40. Mockup: `mockups/transcript-notice.html`.
Server side (`transcriptLog` in `GET /api/chat/config`, `server/modules/chat/chat-router.ts:110`) already shipped in #38 / template PR #7.

## Goal
When the deployment has `transcriptLog` enabled, show a plain-text notice directly above the chat input so testers know conversations are stored:

> Test version: conversations are saved for review.

## Design
- **New standalone component** `client/app/shared/components/chat/transcript-notice.component.ts`, selector `app-transcript-notice`, `ChangeDetectionStrategy.OnPush`.
- Injects `ChatEngineService` and reads the existing `transcriptLog` signal (`client/app/shared/services/chat-engine.service.ts:132`, populated at :144 from `GET /api/chat/config`). **No service change.**
- Template:
  ```html
  @if (chatEngine.transcriptLog()) {
    <p class="transcript-notice">Test version: conversations are saved for review.</p>
  }
  ```
- Styles (component-local): `margin: 0 0 8px; padding: 0 4px; font-size: 13px; line-height: 1.4; color: var(--color-muted);` (#666 on #fff = 5.74:1, WCAG AA). `:host { display: block; }` is not needed; with `@if` false the host is an empty inline element and adds no gap.
- **Placement: ONE added line** in `chat-panel.component.ts`, immediately before `<div class="input-row">` (currently line 99), i.e. after the `errorText()` banner, inside `form.composer`:
  ```html
        <app-transcript-notice />
        <div class="input-row">
  ```
  plus one import line (`import { TranscriptNoticeComponent } from './transcript-notice.component';`) and `TranscriptNoticeComponent` in the `imports: [...]` array (line 35). The template line is the only change inside the template.

## States
| State | `transcriptLog()` | Result |
|---|---|---|
| on | `true` | notice renders above input row |
| off | `false` | nothing renders, no gap |
| config fetch failed / not yet loaded | stays at initial `false` | treated as off — nothing renders (fail-closed on display; the server decides logging, so a failed fetch never claims something the UI cannot confirm) |

If the config resolves late, the signal flips to `true` and the notice appears; OnPush + signal handles this without extra code.

## Accessibility
- Normal DOM text in reading order (just before the input), so screen-reader users reach it when tabbing/browsing to the composer. No `aria-hidden`, no `role="alert"`/live region (it is static, not an event).
- No dismiss button — the notice is a standing disclosure.
- Contrast #666 on #fff = 5.74:1 (AA). 13px text wraps (max two lines at 320 px), never truncated; no horizontal scroll at 320 px.
- Does not interfere with the `role="log"` messages region or the textarea's `aria-label="Message"`.

## Unit test
`transcript-notice.component.spec.ts` (same dir, same test runner/pattern as neighbouring chat specs): provide a stub `ChatEngineService` with `transcriptLog = signal(...)`.
1. `transcriptLog=true` → element `.transcript-notice` exists with exact text "Test version: conversations are saved for review."
2. `transcriptLog=false` → no `.transcript-notice` element; host has no text.
3. Signal flips false→true after creation → notice appears after `detectChanges()`.
4. Notice has no `button` and no `aria-hidden` attribute.
Optionally, a chat-panel spec assertion that `app-transcript-notice` precedes `.input-row` in DOM order.

## Acceptance
- With `transcriptLog: true` from `/api/chat/config`, the notice shows above the input in both the floating dialog and the inline `/search` panel (both use `app-chat-panel`).
- With `false`, or when `/api/chat/config` fails, no notice and no layout change.
- Text exactly: "Test version: conversations are saved for review."
- Matches mockup (a)/(b)/(c); readable at 320 px.
- New unit tests pass; existing chat-panel tests unchanged and passing.
- `chat-engine.service.ts` has zero diff.

## NOT in scope
- Server/config changes or the logging itself (done in #38 / PR #7).
- Dismiss/acknowledge/consent flow, links to a privacy policy, per-user opt-out.
- Wording variants or i18n; changes to `ChatEngineService`; changes to the empty-state block or styles of existing elements.
- Any change to the library repo's patches (only verified, see below).

## Library patch overlap
The library repo (`ai-lab-fa26-library-resource-discovery`) applies `deploy/patches/law-finder-page.patch` on top of this template. Its hunks on `chat-panel.component.ts` are `@@ -5,10`, `@@ -79,8 +82,20` (empty-state block, ending around line 101 after patching), `@@ -143,6`, `@@ -257,6`, `-266,6`, `-283,6`, `-398,6`. The `@@ -79,8` hunk is **adjacent** to our line-99 insertion, so the context lines of that hunk may shift or collide.

Mitigation and verification:
- Our template insertion is a single line directly before `<div class="input-row">`, plus an import line and an `imports` array entry; we do not touch lines 79–98 or the styles block.
- **Build verification:** after the change is built on its branch, run `git apply --check deploy/patches/law-finder-page.patch` (from the library repo, with the patch's target paths pointing at the built template branch / working tree). It must exit 0. If the `@@ -79,8` hunk fails on context, adjust the patch offsets in the library repo (or move our line so its context is outside the hunk's 3-line context window) — never reformat existing template lines to make it fit.
- The patch also hunks `chat-engine.service.ts` (`@@ -1,4`, `-18,12`, `-137,6`, `-175,5`); **`chat-engine.service.ts` is untouched** by this change, so those hunks are unaffected. Confirm with `git diff test -- client/app/shared/services/chat-engine.service.ts` being empty.
- The import line (after line 14) falls at/inside the range of the `@@ -5,10` hunk (lines 5–14), so it is a second overlap risk. Place the new import as the last import (after `ThinkingIndicatorComponent`) and verify with the same `git apply --check`; the `imports: [...]` array on line 35 is outside every patch hunk listed above.
