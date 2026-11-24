import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { LOOK, bannerPhotoCss, bannerSlideViews, navClass } from '../../look/look';
import { SiteHeaderComponent } from '../site-header/site-header.component';
import { PRIMARY_NAV } from './nav-items';
import { SiteFooterComponent } from './site-footer.component';
import { ScrollToTopComponent } from '../../components/scroll-to-top/scroll-to-top.component';
import { ChatDialogComponent } from '../../components/chat-dialog/chat-dialog.component';

/** The site's name, shown in the header's brand zone beside the seal (home) or under the wordmark bar (inner pages). */
export const SITE_TITLE = 'AI Innovation Hub';

/**
 * Public-facing shell, on the Cornell design system: skip link, the CDS site header (`lib-site-header`: the home
 * kind with the seal on `/`, the inner kind with the Cornell wordmark in the bar everywhere else, as CDS requires),
 * the routed page, the Cornell footer, back to top and the chat widget. Wraps every public route. The header's
 * style, navigation look and colour mode come from `provideLook({...})` in app.config.ts (the cornell-look skill).
 *
 * `<app-chat-dialog>` is mounted here, outside `<router-outlet>`, so it, and the shared `ChatEngineService`
 * conversation it renders, survives in-app navigation instead of being torn down per route.
 */
@Component({
  selector: 'app-public-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, SiteHeaderComponent, SiteFooterComponent, ScrollToTopComponent, ChatDialogComponent],
  template: `
    <a class="cu-skip" href="#main" (click)="skipToMain($event)">Skip to main content</a>
    <app-site-header
      [kind]="kind()"
      [title]="title"
      [theme]="look.publicHeader"
      [items]="nav"
      [navClass]="navClass"
      [photo]="photo"
      [slides]="slides"
      [logoRight]="look.logoSide === 'right'"
      [height]="look.bannerHeight"
    />
    <main #main id="main" tabindex="-1">
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
    main:focus { outline: none; }
  `,
})
export class PublicLayoutComponent {
  private readonly router = inject(Router);
  protected readonly look = inject(LOOK);
  protected readonly title = SITE_TITLE;
  protected readonly nav = PRIMARY_NAV;
  protected readonly navClass = navClass(this.look);
  protected readonly photo = bannerPhotoCss(this.look);
  protected readonly slides = bannerSlideViews(this.look);
  private readonly main = viewChild<ElementRef<HTMLElement>>('main');

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );
  /** CDS: the seal is for the home page, the wordmark bar for every other page. */
  protected readonly kind = computed(() => (this.url().split(/[?#]/)[0] === '/' ? 'home' : 'inner'));

  /**
   * The `<base href="/">` tag makes the browser resolve a bare `#main` href against the root path, not the
   * current route, so on any page other than `/` it would navigate away. Move focus ourselves instead.
   */
  protected skipToMain(event: Event): void {
    event.preventDefault();
    this.main()?.nativeElement.focus();
  }
}
