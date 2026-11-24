import { InjectionToken, inject, provideAppInitializer, type EnvironmentProviders, type Provider } from '@angular/core';
import { DOCUMENT } from '@angular/common';

/**
 * The app's chosen Cornell look: every option the design system offers an app owner, in one object.
 * Pick it in design-system/showcase/customizer.html (it previews each option and writes this object for you),
 * then pass it to `provideLook()` in app.config.ts. Anything left out keeps the default below.
 */
export interface Look {
  /** The public site's header (design-system/themes/): the CDS default, a red or dark banner, or a coloured top bar. */
  publicHeader: PublicHeaderStyle;
  /**
   * The top of the home page: `line` is the CDS website look (only the 4px red line, no bar), `bar` shows a top bar
   * with the utility links the public layout is given. Inner pages always have the bar (it carries the wordmark).
   */
  topBar: TopBarStyle;
  /**
   * A photograph behind the banner: an absolute path (`/images/banner.jpg`) or an `https://` URL, or null. Needs the
   * `dark-header` banner (the white title must stay readable); with any other header it is dropped. Give an array of
   * two to six for a slideshow: `bannerPhoto` is then the first picture and `bannerSlides` holds all of them. A slideshow
   * entry may be an object with a caption (`{ src, title, text, href, linkLabel }`).
   */
  bannerPhoto: string | null;
  /**
   * Every slide of a slideshow banner (the pictures cross-fade; each may have a headline, text and link; Previous, Next,
   * Pause and a dot per slide), or empty for a single picture or none.
   */
  bannerSlides: BannerSlide[];
  /** Which side the Cornell seal sits on in the home banner; the title goes on the other side (CDS `logo-right`). */
  logoSide: LogoSide;
  /**
   * How tall the banner is: `short` (the plain banner), `medium` or `tall`, which give a picture room. Needs a banner
   * picture; without one it stays `short`.
   */
  bannerHeight: BannerHeight;
  /** The admin app's top bar. Banners have no brand zone to colour in the app shell, so only the bars. */
  appHeader: AppHeaderStyle;
  /** h1–h3 in Freight Text (CDS default) or Freight Sans. */
  headings: 'serif' | 'sans';
  /** The colour mode before a visitor chooses one: follow the operating system, or start light or dark. */
  mode: 'auto' | 'light' | 'dark';
  /** Show the Appearance (Automatic / Light / Dark) switch in the public footer. */
  modeSwitch: boolean;
  /**
   * Where the public header's links sit, how the current page is marked, and whether the bar is see-through over the
   * banner photo (`overlay`; needs `bannerPhoto`, otherwise it is dropped).
   */
  nav: { align: NavAlign; style: NavStyle; overlay: boolean };
  /** The admin app's scale: compact (made for working) or the website scale. */
  appDensity: 'compact' | 'website';
}

export const PUBLIC_HEADER_STYLES = ['cornell', 'red-header', 'dark-header', 'light-bar', 'dark-bar', 'blue-bar'] as const;
export type PublicHeaderStyle = (typeof PUBLIC_HEADER_STYLES)[number];
export const APP_HEADER_STYLES = ['cornell', 'light-bar', 'dark-bar', 'blue-bar'] as const;
export type AppHeaderStyle = (typeof APP_HEADER_STYLES)[number];
export const NAV_ALIGNS = ['start', 'center', 'end', 'even'] as const;
export type NavAlign = (typeof NAV_ALIGNS)[number];
/** `tint`, `underlines` and `red-bar` (a red fill) keep the flat bar; `red-button` makes each link a button with space around it. */
export const NAV_STYLES = ['tint', 'underlines', 'red-bar', 'red-button'] as const;
export type NavStyle = (typeof NAV_STYLES)[number];
export const TOP_BAR_STYLES = ['line', 'bar'] as const;
export type TopBarStyle = (typeof TOP_BAR_STYLES)[number];
export const BANNER_HEIGHTS = ['short', 'medium', 'tall'] as const;
export type BannerHeight = (typeof BANNER_HEIGHTS)[number];
export const LOGO_SIDES = ['left', 'right'] as const;
export type LogoSide = (typeof LOGO_SIDES)[number];
/** One slide of a slideshow banner: a picture and, optionally, a headline, a line of text and a link (`href` needs `linkLabel`). */
export interface BannerSlide {
  src: string;
  title?: string;
  text?: string;
  href?: string;
  linkLabel?: string;
  /**
   * A video over the picture (which stays for the first moments and for reduced motion): one or two files, `.webm` or `.mp4`,
   * WebM first, each an absolute path or an https URL. It plays only while its slide shows, with its own Pause / Play video button.
   */
  video?: string[];
}
/** What `provideLook()` takes: a look, any part of it, where `bannerPhoto` may also be a list of pictures or slides. */
export type LookInput = Omit<DeepPartial<Look>, 'bannerPhoto' | 'bannerSlides'> & {
  bannerPhoto?: string | BannerSlide | (string | BannerSlide)[] | null;
};
/** A slideshow holds two to six pictures. */
export const MAX_BANNER_SLIDES = 6;

