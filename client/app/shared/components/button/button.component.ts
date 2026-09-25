import { booleanAttribute, ChangeDetectionStrategy, Component, input } from '@angular/core';

import { IconComponent } from '../icon/icon.component';

/**
 * The site's call-to-action link button, in its two variants.
 *
 * This replaces five hand-copied `.btn`/`.see-all` blocks that had drifted into four
 * different horizontal paddings (18/20/22/24px), two font sizes (13/14px), and a hover
 * transition present on the outline copies but missing from the solid ones — so solid
 * buttons snapped while outline buttons animated. All of that was accidental, not
 * designed, and it is why the same misaligned arrow had to be fixed in six places.
 *
 * The selector is `a[appButton]`, so the host element *is* the author's own anchor. That
 * matters: `routerLink`, `href`, `target` and `rel` keep working natively, with nothing
 * proxied through inputs and no wrapper element between the anchor and its styling. It's
 * the same shape Angular Material uses for `a[mat-button]`.
 *
 * The trailing arrow is part of the component rather than the caller's markup. It used to
 * be a literal `&rarr;` in the label text, which had two problems: freight-sans-pro has
 * no U+2192, so Chrome substituted a per-character fallback (Liberation Sans here, a
 * different face on Windows/macOS), and that glyph sits on the font's math axis — about
 * 1-3px below the optical centre of the caps beside it, worst on labels with no
 * descenders like "See All". As an inline SVG centred in its own 1em box it lands on the
 * text's centre and renders identically everywhere. It also means `gap` finally applies,
 * since the arrow is a real flex item now instead of a character inside the label run.
 */
export type ButtonVariant = 'outline' | 'solid';

@Component({
  // Attribute selector on purpose: the host is the author's own <a>, see above.
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'a[appButton]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  host: {
    '[class.solid]': 'variant() === "solid"',
  },
  template: `
    <ng-content />
    @if (arrow()) {
      <app-icon name="arrow_forward" />
    }
  `,
  styles: `
    /* inline-flex + gap is what puts the arrow a fixed 6px from the label and centres it
       vertically — neither worked while the arrow was a character inside the label. */
    :host {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 10px 22px;
      /* The solid variant carries a border of its own colour rather than none, so both
         variants occupy exactly the same box; otherwise solid would render 4px smaller
         in each dimension for no reason a reader could see. */
      border: 2px solid var(--color-accent);
      border-radius: 2px;
      background: #fff;
      color: var(--color-accent);
      font-size: 14px;
      font-weight: 700;
      text-decoration: none;
      transition: background-color .15s, color .15s, border-color .15s;
    }

    :host(.solid) {
      background: var(--color-accent);
      border-color: var(--color-accent);
      color: #fff;
    }

    :host(:hover) {
      background: var(--color-accent);
      color: #fff;
    }

    :host(.solid:hover) {
      background: var(--color-accent-dark);
      border-color: var(--color-accent-dark);
    }
  `,
})
export class ButtonComponent {
  readonly variant = input<ButtonVariant>('outline');
  /** Set false for a button whose label shouldn't imply "continues elsewhere". */
  readonly arrow = input(true, { transform: booleanAttribute });
}
