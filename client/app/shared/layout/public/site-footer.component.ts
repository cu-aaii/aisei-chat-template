import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LOOK } from '../../look/look';
import { ColorMode, ThemeService } from '../../services/theme/theme.service';
import { PRIMARY_NAV } from './nav-items';

interface FooterLink {
  label: string;
  href: string;
}

/**
 * The Cornell footer, from the design system's `.cu-footer` block (design-system/blocks/footer.css): a content
 * band with the site's own content (who you are, how to reach you, link lists) and, beside it, the Appearance
 * switch (Automatic follows the operating system, Light and Dark are remembered; `modeSwitch` in provideLook turns
 * it off); then the sub-footer with the three links every Cornell site carries. The year is always the current one.
 *
 * Replace the address, the contact address and the link lists with your own. Page links come from nav-items.ts.
 */
@Component({
  selector: 'app-site-footer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  host: { style: 'display: block' },
  template: `
    <footer class="cu-footer" aria-label="Site footer">
      <div class="cu-footer__main">
        <div class="cu-container cu-footer__cols">
          <div class="cu-footer__primary">
            <h2 class="cu-footer__heading">{{ siteName }}</h2>
            <div class="app-footer__columns">
              <div>
                <address>
                  Your team or lab name<br />
                  Cornell University, Ithaca, NY 14853
                </address>
                <p><a [href]="'mailto:' + contactEmail">Contact us</a></p>
              </div>
              <nav aria-labelledby="footer-pages">
                <h3 id="footer-pages">Pages</h3>
                <ul role="list">
                  @for (item of pages; track item.path) {
                    <li><a [routerLink]="item.path">{{ item.label }}</a></li>
                  }
                </ul>
              </nav>
              <nav aria-labelledby="footer-resources">
                <h3 id="footer-resources">Resources</h3>
                <ul role="list">
                  @for (link of resources; track link.href) {
                    <li><a [href]="link.href">{{ link.label }}</a></li>
                  }
                </ul>
              </nav>
            </div>
            <p class="app-footer__a11y">
              If you have a disability and are having trouble accessing information on this website or need materials
              in an alternate format, contact <a [href]="'mailto:' + contactEmail">{{ contactEmail }}</a> for assistance.
            </p>
          </div>
          <div class="cu-footer__secondary">
            @if (look.modeSwitch) {
              <div class="cu-footer__prefs">
                <fieldset class="cu-mode-switch">
                  <legend>Appearance</legend>
                  <span class="cu-mode-switch__options">
                    @for (option of modes; track option.value) {
                      <label>
                        <input
                          type="radio"
                          name="cu-footer-mode"
                          [value]="option.value"
                          [checked]="theme.mode() === option.value"
                          (change)="theme.setMode(option.value)"
                        /><span>{{ option.label }}</span>
                      </label>
                    }
                  </span>
                </fieldset>
              </div>
            }
          </div>
        </div>
      </div>
      <div class="cu-footer__sub">
        <div class="cu-container">
          <div class="cu-footer__links">
            <ul role="list">
              <li><a href="https://www.cornell.edu">Cornell University</a> &copy;{{ year }}</li>
              <li><a href="https://privacy.cornell.edu/">University Privacy</a></li>
            </ul>
            <ul role="list">
              <li>
                <a href="https://tdx.cornell.edu/TDClient/39/Portal/Requests/ServiceDet?ID=373">Web Accessibility Assistance</a>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  `,
  styles: `
    /* The content band's own columns (address, Pages, Resources): no block lays out a footer's link lists, so a
       small grid here, tokens only. Colours are the footer block's (it sets the link colour and focus ring). */
    .app-footer__columns {
      display: grid;
      gap: var(--space-5);
      margin-block-end: var(--space-5);
    }
    @media (min-width: 768px) {
      .app-footer__columns { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    }
    address { font-style: normal; margin-block-end: var(--space-3); }
    h3 {
      margin: 0 0 var(--space-2);
      color: var(--footer-heading);
      font-family: var(--font-sans);
      font-size: var(--text-base);
      font-weight: var(--weight-semibold);
    }
    ul { margin: 0; padding: 0; list-style: none; }
    li { margin-block-end: var(--space-2); }
  `,
})
export class SiteFooterComponent {
  protected readonly siteName = 'AI Innovation Hub';
  protected readonly contactEmail = 'you@cornell.edu';
  protected readonly pages = PRIMARY_NAV;
  protected readonly resources: FooterLink[] = [
    { label: 'Cornell AI Initiative', href: 'https://ai.cornell.edu' },
    { label: 'Built with aisei-chat-template', href: 'https://github.com/cu-aaii/aisei-chat-template' },
  ];
  protected readonly year = new Date().getFullYear();
  protected readonly theme = inject(ThemeService);
  protected readonly look = inject(LOOK);
  protected readonly modes: { value: ColorMode; label: string }[] = [
    { value: 'auto', label: 'Automatic' },
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
  ];
}