/** The template's look: what an app gets when it sets nothing. */
export const DEFAULT_LOOK: Look = {
  publicHeader: 'cornell',
  topBar: 'line',
  bannerPhoto: null,
  bannerSlides: [],
  logoSide: 'left',
  bannerHeight: 'short',
  appHeader: 'cornell',
  headings: 'serif',
  mode: 'auto',
  modeSwitch: true,
  nav: { align: 'start', style: 'tint', overlay: false },
  appDensity: 'compact',
};

/** A banner photo is an absolute path or an https URL with nothing in it that could break out of a CSS url(). */
const BANNER_PHOTO = /^(\/(?!\/)|https:\/\/)[^\s"'()\\<>]+$/;
/** A video file is such a path that ends in `.webm` or `.mp4`; a slide keeps at most two. */
const BANNER_VIDEO = /\.(webm|mp4)$/i;
const MAX_SLIDE_VIDEOS = 2;

/** A slide from a path or an object; null when its picture is not safe. Text is trimmed and capped; a link needs a safe `href` and a label. */
function slideOf(v: unknown): BannerSlide | null {
  const o = (typeof v === 'string' ? { src: v } : v) as Partial<BannerSlide> | null;
  if (!o || typeof o.src !== 'string' || !BANNER_PHOTO.test(o.src)) return null;
  const clean = (x: unknown, max: number): string | undefined => (typeof x === 'string' && x.trim() ? x.trim().slice(0, max) : undefined);
  const slide: BannerSlide = { src: o.src };
  const title = clean(o.title, 100);
  const text = clean(o.text, 240);
  const linkLabel = clean(o.linkLabel, 60);
  if (title) slide.title = title;
  if (text) slide.text = text;
  if (linkLabel && typeof o.href === 'string' && BANNER_PHOTO.test(o.href)) {
    slide.href = o.href;
    slide.linkLabel = linkLabel;
  }
  const video = (Array.isArray(o.video) ? o.video : [])
    .filter((u): u is string => typeof u === 'string' && BANNER_PHOTO.test(u) && BANNER_VIDEO.test(u))
    .slice(0, MAX_SLIDE_VIDEOS);
  if (video.length) slide.video = video;
  return slide;
}

/** Fill a partial look from the defaults, dropping any value that is not one of the options. */
export function resolveLook(partial: LookInput = {}): Look {
  const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
    allowed.includes(v as T) ? (v as T) : fallback;
  const d = DEFAULT_LOOK;
  const publicHeader = pick(partial.publicHeader, PUBLIC_HEADER_STYLES, d.publicHeader);
  // Options that need another one fall back to their default when it is not there (the customizer shows the same rule).
  const given = Array.isArray(partial.bannerPhoto) ? partial.bannerPhoto : [partial.bannerPhoto];
  const photos =
    publicHeader === 'dark-header'
      ? given.map(slideOf).filter((s): s is BannerSlide => s !== null).slice(0, MAX_BANNER_SLIDES)
      : [];
  const bannerPhoto = photos[0]?.src ?? null;
  const bannerSlides = photos.length > 1 ? photos : [];
  const height = bannerPhoto ? pick(partial.bannerHeight, BANNER_HEIGHTS, d.bannerHeight) : d.bannerHeight;
  return {
    publicHeader,
    topBar: pick(partial.topBar, TOP_BAR_STYLES, d.topBar),
    bannerPhoto,
    bannerSlides,
    logoSide: pick(partial.logoSide, LOGO_SIDES, d.logoSide),
    // a slideshow holds captions and controls, so it is never shorter than medium
    bannerHeight: bannerSlides.length > 0 && height === 'short' ? 'medium' : height,
    appHeader: pick(partial.appHeader, APP_HEADER_STYLES, d.appHeader),
    headings: pick(partial.headings, ['serif', 'sans'] as const, d.headings),
    mode: pick(partial.mode, ['auto', 'light', 'dark'] as const, d.mode),
    modeSwitch: typeof partial.modeSwitch === 'boolean' ? partial.modeSwitch : d.modeSwitch,
    nav: {
      align: pick(partial.nav?.align, NAV_ALIGNS, d.nav.align),
      style: pick(partial.nav?.style, NAV_STYLES, d.nav.style),
      overlay: bannerPhoto !== null && partial.nav?.overlay === true,
    },
    appDensity: pick(partial.appDensity, ['compact', 'website'] as const, d.appDensity),
  };
}

/** The classes for the public header's `.cu-nav` (design-system/blocks/nav.css). */
export function navClass(look: Look): string {
  const classes = ['cu-nav'];
  if (look.nav.align !== 'start') classes.push(`cu-nav--${look.nav.align}`);
  if (look.nav.style === 'underlines') classes.push('cu-nav--underlines');
  if (look.nav.style === 'red-bar') classes.push('cu-nav--active-red');
  if (look.nav.style === 'red-button') classes.push('cu-nav--tall', 'cu-nav--active-red');
  if (look.nav.overlay) classes.push('cu-nav--gradient');
  return classes.join(' ');
}

/** The single banner photo as a CSS value for `--header-photo`, or null when there is none or it is a slideshow. */
export function bannerPhotoCss(look: Look): string | null {
  return look.bannerPhoto && look.bannerSlides.length === 0 ? `url("${look.bannerPhoto}")` : null;
}

/** A slide as the banner draws it: the picture as a CSS `url()` value, and its caption (null where it has none). */
export interface BannerSlideView {
  css: string;
  title: string | null;
  text: string | null;
  href: string | null;
  linkLabel: string | null;
  /** The slide's video files with their types (empty for a picture-only slide). */
  video: { src: string; type: string }[];
}

/** The slideshow's slides as the banner draws them (empty unless the look has two or more). */
export function bannerSlideViews(look: Look): BannerSlideView[] {
  return look.bannerSlides.map((s) => ({
    css: `url("${s.src}")`,
    title: s.title ?? null,
    text: s.text ?? null,
    href: s.href ?? null,
    linkLabel: s.linkLabel ?? null,
    video: (s.video ?? []).map((src) => ({ src, type: /\.webm$/i.test(src) ? 'video/webm' : 'video/mp4' })),
  }));
}

/** The chosen look, resolved. Inject it where a component draws an option (header, footer, shell). */
export const LOOK = new InjectionToken<Look>('LOOK', { providedIn: 'root', factory: () => DEFAULT_LOOK });

/** Use a look: `provideLook({ publicHeader: 'blue-bar', headings: 'sans' })` in app.config.ts. */
export function provideLook(look: LookInput): (Provider | EnvironmentProviders)[] {
  return [
    { provide: LOOK, useValue: resolveLook(look) },
    provideAppInitializer(() => applyLookToRoot(inject(LOOK), inject(DOCUMENT).documentElement)),
  ];
}

/** The parts of a look that live on <html>: the heading face. (Mode and the app bar are ThemeService's.) */
export function applyLookToRoot(look: Look, root: Pick<HTMLElement, 'setAttribute' | 'removeAttribute'>): void {
  if (look.headings === 'sans') root.setAttribute('data-headings', 'sans');
  else root.removeAttribute('data-headings');
}

export type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };
