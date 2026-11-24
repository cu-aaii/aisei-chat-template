/**
 * Every icon the site draws. Each is a `<symbol id="cu-i-NAME">` in client/index.html, copied from the design
 * system's sprite (design-system/assets/icons.sprite.html, Material Symbols Outlined 300). To add one: copy its
 * symbol into index.html and its name here; icon-sprite.test.ts fails until both agree.
 */
export const ICON_NAMES = [
  'arrow_forward',
  'arrow_upward',
  'chevron_left',
  'chevron_right',
  'close',
  'delete',
  'forum',
  'pause',
  'play_arrow',
  'remove',
  'send',
  'unfold_less',
  'unfold_more',
] as const;

export type IconName = (typeof ICON_NAMES)[number];
