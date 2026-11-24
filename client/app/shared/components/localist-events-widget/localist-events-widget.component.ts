import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
} from '@angular/core';

/**
 * Embeds Cornell's Localist events widget (events.cornell.edu) — an example of
 * dropping a third-party <script> widget into an Angular page.
 *
 * Two things make it work:
 * 1. The script is injected in the browser only, via afterNextRender. That hook
 *    never runs during prerendering, so the static HTML ships an empty container
 *    and the widget fills it once the page loads.
 * 2. The script is told which element to fill with the `container` parameter,
 *    which is why each instance takes a unique `containerId`.
 *
 * To show a different calendar, change the query parameters below; Localist's
 * widget builder (events.cornell.edu/help/widget) generates them.
 *
 * Localist's markup gives each event's picture no `alt` (axe: image-alt). The picture is decoration: the event's
 * title link beside it, and the dates in the same link, name the event. So any image the script inserts without
 * an `alt` gets an empty one, from a MutationObserver on this container only, disconnected with the component.
 */
@Component({
  selector: 'app-localist-events-widget',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // data-mode="light": Localist paints its own light cards (#fafafa) but lets some text inherit the page colour, which
  // in dark mode is near-white (1.3:1). The design system's per-region mode keeps this region light in both modes.
  template: `<div [id]="containerId()" class="localist-widget" data-mode="light"></div>`,
  styles: `
    :host { display: block; }
    .localist-widget { min-height: 120px; color: var(--color-ink); }
  `,
})
export class LocalistEventsWidgetComponent {
  readonly containerId = input.required<string>();
  readonly num = input(10);
  readonly days = input(31);

  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => {
      const params = new URLSearchParams({
        schools: 'cornell',
        types: '5915,4192',
        days: String(this.days()),
        num: String(this.num()),
        tags: 'artificial intelligence',
        experience: 'virtual',
        container: this.containerId(),
        template: 'modern',
      });
      const host: HTMLElement = this.host.nativeElement;
      const decorate = () => host.querySelectorAll<HTMLImageElement>('img:not([alt])').forEach((img) => img.setAttribute('alt', ''));
      const observer = new MutationObserver(decorate);
      observer.observe(host, { childList: true, subtree: true });
      this.destroyRef.onDestroy(() => observer.disconnect());

      const script = document.createElement('script');
      script.src = `https://events.cornell.edu/widget/view?${params.toString()}`;
      host.appendChild(script);
    });
  }
}
