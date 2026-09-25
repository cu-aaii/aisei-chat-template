import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PublicMastheadComponent } from './public-masthead.component';
import { SiteFooterComponent } from './site-footer.component';
import { ScrollToTopComponent } from '../../components/scroll-to-top/scroll-to-top.component';
import { ChatDialogComponent } from '../../components/chat-dialog/chat-dialog.component';

/**
 * Public-facing shell: masthead + primary nav on top, routed page content in
 * the middle, site footer at the bottom, and the floating back-to-top button.
 * Wraps every public route.
 *
 * `<app-chat-dialog>` is mounted here, outside `<router-outlet>`, so it —
 * and the shared `ChatEngineService` conversation it renders — survives
 * in-app navigation instead of being torn down per route.
 */
@Component({
  selector: 'app-public-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    PublicMastheadComponent,
    SiteFooterComponent,
    ScrollToTopComponent,
    ChatDialogComponent,
  ],
  template: `
    <app-public-masthead />
    <main id="main" tabindex="-1">
      <router-outlet />
    </main>
    <app-site-footer />
    <app-scroll-to-top />
    <app-chat-dialog />
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }
    main { flex: 1; display: block; }
  `,
})
export class PublicLayoutComponent {}
