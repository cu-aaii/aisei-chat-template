import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { IconName } from './icon-names';

export type { IconName } from './icon-names';

/**
 * An icon from the design system's set (Material Symbols Outlined 300, `blocks/icon.css`), drawn from the symbols
 * in client/index.html. Use it on the `<svg>` itself, so the element is exactly the design system's
 * `<svg class="cu-icon"><use href="#cu-i-NAME"/></svg>` and the blocks' own icon rules (`.cu-chat__launcher >
 * .cu-icon`, `.cu-back-to-top .cu-icon`) reach it:
 *
 *   <svg appIcon="send"></svg>        <svg appIcon="arrow_forward" class="cu-icon--trail"></svg>
 *
 * No request, no font, `currentColor`. Decorative (`aria-hidden`): an icon goes beside text, or in a button or
 * link that carries the name (cornell-accessibility).
 */
@Component({
  // Attribute selector on purpose: the host is the <svg> the design system styles.
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'svg[appIcon]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'cu-icon', 'aria-hidden': 'true', focusable: 'false' },
  template: `<svg:use [attr.href]="href()" />`,
})
export class IconComponent {
  readonly name = input.required<IconName>({ alias: 'appIcon' });

  protected readonly href = computed(() => `#cu-i-${this.name()}`);
}
