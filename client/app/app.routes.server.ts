import { RenderMode, ServerRoute } from '@angular/ssr';

// Every route is prerendered to static HTML at build time. A route with a parameter
// (e.g. `items/:slug`) needs its own entry with `getPrerenderParams()` listing the slugs.
export const serverRoutes: ServerRoute[] = [
  {
    path: '**',
    renderMode: RenderMode.Prerender,
  },
];
