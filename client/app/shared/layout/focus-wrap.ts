/**
 * Keeping Tab inside an overlay panel (the phone menus). One implementation for every panel, so a fix lands in all of them;
 * design-system/showcase/showcase.js has the same helpers (`stopsIn`, `wrapTab`) as the reference behaviour.
 */

/** What the wrap needs from the keydown event. */
export interface TabEvent {
  shiftKey: boolean;
  preventDefault(): void;
}

/** The panel's tab stops that are drawn (not `display: none`, not inside a closed `<details>`). */
export function stopsIn(panel: ParentNode, selector = 'a[href], button, summary'): HTMLElement[] {
  return Array.from(panel.querySelectorAll<HTMLElement>(selector)).filter(
    (el) => el.getClientRects().length > 0 && !el.closest('details:not([open]) > :not(summary)'),
  );
}

/**
 * Wrap focus at the ends of `stops`: Tab on the last goes to the first, Shift+Tab on the first (or on the panel itself,
 * where focus lands after a click on blank space) goes to the last. Returns true when it wrapped.
 */
export function wrapTab(e: TabEvent, stops: { focus(): void }[], panel: unknown, active: unknown): boolean {
  if (!stops.length) return false;
  const first = stops[0];
  const last = stops[stops.length - 1];
  if (e.shiftKey && (active === first || active === panel)) {
    e.preventDefault();
    last.focus();
    return true;
  }
  if (!e.shiftKey && active === last) {
    e.preventDefault();
    first.focus();
    return true;
  }
  return false;
}
