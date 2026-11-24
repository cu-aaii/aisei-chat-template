import {
  Component,
  ChangeDetectionStrategy,
  afterRenderEffect,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavItem } from '../public/nav-items';
import type { BannerSlideView } from '../../look/look';
import { stopsIn, wrapTab } from '../focus-wrap';

/** One entry in the utility bar (and, on phones, in the menu overlay's "Utility navigation"). */
export interface UtilityItem {
  label: string;
  /** In-app route, e.g. '/admin'. */
  routerLink?: string;
  /** External or full URL. */
  href?: string;
  /** A button instead of a link (e.g. Sign out). */
  action?: () => void;
}

/**
 * The CDS site banner, built from the design system's `.cu-header` block (design-system/blocks/header.css).
 *
 * Two kinds, as CDS: `home` has the Cornell seal beside the title; `inner` carries the Cornell wordmark in
 * the top bar and no seal. The seal and wordmark are the official artwork from the sprite in index.html.
 *
 * Behaviour (the reference is design-system/showcase/showcase.js): below 960px the Menu button opens the
 * main navigation as a modal overlay. Focus moves to Close, Tab is kept inside, everything else on the page
 * is inert, Escape or Close returns focus to the Menu button, and any navigation or widening closes it.
 */
@Component({
  selector: 'app-site-header',
  imports: [RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Keys are handled on the host (they bubble from the overlay's links and buttons), not on the <nav>.
  host: { style: 'display: block', '(keydown)': 'onNavKeydown($event)' },
  template: `
    <header
      class="cu-header"
      [class.cu-header--inner]="kind() === 'inner'"
      [class.cu-header--photo]="!!photo() || slideshow()"
      [class.cu-header--slides]="slideshow()"
      [class.cu-header--logo-right]="logoRight()"
      [class.cu-header--medium]="height() === 'medium'"
      [class.cu-header--tall]="height() === 'tall'"
      [style.--header-photo]="photo()"
      [attr.data-theme]="theme()"
      data-collapsible
      aria-label="Site banner"
    >
      <!-- Slideshow banner: decorative pictures that cross-fade, with one Pause button (below, in the brand zone). -->
      @if (slideshow()) {
        <div class="cu-header__slides" aria-hidden="true">
          @for (s of slides(); track $index) {
            <div class="cu-header__slide" [class.is-current]="$index === slide()" [style.background-image]="s.css">
              <!-- A slide's video plays over its picture, only while the slide shows (see the constructor). -->
              @if (s.video.length) {
                <video [muted]="true" loop playsinline preload="metadata" (play)="syncVideo()" (pause)="syncVideo()">
                  @for (v of s.video; track v.src) {
                    <source [src]="v.src" [type]="v.type" />
                  }
                </video>
              }
            </div>
          }
        </div>
      }
      <!-- No utility items on the home kind: no bar at all, just the 4px line (CDS blocks.html). -->
      @if (kind() === 'inner' || utility().length) {
      <div class="cu-utility" [inert]="overlay()">
        <div class="cu-container cu-utility__inner">
          @if (kind() === 'inner') {
            <a class="cu-utility__wordmark" href="https://www.cornell.edu">
              <svg role="img" aria-label="Cornell University"><use href="#cu-wordmark" /></svg>
            </a>
          }
          @if (utility().length) {
            <nav aria-label="Utility">
              <ul class="cu-utility__list" role="list">
                @for (item of utility(); track item.label) {
                  <li>
                    @if (item.action) {
                      <button class="cu-utility__link" type="button" (click)="item.action()">{{ item.label }}</button>
                    } @else if (item.routerLink) {
                      <a class="cu-utility__link" [routerLink]="item.routerLink">{{ item.label }}</a>
                    } @else if (item.href) {
                      <a class="cu-utility__link" [href]="item.href">{{ item.label }}</a>
                    } @else {
                      <span class="cu-utility__link">{{ item.label }}</span>
                    }
                  </li>
                }
              </ul>
            </nav>
          }
        </div>
      </div>
      }

      @if (items().length) {
        <div class="cu-header__buttons" [inert]="overlay()">
          <button
            #menuButton
            class="cu-header__button cu-header__menu"
            type="button"
            [attr.aria-expanded]="menuOpen()"
            [attr.aria-controls]="navId"
            (click)="menuOpen.set(!menuOpen())"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
            <span class="cu-sr-only">Menu</span>
          </button>
        </div>
      }

      <div class="cu-brand" [inert]="overlay()">
        <div class="cu-container cu-brand__inner">
          @if (kind() === 'home') {
            <a class="cu-brand__seal" href="https://www.cornell.edu">
              <svg class="cu-seal" role="img" aria-label="Cornell University"><use href="#cu-seal" /></svg>
            </a>
          }
          @if (title()) {
            <div class="cu-brand__text">
              <p class="cu-brand__title"><a [routerLink]="homeLink()">{{ title() }}</a></p>
              @if (subtitle()) {
                <p class="cu-brand__subtitle">{{ subtitle() }}</p>
              }
            </div>
          }
        </div>
      </div>

      @if (items().length) {
        <nav
          #nav
          class="cu-nav"
          [class]="navClass()"
          aria-label="Main"
          [id]="navId"
          [attr.role]="overlay() ? 'dialog' : null"
          [attr.aria-modal]="overlay() ? 'true' : null"
          [attr.tabindex]="overlay() ? -1 : null"
          [class.cu-nav--menu]="hasMenus()"
        >
          <a class="cu-nav__home" [routerLink]="homeLink()">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 11 12 3l9 8M5 10v10h5v-6h4v6h5V10" /></svg>
            <span class="cu-sr-only">Home</span>
          </a>
          <button #closeButton class="cu-nav__close" type="button" (click)="close(true)">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6 6 18" /></svg>
            <span class="cu-sr-only">Close menu</span>
          </button>
          <div class="cu-container">
            <ul class="cu-nav__list" role="list">
              @for (item of items(); track item.label) {
                @if (item.children?.length) {
                  <li
                    class="cu-nav__parent"
                    [class.is-open]="openMenu() === item.label"
                    (mouseenter)="hoverMenu(item.label, true)"
                    (mouseleave)="hoverMenu(item.label, false)"
                    (focusout)="onMenuFocusOut($event, item.label)"
                  >
                    <a
                      class="cu-nav__link"
                      [routerLink]="item.path"
                      routerLinkActive
                      ariaCurrentWhenActive="page"
                      >{{ item.label }}</a
                    >
                    <button
                      #menuToggle
                      class="cu-nav__toggle"
                      type="button"
                      [attr.aria-expanded]="openMenu() === item.label"
                      [attr.aria-controls]="navId + '-sub-' + $index"
                      (click)="toggleMenu(item.label, menuToggle)"
                    >
                      <span class="cu-sr-only">{{ item.label }} submenu</span>
                    </button>
                    <ul class="cu-nav__sub" role="list" [id]="navId + '-sub-' + $index">
                      @for (child of item.children; track child.path) {
                        <li>
                          <a class="cu-nav__link" [routerLink]="child.path" routerLinkActive ariaCurrentWhenActive="page">{{
                            child.label
                          }}</a>
                        </li>
                      }
                    </ul>
                  </li>
                } @else {
                  <li>
                    <a
                      class="cu-nav__link"
                      [routerLink]="item.path"
                      routerLinkActive
                      ariaCurrentWhenActive="page"
                      [routerLinkActiveOptions]="{ exact: item.path === '/' }"
                      >{{ item.label }}</a
                    >
                  </li>
                }
              }
            </ul>
            @if (utility().length) {
              <details class="cu-nav__more">
                <summary>Utility navigation</summary>
                <ul role="list">
                  @for (item of utility(); track item.label) {
                    <li>
                      @if (item.action) {
                        <button type="button" class="cu-nav__more-button" (click)="item.action()">{{ item.label }}</button>
                      } @else if (item.routerLink) {
                        <a [routerLink]="item.routerLink">{{ item.label }}</a>
                      } @else if (item.href) {
                        <a [href]="item.href">{{ item.label }}</a>
                      } @else {
                        <span>{{ item.label }}</span>
                      }
                    </li>
                  }
                </ul>
              </details>
            }
          </div>
        </nav>
      }

      <!-- Slideshow captions and controls: the carousel for assistive technology (the pictures behind are decoration). -->
      @if (slideshow()) {
        <section
          class="cu-header__feature"
          aria-roledescription="carousel"
          aria-label="Featured stories"
          [inert]="overlay()"
          (focusin)="onFeatureFocus($event)"
        >
          <div class="cu-container">
            <div class="cu-header__captions">
              @for (s of slides(); track $index) {
                <div
                  class="cu-header__caption"
                  [class.is-current]="$index === slide()"
                  (focusin)="onCaptionFocus($index)"
                  role="group"
                  aria-roledescription="slide"
                  [attr.aria-label]="$index + 1 + ' of ' + slides().length"
                >
                  @if (s.title) {
                    <h2>{{ s.title }}</h2>
                  }
                  @if (s.text || (s.href && s.linkLabel)) {
                    <p>
                      {{ s.text }}
                      @if (s.href && s.linkLabel) {
                        @if (s.href.startsWith('/')) {
                          <a [routerLink]="s.href">{{ s.linkLabel }}</a>
                        } @else {
                          <a [href]="s.href">{{ s.linkLabel }}</a>
                        }
                      }
                    </p>
                  }
                </div>
              }
            </div>
            <div class="cu-header__controls" role="group" aria-label="Featured stories controls">
              <span class="cu-sr-only" role="status">{{ said() }}</span>
              <div class="cu-slider__buttons">
                <button type="button" class="cu-slider__btn" aria-label="Previous slide" (click)="step(-1)">
                  <svg class="cu-icon" aria-hidden="true" focusable="false"><use href="#cu-i-chevron_left" /></svg>
                </button>
                <button type="button" class="cu-slider__btn" aria-label="Next slide" (click)="step(1)">
                  <svg class="cu-icon" aria-hidden="true" focusable="false"><use href="#cu-i-chevron_right" /></svg>
                </button>
                @if (!reduceMotion) {
                  <button
                    type="button"
                    class="cu-slider__btn"
                    data-toggle
                    [attr.aria-label]="playing() ? 'Pause slideshow' : 'Play slideshow'"
                    (click)="playing.set(!playing())"
                  >
                    <svg class="cu-icon" aria-hidden="true" focusable="false"><use [attr.href]="playing() ? '#cu-i-pause' : '#cu-i-play_arrow'" /></svg>
                  </button>
                }
              </div>
              <ul class="cu-slider__pips" role="list">
                @for (s of slides(); track $index) {
                  <li>
                    <button
                      type="button"
                      class="cu-slider__pip"
                      [attr.aria-current]="$index === slide() ? 'true' : null"
                      [attr.aria-label]="'Slide ' + ($index + 1) + ' of ' + slides().length + (s.title ? ': ' + s.title : '')"
                      (click)="go($index)"
                      (keydown)="onPipKey($event)"
                    ></button>
                  </li>
                }
              </ul>
              <!-- The video's own control, with its own words, apart from the slideshow's buttons. -->
              @if (hasVideo()) {
                <button
                  type="button"
                  class="cu-slider__video"
                  data-act="video"
                  [attr.aria-label]="videoPlaying() ? 'Pause video' : 'Play video'"
                  (click)="toggleVideo()"
                >
                  <svg class="cu-icon" aria-hidden="true" focusable="false"><use [attr.href]="videoPlaying() ? '#cu-i-pause' : '#cu-i-play_arrow'" /></svg>
                  <span>{{ videoPlaying() ? 'Pause video' : 'Play video' }}</span>
                </button>
              }
            </div>
          </div>
        </section>
      }
    </header>
  `,
  styles: `
    .cu-slider__btn .cu-icon { font-size: 1.5rem; }
    .cu-slider__video .cu-icon { font-size: 1.25rem; }
  `,
})
export class SiteHeaderComponent {
  /** `home` (seal, for the home page) or `inner` (wordmark in the bar, for every other page). */
  readonly kind = input<'home' | 'inner'>('home');
  readonly title = input<string>('');
  readonly subtitle = input<string>('');
  /** A design-system theme for the header only (`red-header`, `dark-header`, `light-bar`, `dark-bar`, `blue-bar`), or null. */
  readonly theme = input<string | null>(null);
  readonly homeLink = input('/');
  /** The main navigation (nav-items.ts). An item with `children` is a CDS dropdown (`cu-nav--menu`): its label links to its landing page, its chevron opens the submenu. */
  readonly items = input<NavItem[]>([]);
  readonly utility = input<UtilityItem[]>([]);
  /** The design system's default: items flush top to bottom, the current page a tint. Add modifiers to vary it. */
  readonly navClass = input('cu-nav');
  /** A CSS value for `--header-photo` (a photograph behind the banner; use with the `dark-header` theme), or null. */
  readonly photo = input<string | null>(null);
  /** Two or more slides: a slideshow behind the banner, with captions and controls (use with the `dark-header` theme). */
  readonly slides = input<BannerSlideView[]>([]);
  /** The seal on the right and the title on the left, as CDS `logo-right`. */
  readonly logoRight = input(false);
  /** `medium` or `tall` give the banner room; the navigation stays under the logo, with the picture below. */
  readonly height = input<'short' | 'medium' | 'tall'>('short');
  protected readonly slideshow = computed(() => this.slides().length > 1);
  protected readonly slide = signal(0);
  protected readonly playing = signal(true);
  /** The slide showing holds a video: its Pause / Play video button is shown. */
  protected readonly hasVideo = computed(() => (this.slides()[this.slide()]?.video.length ?? 0) > 0);
  protected readonly videoPlaying = signal(false);
  /** Slides whose video the person paused: it stays paused when the slide comes back. */
  private readonly personPaused = new Set<number>();
  /** What the status line says after a control moved the slide (focus on a caption already reads it). */
  protected readonly said = signal('');

  protected go(i: number): void {
    const n = this.slides().length;
    this.playing.set(false); // any use of a control stops autoplay for good
    this.slide.set(((i % n) + n) % n);
    const s = this.slides()[this.slide()];
    this.said.set(`Slide ${this.slide() + 1} of ${n}${s?.title ? ': ' + s.title : ''}`);
  }
  /** As CDS: focus on a caption (Tab, or a screen reader moving through the headings) shows its slide. */
  protected onCaptionFocus(i: number): void {
    if (i !== this.slide()) this.slide.set(i);
  }
  protected step(d: number): void {
    this.go(this.slide() + d);
  }
  /** Focus entering the captions or controls stops autoplay, except on the Pause button itself. */
  protected onFeatureFocus(e: FocusEvent): void {
    if (!(e.target as HTMLElement).closest('[data-toggle]')) this.playing.set(false);
  }
  /** Left / Right / Home / End on a dot move between slides and keep focus on the dot. */
  protected onPipKey(e: KeyboardEvent): void {
    const n = this.slides().length;
    const target = { ArrowLeft: this.slide() - 1, ArrowRight: this.slide() + 1, Home: 0, End: n - 1 }[e.key];
    if (target === undefined || e.ctrlKey || e.altKey || e.metaKey) return;
    e.preventDefault();
    this.go(target);
    queueMicrotask(() => this.host.nativeElement.querySelectorAll<HTMLElement>('.cu-slider__pip')[this.slide()]?.focus());
  }

  /** The video element of each slide, in order (null for a picture-only slide). */
  private videos(): (HTMLVideoElement | null)[] {
    return Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>('.cu-header__slide')).map((e) => e.querySelector('video'));
  }
  /** Copy the showing video's state into the signal; called from the videos' play and pause events. */
  protected syncVideo(): void {
    const v = this.videos()[this.slide()];
    this.videoPlaying.set(!!v && !v.paused);
  }
  protected toggleVideo(): void {
    const v = this.videos()[this.slide()];
    if (!v) return;
    if (v.paused) {
      this.personPaused.delete(this.slide());
      v.play().catch(() => this.syncVideo());
    } else {
      this.personPaused.add(this.slide());
      v.pause();
    }
  }

  private static count = 0;
  protected readonly navId = `cu-site-menu-${++SiteHeaderComponent.count}`;

  readonly menuOpen = signal(false);
  private readonly narrow = signal(false);
  /** The menu is a modal overlay only on narrow screens; on desktop the bar is always shown. */
  readonly overlay = computed(() => this.menuOpen() && this.narrow());

  private readonly doc = inject(DOCUMENT);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  /** People who ask for reduced motion get the first picture, still, and no Pause button. */
  protected readonly reduceMotion = !!this.doc.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  private readonly menuButton = viewChild<ElementRef<HTMLButtonElement>>('menuButton');
  private readonly closeButton = viewChild<ElementRef<HTMLButtonElement>>('closeButton');
  private readonly nav = viewChild<ElementRef<HTMLElement>>('nav');

  constructor() {
    const destroyRef = inject(DestroyRef);
    const media = this.doc.defaultView?.matchMedia?.('(max-width: 959px)');
    if (media) {
      this.narrow.set(media.matches);
      const onChange = (e: MediaQueryListEvent) => {
        this.narrow.set(e.matches);
        if (!e.matches) this.menuOpen.set(false);
      };
      media.addEventListener('change', onChange);
      destroyRef.onDestroy(() => media.removeEventListener('change', onChange));
    }

    // A slide's video plays only while its slide shows: never by itself with reduced motion (the picture stays), and not again
    // after the person paused it. A slide that is not showing stops and rewinds.
    afterRenderEffect(() => {
      const i = this.slide();
      this.slides();
      this.videos().forEach((v, j) => {
        if (!v) return;
        if (j === i) {
          if (!this.personPaused.has(j) && !this.reduceMotion) v.play().catch(() => undefined);
        } else {
          v.pause();
          v.currentTime = 0;
        }
      });
      this.syncVideo();
    });

    // The slideshow advances every 6 seconds until paused (never at all with reduced motion).
    effect((onCleanup) => {
      if (!this.slideshow() || !this.playing() || this.reduceMotion) return;
      const id = setInterval(() => this.slide.update((i) => (i + 1) % this.slides().length), 6000);
      onCleanup(() => clearInterval(id));
    });

    // Any navigation closes the overlay (a link was chosen).
    inject(Router)
      .events.pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe(() => {
        this.menuOpen.set(false);
        this.openMenu.set(null);
      });

    // While the overlay is open, everything outside the header is inert; focus goes to Close.
    effect((onCleanup) => {
      if (!this.overlay()) return;
      const inerted = this.inertOutside();
      queueMicrotask(() => this.closeButton()?.nativeElement.focus());
      onCleanup(() => inerted.forEach((el) => el.removeAttribute('inert')));
    });
  }

  protected readonly hasMenus = computed(() => this.items().some((i) => !!i.children?.length));
  /** The label of the open dropdown, or null: one at a time. Any navigation closes it (constructor). */
  protected readonly openMenu = signal<string | null>(null);
  private readonly menuToggles = viewChildren<ElementRef<HTMLButtonElement>>('menuToggle');
  private hoverTimer: ReturnType<typeof setTimeout> | undefined;

  /** The chevron is a disclosure button. Focus it first: Safari does not focus a clicked button, and focus-out is what closes the menu. */
  protected toggleMenu(label: string, button: HTMLButtonElement): void {
    button.focus();
    this.openMenu.update((open) => (open === label ? null : label));
  }

  /** Desktop only: a pointer opens a dropdown on hover and it closes shortly after the pointer leaves (showcase.js initNav). */
  protected hoverMenu(label: string, enter: boolean): void {
    if (this.narrow()) return;
    clearTimeout(this.hoverTimer);
    if (enter) this.openMenu.set(label);
    else this.hoverTimer = setTimeout(() => this.openMenu.update((o) => (o === label ? null : o)), 180);
  }

  /** Focus left the item (Tab past it, a click elsewhere): close it. A window losing focus (no relatedTarget) keeps it open. */
  protected onMenuFocusOut(e: FocusEvent, label: string): void {
    if (this.openMenu() !== label) return;
    const next = e.relatedTarget as Node | null;
    if (next === null && !this.doc.hasFocus()) return;
    if (next && (e.currentTarget as HTMLElement).contains(next)) return;
    this.openMenu.set(null);
  }

  /** Close the menu; `returnFocus` puts focus back on the Menu button (Escape, Close). */
  close(returnFocus = false): void {
    this.menuOpen.set(false);
    // After change detection has removed `inert` from the buttons, or the focus call is ignored.
    if (returnFocus) setTimeout(() => this.menuButton()?.nativeElement.focus());
  }

  protected onNavKeydown(e: KeyboardEvent): void {
    const open = this.openMenu();
    if (e.key === 'Escape' && open !== null && !this.overlay()) {
      // Escape closes the open dropdown and puts focus back on its chevron.
      const i = this.items().filter((it) => it.children?.length).findIndex((it) => it.label === open);
      this.openMenu.set(null);
      this.menuToggles()[i]?.nativeElement.focus();
      return;
    }
    if (!this.overlay()) return;
    if (e.key === 'Escape' && this.nav()?.nativeElement.contains(e.target as Node)) {
      e.preventDefault();
      this.close(true);
      return;
    }
    if (e.key !== 'Tab') return;
    const nav = this.nav()?.nativeElement;
    if (!nav || !nav.contains(e.target as Node)) return;
    wrapTab(e, stopsIn(nav), nav, this.doc.activeElement);
  }

  /** Mark every sibling of the header's ancestors (up to <body>) inert, and return what was marked. */
  private inertOutside(): HTMLElement[] {
    const marked: HTMLElement[] = [];
    let node: HTMLElement | null = this.host.nativeElement;
    while (node && node !== this.doc.body) {
      const parent: HTMLElement | null = node.parentElement;
      if (!parent) break;
      for (const sibling of Array.from(parent.children) as HTMLElement[]) {
        if (sibling === node || sibling.hasAttribute('inert') || sibling.tagName === 'SCRIPT') continue;
        sibling.setAttribute('inert', '');
        marked.push(sibling);
      }
      node = parent;
    }
    return marked;
  }
}
