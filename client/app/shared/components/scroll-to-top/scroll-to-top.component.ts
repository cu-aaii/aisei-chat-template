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

/** How far down the page the button appears, in px (the design system's back-to-top block: 800px). */
const SHOW_AFTER_PX = 800;

/**
 * Floating "back to top" button: the design system's `cu-back-to-top cu-back-to-top--floating` block (a carnelian
 * circle with an up arrow and the word "Top"; design-system/blocks/backtotop.css, behaviour `initBackToTop` in
 * showcase.js). Rendered once by `PublicLayoutComponent`, so it is on every public page; app.css lifts it above the
 * chat launcher, which shares the corner.
 *
 * It is `hidden` until the page has scrolled 800px (the block draws nothing while hidden, so it is out of the tab
 * order and the accessibility tree, and the prerendered HTML has it hidden too). The scroll listener is passive and
 * outside the zone, and only sets a signal, so change detection runs only when the button appears or disappears.
 */
@Component({
  selector: 'app-scroll-to-top',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <button
      type="button"
      class="cu-back-to-top cu-back-to-top--floating"
      [hidden]="!visible()"
      (click)="scrollToTop()"
    >
      <svg appIcon="arrow_upward"></svg><span>Top</span>
    </button>
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

  /** As the design system's reference: focus moves to <main> first (the button hides itself at the top, which
   *  would drop focus to <body>), then the page scrolls, smoothly unless the reader prefers reduced motion. */
  scrollToTop() {
    this.document.getElementById('main')?.focus({ preventScroll: true });
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
  }
}
