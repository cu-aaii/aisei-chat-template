import { ChangeDetectionStrategy, Component } from '@angular/core';
import { InnerPageLayoutComponent } from '../../../shared/layout/public/inner-page-layout.component';

/**
 * A plain content page using the shared inner-page layout (title band + body).
 * Copy this component to add another page, then register it in app.routes.ts and
 * nav-items.ts. `headerImage` is optional — pass an image path to put a photo
 * behind the title band.
 */
@Component({
  selector: 'app-about',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [InnerPageLayoutComponent],
  template: `
    <app-inner-page
      title="About"
      subtitle="What this project is, who built it, and how to reach the team."
    >
      <section class="body">
        <h2>The project</h2>
        <p>
          Describe the problem you are working on, who it is for, and what a good outcome
          looks like. Keep it short — two or three paragraphs is plenty.
        </p>

        <h2>The team</h2>
        <p>List the people involved and their roles.</p>

        <h2>The assistant</h2>
        <p>
          The chat button in the corner talks to a model through Cornell's AI gateway. It
          can search and read the pages of this site, so anything you write here is
          something it can answer questions about. Try asking it what this page says.
        </p>
      </section>
    </app-inner-page>
  `,
  styles: `
    :host { display: block; }
    .body { max-width: 760px; }
    .body h2 {
      font-family: var(--heading-font);
      font-size: 24px;
      font-weight: 700;
      margin: 32px 0 10px;
    }
    .body h2:first-child { margin-top: 0; }
    .body p { font-size: 17px; line-height: 1.6; margin: 0 0 12px; }
  `,
})
export class AboutComponent {}
