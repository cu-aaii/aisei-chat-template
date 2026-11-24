import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { IconName } from './icon-names';

export type { IconName } from './icon-names';

/**
 * An icon from the design system's set (Material Symbols Outlined 300, `blocks/icon.css`), drawn from the symbols
 * in client/index.html: `<svg class="cu-icon"><use href="#cu-i-NAME"/></svg>`. No request, no font, no flash of
 * the ligature's name, and `currentColor`, so it follows the text and the colour mode.
 *
 * Decorative by default (`aria-hidden`): an icon belongs beside text, or in a button or link that carries the name
 * (cornell-accessibility). Pass `label` only when the icon itself carries meaning.
 */
@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'app-icon',
    '[attr.aria-hidden]': 'label() ? null : "true"',
    '[attr.role]': 'label() ? "img" : null',
    '[attr.aria-label]': 'label() || null',
  },
  template: `<svg class="cu-icon" aria-hidden="true" focusable="false"><use [attr.href]="href()" /></svg>`,
  styles: `
    /* 1em square on the text's centre line, so a font-size on the host sizes the icon, as before. */
    :host { display: inline-flex; flex: none; inline-size: 1em; block-size: 1em; vertical-align: -0.125em; }
    .cu-icon { display: block; inline-size: 100%; block-size: 100%; }
  `,
})
export class IconComponent {
  readonly name = input.required<IconName>();
  /** Set only when the icon is the sole carrier of meaning; otherwise decorative. */
  readonly label = input<string | undefined>(undefined);

  protected readonly href = computed(() => `#cu-i-${this.name()}`);
}
