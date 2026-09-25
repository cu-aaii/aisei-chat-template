import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';

/**
 * Shell for public inner pages: a page-title header band (with an optional
 * background photo) over a single, centered content column. Latest articles /
 * selected projects / featured tools live in the site footer, not a sidebar.
 *
 * The header photo is a real `<img priority>`, not a CSS `background-image`. It's the LCP
 * element on all nine inner pages, and a background image is invisible to the browser's
 * preload scanner — it can't start downloading until the stylesheet has been fetched,
 * parsed and matched against the DOM. `priority` emits both `fetchpriority="high"` and a
 * `<link rel="preload">`, and because every route is prerendered (`RenderMode.Prerender`)
 * that preload ships in the static HTML `<head>`, so the fetch starts on the first byte.
 */
@Component({
  selector: 'app-inner-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inner-page' },
  imports: [NgOptimizedImage],
  template: `
    <header class="page-head" [class.has-image]="!!headerImage()">
      @if (headerImage()) {
        <img [ngSrc]="headerImage()" fill priority sizes="100vw" alt="" />
      }
      <div class="inner container-fluid">
        <h1>{{ title() }}</h1>
        @if (subtitle()) {
          <p>{{ subtitle() }}</p>
        }
      </div>
    </header>

    <div class="page-body container-fluid">
      <ng-content />
    </div>
  `,
  styles: `
    :host { display: block; }

    /* position: relative is load-bearing — NgOptimizedImage's fill mode needs a
       positioned ancestor, and the scrim/title stack against it. */
    .page-head {
      background-color: var(--color-hero-bg);
      color: #fff;
      position: relative;
    }
    /* The three layers are explicitly ordered: ::before would otherwise paint over a real
       child element at equal z-index, hiding the photo behind an opaque scrim. */
    .page-head img {
      object-fit: cover;
      object-position: center;
      z-index: 0;
    }
    /* Dark scrim so the title stays readable over a photo */
    .page-head.has-image::before {
      content: "";
      position: absolute;
      inset: 0;
      z-index: 1;
      background: linear-gradient(90deg, rgba(26, 26, 26, .82) 0%, rgba(26, 26, 26, .5) 100%);
    }
    .page-head .inner {
      position: relative;
      z-index: 2;
      padding-top: 52px;
      padding-bottom: 52px;
    }
    .page-head h1 { font-family: var(--heading-font); font-size: 40px; font-weight: 700; margin: 0; }
    .page-head p { margin: 12px 0 0; opacity: .9; font-size: 17px; max-width: 640px; }

    .page-body {
      padding-top: 48px;
      padding-bottom: 72px;
    }

    @media (max-width: 767px) {
      .page-head h1 { font-size: 32px; }
    }
  `,
})
export class InnerPageLayoutComponent {
  readonly title = input.required<string>();
  readonly subtitle = input('');
  readonly headerImage = input('');
}
