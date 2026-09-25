export interface NavChild {
  label: string;
  path: string;
}

export interface NavItem {
  label: string;
  path?: string;
  children?: NavChild[];
  /** Renders the white "This Thursday"-style highlight pill in the primary nav. */
  highlight?: boolean;
}

/**
 * Primary navigation. Add an entry here when you add a route in app.routes.ts —
 * `children` renders a hover dropdown on desktop and a grouped list on mobile.
 */
export const PRIMARY_NAV: NavItem[] = [
  { label: 'Home', path: '/' },
  { label: 'About', path: '/about' },
];
