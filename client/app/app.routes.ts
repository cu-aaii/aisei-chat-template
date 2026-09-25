import { Route } from '@angular/router';
import { PublicLayoutComponent } from './shared/layout/public/public-layout.component';

export interface RouteData {
  menu: string[];
  title?: string;
  /**
   * `<meta name="description">` for the route, applied by SiteTitleStrategy (also
   * during prerender). Each one is the page's own header subtitle so the snippet
   * matches what a visitor actually lands on; index.html holds the fallback.
   */
  description?: string;
  icon?: string;
  path?: string;
  roles?: string[]; // reserved for future auth guard
  /** Suppresses the floating `<app-chat-dialog>` on a route that embeds its own chat panel. */
  hideChatWidget?: boolean;
  [key: string]: unknown;
}

export interface AppRoute extends Route {
  data: RouteData;
  children?: AppRoute[];
}

export const routes: AppRoute[] = [
  {
    path: '',
    component: PublicLayoutComponent,
    data: { menu: [] },
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () =>
          import('./features/public/home/home.component').then(
            (m) => m.HomeComponent,
          ),
        data: { menu: [], title: 'Home' },
        title: 'AISEI Chat Template',
      },
      {
        path: 'about',
        loadComponent: () =>
          import('./features/public/about/about.component').then(
            (m) => m.AboutComponent,
          ),
        data: {
          menu: ['main', 'mobile'],
          title: 'About',
          description:
            'What this project is, who built it, and how to reach the team.',
        },
        title: 'About',
      },
    ],
  },
  {
    path: '**',
    redirectTo: '',
    pathMatch: 'full',
    data: { menu: [] },
  },
];
