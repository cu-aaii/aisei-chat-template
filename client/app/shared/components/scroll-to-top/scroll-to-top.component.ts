import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  NgZone,
  signal,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { IconComponent } from '../icon/icon.component';

/** How far down the page the button appears, in px. */
const SHOW_AFTER_PX = 400;

/**
 * Floating "back to top" button, styled to match the masthead's search toggle.
 * Rendered once by `PublicLayoutComponent`, so it is available on every public
 * page. Adapted from `ssit/auth-demo`'s version — same idea, but without
 * Material, and using a signal + a passive out-of-zone listener instead of a
 * `@HostListener('window:scroll')` (see the note on the listener below).
 *
 * The button stays in the DOM and is hidden with `[inert]` + opacity rather
 * than `@if`, so it can fade rather than pop — the same mechanic
 * `SiteSearchComponent` uses for its drawer. `inert` keeps it out of the tab
 * order and the accessibility tree while hidden.
 */
@Component({
  selector: 'app-scroll-to-top',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  host: { class: 'scroll-to-top' },
  template: `
    <button
      type="button"
      class="btn"
      [class.visible]="visible()"
      [inert]="!visible()"
      (click)="scrollToTop()"
    >
      <app-icon name="keyboard_arrow_up" />
      <span class="sr-only">Back to top</span>
    </button>
  `,
  styles: `
    .btn {
      position: fixed;
      /* Stacked above the floating chat launcher (<app-chat-dialog>, also
         right/bottom-anchored) so the two buttons don't overlap. */
      right: 20px;
      bottom: 84px;
      z-index: 50;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      background: var(--color-accent-dark);
      border: none;
      border-radius: 0;
      color: #fff;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0, 0, 0, .25);

      /* Hidden state — see the class docstring for why this isn't an @if.
         visibility (not just opacity) is what keeps it untabbable, and unlike
         [inert] it holds in the prerendered HTML before hydration: Angular's
         server renderer doesn't serialise the inert property to an attribute. */
      visibility: hidden;
      opacity: 0;
      transform: translateY(8px);
      transition: opacity .2s ease, transform .2s ease, background-color .2s ease,
        visibility .2s;
    }
    .btn.visible {
      visibility: visible;
      opacity: 1;
      transform: none;
    }
    .btn:hover { background: #8f1013; }
    .btn:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
    .btn app-icon { font-size: 26px; }

    @media (prefers-reduced-motion: reduce) {
      .btn { transition: none; transform: none; }
    }

    @media (max-width: 767px) {
      .btn { right: 12px; bottom: 74px; }
    }
  `,
})
export class ScrollToTopComponent {
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);

  readonly visible = signal(false);

  constructor() {
    // afterNextRender keeps this off the server: there is no scroll position to
    // read while prerendering, and `visible` is false in both the prerendered
    // HTML and the hydrated client, so hydration stays in sync.
    afterNextRender(() => {
      const onScroll = () => this.visible.set(window.scrollY > SHOW_AFTER_PX);

      // Out of the zone and passive: scroll fires continuously, and inside the
      // zone every event would schedule change detection. Setting the signal to
      // the value it already holds is a no-op, so CD only runs on the two
      // frames where the button actually appears or disappears.
      this.zone.runOutsideAngular(() => {
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
      });

      this.destroyRef.onDestroy(() => window.removeEventListener('scroll', onScroll));
    });
  }

  scrollToTop() {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });

    // The button hides itself once we reach the top, which would drop focus to
    // <body> and lose the keyboard user's place. Hand it to the main landmark
    // (already `tabindex="-1"` for the skip link) without fighting the scroll.
    this.document.getElementById('main')?.focus({ preventScroll: true });
  }
}
