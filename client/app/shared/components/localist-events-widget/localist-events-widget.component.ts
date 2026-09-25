import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
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
 */
@Component({
  selector: 'app-localist-events-widget',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div [id]="containerId()" class="localist-widget"></div>`,
  styles: `
    :host { display: block; }
    .localist-widget { min-height: 120px; }
  `,
})
export class LocalistEventsWidgetComponent {
  readonly containerId = input.required<string>();
  readonly num = input(10);
  readonly days = input(31);

  private readonly host = inject(ElementRef<HTMLElement>);

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
      const script = document.createElement('script');
      script.src = `https://events.cornell.edu/widget/view?${params.toString()}`;
      this.host.nativeElement.appendChild(script);
    });
  }
}
