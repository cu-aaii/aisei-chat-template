import { ChangeDetectionStrategy, Component, ElementRef, inject, linkedSignal, viewChildren } from '@angular/core';
import { Navigation, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { PRIMARY_NAV } from './nav-items';
import { LabWordmarkComponent } from '../../components/lab-wordmark/lab-wordmark.component';
import { IconComponent } from '../../components/icon/icon.component';

/**
 * Public site chrome: red masthead with wordmark + seal, and
 * the primary navigation (hover dropdowns on desktop, hamburger panel on
 * mobile). Links come from nav-items.ts.
 *
 * Desktop dropdowns are disclosure buttons, not CSS alone: hover still opens one
 * for a mouse, and the button toggles `openDropdown` and reports `aria-expanded`.
 * Focus is the single source of truth for "the user has left the menu": the
 * button takes focus when clicked (Safari does not give it focus on its own), so
 * an outside click, Tab, or choosing a link all arrive as one `focusout`, and that
 * is the only thing that closes it, apart from Escape (heard on this component's
 * host, so it never takes an Escape from elsewhere on the page) and a navigation:
 * `openDropdown` is a `linkedSignal` of `router.currentNavigation`, so it resets to
 * closed whenever one starts or ends. No document listeners and no RxJS: under
 * zone.js a document listener runs change detection for every click on the page. The old `:focus-within` rule kept a dropdown open over
 * the next page after one of its links was clicked, because focus stayed on it.
 */
@Component({
  selector: 'app-public-masthead',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, LabWordmarkComponent, IconComponent],
  host: { class: 'public-masthead', '(keydown.escape)': 'onEscape()' },
  template: `
    <a class="skip-link" href="#main" (click)="skipToMain($event)">Skip to main content</a>

    <!-- Masthead -->
    <div class="masthead">
      <div class="container-fluid">
        <div class="masthead-row">
          <a class="brand" routerLink="/">
            <app-lab-wordmark class="wordmark" />
            <span class="sr-only">Cornell AI Innovation Hub</span>
          </a>
          <div class="right">
            <a class="seal-link" href="https://www.cornell.edu" target="_blank" rel="noopener">
              <img class="seal" src="/assets/branding/cornell_seal.svg" alt="" />
              <span class="cu-text" aria-hidden="true">Cornell University</span>
              <span class="sr-only">Cornell University</span>
            </a>
            <div class="icon-group">
              <button
                type="button"
                class="veggie"
                [class.open]="menuOpen()"
                [attr.aria-expanded]="menuOpen()"
                aria-controls="mobile-menu-panel"
                aria-label="Toggle navigation menu"
                (click)="toggleMenu()"
              >
                <span></span><span></span><span></span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Primary nav (desktop) -->
    <nav class="primary-nav" aria-label="Primary">
      <div class="container-fluid">
        <ul class="nav-list">
        @for (item of nav; track item.label) {
          <li
            [class.has-children]="!!item.children"
            [class.open]="openDropdown() === item.label"
            (focusout)="onDropdownFocusOut($event, item.label)"
          >
            @if (item.children) {
              <button
                #dropdownButton
                type="button"
                [attr.aria-expanded]="openDropdown() === item.label"
                [attr.aria-controls]="'nav-menu-' + $index"
                (click)="toggleDropdown(item.label, dropdownButton)"
              >
                {{ item.label }}
                <app-icon class="caret" name="expand_more" />
              </button>
              <ul class="dropdown" [id]="'nav-menu-' + $index">
                @for (child of item.children; track child.path) {
                  <li>
                    <a [routerLink]="child.path">{{ child.label }}</a>
                  </li>
                }
              </ul>
            } @else {
              <a
                [routerLink]="item.path"
                routerLinkActive="active"
                [routerLinkActiveOptions]="{ exact: item.path === '/' }"
                [class.highlight]="item.highlight"
              >{{ item.label }}</a>
            }
          </li>
        }
        </ul>
      </div>
    </nav>

    <!-- Primary nav (mobile) -->
    @if (menuOpen()) {
      <nav id="mobile-menu-panel" class="mobile-panel" aria-label="Primary">
        @for (item of nav; track item.label) {
          @if (item.children) {
            <span class="group-label">{{ item.label }}</span>
            @for (child of item.children; track child.path) {
              <a class="child" [routerLink]="child.path" (click)="closeMenu()">{{ child.label }}</a>
            }
          } @else {
            <a [routerLink]="item.path" (click)="closeMenu()">{{ item.label }}</a>
          }
        }
      </nav>
    }
  `,
  styles: `
    :host {
      display: block;
      font-family: var(--body-font);
    }

    .skip-link {
      position: absolute;
      left: -9999px;
      top: 0;
      background: #fff;
      color: var(--color-accent);
      padding: 8px 16px;
      z-index: 100;
    }
    .skip-link:focus { left: 8px; top: 8px; }

    /* Masthead */
    .masthead { background: var(--color-accent); color: #fff; }
    .masthead .container-fluid { padding-top: 40px; padding-bottom: 40px; }
    .masthead-row { display: flex; justify-content: space-between; align-items: center; }
    .brand { display: flex; align-items: center; text-decoration: none; color: #fff; }
    .brand .wordmark { width: 440px; height: auto; display: block; }
    .masthead .right { display: flex; align-items: flex-start; gap: 20px; }
    .seal-link { display: inline-flex; align-items: center; gap: 8px; color: inherit; text-decoration: none; }
    .masthead .seal { height: 120px; width: auto; display: block; }
    .cu-text { display: none; }
    @media (min-width: 992px) {
      .seal-link { margin-right: 60px; }
    }

    /* Hamburger group, kept in a flex group so more icons can sit adjacent with
       matching button-box styling at every breakpoint. */
    .icon-group { display: flex; align-items: center; gap: 2px; }


    /* Hamburger */
    .veggie {
      display: none;
      width: 32px; height: 24px;
      flex-direction: column;
      justify-content: space-between;
      background: none; border: none; padding: 0; cursor: pointer;
    }
    .veggie span { display: block; height: 3px; width: 100%; background: #fff; border-radius: 2px; transition: transform .2s, opacity .2s; }
    .veggie.open span:nth-child(1) { transform: translateY(10.5px) rotate(45deg); }
    .veggie.open span:nth-child(2) { opacity: 0; }
    .veggie.open span:nth-child(3) { transform: translateY(-10.5px) rotate(-45deg); }

    /* Primary nav — desktop */
    .primary-nav { background: var(--color-nav); }
    .primary-nav .nav-list {
      list-style: none;
      display: flex;
      margin: 0;
      padding: 0;
      flex-wrap: wrap;
    }
    .primary-nav li { position: relative; }
    .primary-nav a,
    .primary-nav button {
      display: flex;
      align-items: center;
      gap: 2px;
      padding: 19px 28px;
      color: #fff;
      text-decoration: none;
      font-size: 17px;
      font-family: var(--body-font);
      background: none;
      border: none;
      cursor: pointer;
      line-height: 1.2;
    }
    .primary-nav .caret { font-size: 18px; }
    .primary-nav li:hover > a,
    .primary-nav li:hover > button,
    .primary-nav li.open > button,
    .primary-nav a:focus-visible,
    .primary-nav button:focus-visible,
    .primary-nav a.active { background: rgba(255, 255, 255, .14); }
    .primary-nav a.highlight { background: #fff; color: var(--color-accent); font-weight: 700; }

    .primary-nav .dropdown {
      list-style: none;
      margin: 0;
      padding: 0;
      display: none;
      position: absolute;
      top: 100%;
      left: 0;
      background: var(--color-dropdown-bg);
      min-width: 150px;
      width: max-content;
      box-shadow: none;
      z-index: 40;
    }
    /* Hover opens for a mouse; .open (click, Enter/Space) for everything else. Not
       :focus-within: focus stays on a clicked link after navigation, which kept
       the dropdown open over the next page. */
    .primary-nav li.has-children:hover .dropdown,
    .primary-nav li.has-children.open .dropdown { display: block; }
    .primary-nav .caret { transition: transform .15s ease; }
    .primary-nav li.open .caret { transform: rotate(180deg); }
    .primary-nav .dropdown a { color: #fff; padding: 19px 28px; font-size: 17px; white-space: nowrap; }
    .primary-nav .dropdown a:hover,
    .primary-nav .dropdown a:focus { background: rgba(255, 255, 255, .1); }

    /* Mobile panel */
    .mobile-panel { background: var(--color-nav); }
    .mobile-panel a,
    .mobile-panel .group-label {
      display: block;
      padding: 12px 24px;
      color: #fff;
      text-decoration: none;
      font-size: 15px;
      border-top: 1px solid rgba(255, 255, 255, .15);
    }
    .mobile-panel .group-label { font-weight: 700; opacity: .85; font-size: 13px; text-transform: uppercase; letter-spacing: .04em; }
    .mobile-panel a.child { padding-left: 40px; font-size: 14px; }
    .mobile-panel a:hover { background: rgba(255, 255, 255, .12); }

    @media (max-width: 767px) {
      .primary-nav { display: none; }
      .veggie { display: flex; }
      .masthead .container-fluid { padding: 0; }
      .masthead-row { flex-wrap: wrap; align-items: stretch; }

      .brand {
        order: 2;
        flex-basis: 100%;
        background: #fff;
        padding: 16px 18px;
      }
      .brand .wordmark {
        width: 220px;
        --wordmark-fill: #222;
        --wordmark-fill-accent: var(--color-accent);
      }

      .masthead .right {
        order: 1;
        flex-basis: 100%;
        height: 48px;
        justify-content: space-between;
        align-items: center;
        padding: 0 15px;
      }
      .masthead .seal { height: 36px; }
      .cu-text {
        display: inline-block;
        font-size: 15px;
        white-space: nowrap;
        color: #fff;
      }

      .veggie {
        width: 48px;
        height: 48px;
        padding: 12px 8px;
        box-sizing: border-box;
        background: var(--color-accent-dark);
      }
    }
  `,
})
export class PublicMastheadComponent {
  private readonly router = inject(Router);
  /** The dropdown buttons, in nav order: where Escape sends focus back to. */
  private readonly dropdownButtons = viewChildren<ElementRef<HTMLButtonElement>>('dropdownButton');

