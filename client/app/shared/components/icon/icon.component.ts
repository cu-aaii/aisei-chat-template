import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Inline SVG icon, replacing the Material Icons webfont.
 *
 * The site uses exactly seven glyphs. Loading them as a font cost a
 * render-blocking third-party stylesheet plus a 128 kB woff2 — and because the
 * markup is ligature-based (`<span class="material-icons">search</span>`), the
 * literal word "search" was liable to flash before the font arrived. Inline SVG
 * has none of that: no request, no flash, no layout shift.
 *
 * Paths are the canonical 24dp filled Material Icons, taken verbatim from
 * google/material-design-icons. Sizing is `1em`, so the `font-size` rules that
 * sized the old spans still work unchanged and callers need no new CSS.
 *
 * Every current use is decorative next to visible text, so `aria-hidden` is on
 * the host by default. An icon that carries meaning on its own must pass a
 * `label`, which swaps in `role="img"` and an accessible name.
 */
export type IconName =
  | 'arrow_forward'
  | 'chat'
  | 'close'
  | 'close_fullscreen'
  | 'delete'
  | 'event'
  | 'expand_more'
  | 'keyboard_arrow_up'
  | 'open_in_full'
  | 'person'
  | 'place'
  | 'search'
  | 'send';

const PATHS: Record<IconName, string> = {
  // Centred on y=12 of the 24 box, which is what puts it on the text's optical centre
  // once the host is 1em tall at `vertical-align: -0.125em`.
  arrow_forward: 'M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z',
  chat: 'M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6zm8 5H6v-2h8zm4-6H6V6h12z',
  delete: 'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z',
  close:
    'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
  close_fullscreen:
    'M22 3.41L16.71 8.7 20 12h-8V4l3.29 3.29L20.59 2 22 3.41zM3.41 22l5.29-5.29L12 20v-8H4l3.29 3.29L2 20.59 3.41 22z',
  open_in_full: 'M21 11V3h-8l3.29 3.29-10 10L3 13v8h8l-3.29-3.29 10-10z',
  event:
    'M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z',
  expand_more: 'M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z',
  keyboard_arrow_up: 'M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z',
  person:
    'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
  place:
    'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
  search:
    'M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z',
  send: 'M2.01 21L23 12 2.01 3 2 10l15 2-15 2z',
};

@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'app-icon',
    '[attr.aria-hidden]': 'label() ? null : "true"',
    '[attr.role]': 'label() ? "img" : null',
    '[attr.aria-label]': 'label() || null',
  },
  template: `
    <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
      <path [attr.d]="path()" />
    </svg>
  `,
  styles: `
    /* Sized in em so the existing font-size rules keep driving icon size, and
       inline-flex so the box is exactly 1em tall with no line-height leading. */
    :host {
      display: inline-flex;
      width: 1em;
      height: 1em;
      flex: none;
      vertical-align: -0.125em;
    }
    svg { width: 100%; height: 100%; fill: currentColor; }
  `,
})
export class IconComponent {
  readonly name = input.required<IconName>();
  /** Set only when the icon is the sole carrier of meaning; otherwise decorative. */
  readonly label = input<string | undefined>(undefined);

  readonly path = computed(() => PATHS[this.name()]);
}
