import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LabWordmarkComponent } from '../../components/lab-wordmark/lab-wordmark.component';

interface FooterLink {
  label: string;
  path: string;
}

/**
 * Site footer: 25% wordmark/contact column + 75% three-column link block,
 * plus a legal bar. Mirrors the live site's `.secondary`/`.primary` split —
 * Replace the address, contact link, and link columns with your own.
 */
@Component({
  selector: 'app-site-footer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, LabWordmarkComponent],
  host: { class: 'site-footer' },
  template: `
    <footer>
      <div class="container-fluid">
        <div class="row">
          <div class="secondary">
            <app-lab-wordmark class="wordmark" />
            <address>
              Your team or lab name<br />
              Cornell University, Ithaca, NY 14853
            </address>
            <a
              class="contact"
              href="mailto:you@cornell.edu"
              >Contact Us</a
            >
          </div>

          <div class="primary">
            <div>
              <h4>Pages</h4>
              <ul>
                @for (a of pages; track a.path) {
                  <li><a [routerLink]="a.path">{{ a.label }}</a></li>
                }
              </ul>
            </div>

            <div>
              <h4>Resources</h4>
              <ul>
                <li><a href="https://ai.cornell.edu" target="_blank" rel="noopener">Cornell AI Initiative</a></li>
              </ul>
              <h4 class="part-of">Built with</h4>
              <ul>
                <li><a href="https://github.com/cu-aaii/aisei-chat-template" target="_blank" rel="noopener">aisei-chat-template</a></li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div class="legal">
        <div class="container-fluid">
          <div class="legal-row">
            <ul class="legal-list">
              <li><a href="https://www.cornell.edu" rel="noopener">Cornell University</a> &copy;2026</li>
              <li><a href="https://privacy.cornell.edu/" rel="noopener">University Privacy</a></li>
            </ul>
            <ul class="legal-list">
              <li><a href="mailto:you@cornell.edu">Web Accessibility Assistance</a></li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  `,
  styles: `
    :host { display: block; font-family: var(--body-font); }
    footer { background: var(--color-footer-bg); color: var(--color-footer-text); }

    .row {
      display: flex;
      padding-top: 45px;
      padding-bottom: 45px;
    }
    .secondary { flex: 0 0 25%; padding-right: 15px; }
    .primary { flex: 1; display: flex; gap: 34px; padding-left: 15px; }
    .primary > div { flex: 1; min-width: 0; }

    h4 {
      color: #bbb;
      font-family: var(--heading-font);
      font-weight: 500;
      font-size: 18px;
      margin: 0 0 14px;
    }
    ul { list-style: none; padding: 0; margin: 0; }
    li { margin-bottom: 7.5px; }
    a { color: #fff; text-decoration: underline; }
    /* inline-block + line-height gives each link a 26px-tall hit area (WCAG 2.2
       target-size wants 24x24; the inherited 14px body line-height gave 21px).
       The li margin drops by the same amount the line box grew, so the 28.5px
       vertical pitch between links is unchanged. */
    .primary a { display: inline-block; line-height: 26px; font-size: 16px; }
    .primary li { margin-bottom: 2.5px; }
    .primary a::before { content: "\\2197  "; text-decoration: none; }

    .secondary .wordmark { display: block; width: 250px; height: auto; margin-bottom: 20px; }
    .secondary address {
      font-style: normal;
      color: #bbb;
      font-size: 16px;
      line-height: 24px;
      margin: 0 0 24px;
    }
    .secondary .contact {
      display: inline-block;
      margin-top: 8px;
      background: rgba(109, 195, 255, .15);
      color: #fff;
      padding: 14px 18px 11px;
      font-size: 18px;
      text-decoration: none;
    }
    .secondary .contact:hover { background: rgba(109, 195, 255, .28); }

    .part-of { margin-top: 40px; }

    .legal { background: var(--color-footer-legal-bg); }
    .legal .container-fluid { padding-top: 20px; padding-bottom: 20px; }
    .legal-row { display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
    .legal-list { display: flex; gap: 16px; flex-wrap: wrap; }
    .legal-list a { font-size: 15px; }
    .legal-list a::before { content: none; }

    @media (max-width: 767px) {
      .row { flex-direction: column; }
      .secondary { flex: none; padding-right: 0; margin-bottom: 32px; }
      .primary { flex-direction: column; gap: 32px; }

      .legal-row { flex-direction: column; align-items: center; text-align: center; }
      .legal-list { flex-direction: column; align-items: center; }
    }
  `,
})
export class SiteFooterComponent {
  readonly pages: FooterLink[] = [
    { label: 'Home', path: '/' },
    { label: 'About', path: '/about' },
  ];
}