  readonly nav = PRIMARY_NAV;
  /** The mobile panel. Linked to navigation like openDropdown, so the back button closes it too. */
  readonly menuOpen = linkedSignal<Navigation | null, boolean>({
    source: this.router.currentNavigation,
    computation: () => false,
  });
  /**
   * Label of the desktop dropdown that is open, or null; one at a time. Linked to
   * the router's current navigation, so any navigation closes it: that is what
   * closes it when one of its links is chosen (focus stays inside the item then,
   * so focusout does not fire), and it covers the back button too.
   */
  readonly openDropdown = linkedSignal<Navigation | null, string | null>({
    source: this.router.currentNavigation,
    computation: () => null,
  });

  /**
   * Focus first: Safari and Firefox on macOS do not focus a clicked button, and
   * focusout is what closes the dropdown, so without focus an outside click could
   * not close it there.
   */
  toggleDropdown(label: string, button: HTMLButtonElement) {
    button.focus();
    this.openDropdown.update((open) => (open === label ? null : label));
  }

  /**
   * Focus left the item: an outside click, Tab past the last link, or a link
   * click that navigated. The window itself losing focus (switching apps) also
   * fires focusout, with no relatedTarget; that keeps the dropdown open.
   */
  onDropdownFocusOut(event: FocusEvent, label: string) {
    if (this.openDropdown() !== label) return;
    const next = event.relatedTarget as Node | null;
    if (next === null && !document.hasFocus()) return;
    if (next && (event.currentTarget as HTMLElement).contains(next)) return;
    this.openDropdown.set(null);
  }

  /** Escape inside the nav closes the open dropdown and returns focus to its button. */
  onEscape() {
    const open = this.openDropdown();
    if (open === null) return;
    const i = this.nav.filter((item) => item.children).findIndex((item) => item.label === open);
    this.openDropdown.set(null);
    this.dropdownButtons()[i]?.nativeElement.focus();
  }

  toggleMenu() {
    this.menuOpen.update((v) => !v);
  }

  closeMenu() {
    this.menuOpen.set(false);
  }

  /**
   * The `<base href="/">` tag makes the browser resolve a bare `#main` href
   * against the root path, not the current route — so on any page other than
   * `/` it navigates away instead of jumping to the in-page anchor. Handle it
   * ourselves so it never falls back to real navigation.
   */
  skipToMain(event: Event) {
    event.preventDefault();
    document.getElementById('main')?.focus();
  }

}
