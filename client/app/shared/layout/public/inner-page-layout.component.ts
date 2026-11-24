import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';

/**
 * Shell for public inner pages: a page-title band (with an optional background photo) over a single content
 * column. The site header above it is the CDS inner kind (the wordmark bar); this band holds the page's one `h1`.
 *
 * The band is a dark design-system band (`cu-band cu-band--near-black`: `color-scheme: dark`, so its text and any
 * block inside take their dark values in either page mode). With a photo, the design system's scrim token sits
 * between the photo and the title; keep the photo dark where the title sits (cornell-look: a photograph's contrast
 * cannot be tested, so look at the page).
 *
 * The header photo is a real `<img priority>`, not a CSS `background-image`: it's the LCP element, and a
 * background image is invisible to the browser's preload scanner. `priority` emits `fetchpriority="high"` and a
 * `<link rel="preload">`, which ships in the prerendered HTML `<head>`.
 */
@Component({
  selector: 'app-inner-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inner-page' },
  imports: [NgOptimizedImage],
  template: `
    <header class="page-head cu-band cu-band--near-black" [class.has-image]="!!headerImage()">
      @if (headerImage()) {
        <img [ngSrc]="headerImage()" fill priority sizes="100vw" alt="" />
      }
      <div class="inner cu-container">
        <h1>{{ title() }}</h1>
        @if (subtitle()) {
          <p>{{ subtitle() }}</p>
        }
      </div>
    </header>

    <div class="page-body cu-container">
      <ng-content />
    </div>
  `,
  styles: `
    :host { display: block; }

    /* position: relative is load-bearing: NgOptimizedImage's fill mode needs a positioned ancestor, and the
       scrim and title stack against it. */
    .page-head { position: relative; }
    .page-head img { object-fit: cover; object-position: center; z-index: 0; }
    /* The design system's scrim, so the title stays readable over a photo. ::before would otherwise paint over
       a real child at equal z-index, so the three layers are ordered explicitly. */
    .page-head.has-image::before {
      content: "";
      position: absolute;
      inset: 0;
      z-index: 1;
      background: color-mix(in srgb, var(--color-scrim) 75%, transparent);
    }
    .page-head.has-image .inner { color: var(--color-on-scrim); }
    .page-head .inner { position: relative; z-index: 2; padding-block: var(--space-10); }
    .page-head h1 { margin: 0; color: inherit; }
    .page-head p { margin: var(--space-3) 0 0; font-size: var(--text-intro); max-width: 40rem; }

    .page-body { padding-block: var(--space-8) var(--space-12); }
  `,
})
export class InnerPageLayoutComponent {
  readonly title = input.required<string>();
  readonly subtitle = input('');
  readonly headerImage = input('');
}
