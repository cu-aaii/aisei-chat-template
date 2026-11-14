export interface NavChild {
  label: string;
  path: string;
}

export interface NavItem {
  label: string;
  /**
   * Where the label goes. A parent with `children` links here too — give it a
   * landing page — and its chevron opens the dropdown.
   */
  path: string;
  children?: NavChild[];
  /** Renders the white "This Thursday"-style highlight pill in the primary nav. */
  highlight?: boolean;
}

/**
 * Primary navigation. Add an entry here when you add a route in app.routes.ts —
 * `children` renders a hover dropdown on desktop and a grouped list on mobile;
 * the parent's own `path` stays a link (its section landing page).
 */
export const PRIMARY_NAV: NavItem[] = [
  { label: 'Home', path: '/' },
  { label: 'About', path: '/about' },
];
