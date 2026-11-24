// `@angular/compiler` first: see client.service.test.ts for why.
import '@angular/compiler';

import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { APP_INITIALIZER, Injector, createEnvironmentInjector, runInInjectionContext, type EnvironmentInjector } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import {
  APP_HEADER_STYLES,
  DEFAULT_LOOK,
  LOOK,
  NAV_ALIGNS,
  NAV_STYLES,
  PUBLIC_HEADER_STYLES,
  TOP_BAR_STYLES,
  applyLookToRoot,
  bannerPhotoCss,
  bannerSlideViews,
  LOGO_SIDES,
  BANNER_HEIGHTS,
  MAX_BANNER_SLIDES,
  navClass,
  provideLook,
  resolveLook,
} from './look';

function fakeRoot() {
  const attrs = new Map<string, string>();
  return {
    attrs,
    setAttribute: (k: string, v: string) => void attrs.set(k, v),
    removeAttribute: (k: string) => void attrs.delete(k),
  };
}

describe('look', () => {
  it('resolves an empty look to the template defaults', () => {
    expect(resolveLook()).toEqual(DEFAULT_LOOK);
    expect(resolveLook({})).toEqual(DEFAULT_LOOK);
  });

  it('keeps valid choices and drops anything that is not an option', () => {
    const look = resolveLook({
      publicHeader: 'blue-bar',
      appHeader: 'red-header' as never, // a banner is not an app bar
      headings: 'sans',
      mode: 'purple' as never,
      modeSwitch: false,
      nav: { align: 'center' },
      appDensity: 'website',
    });
    expect(look).toEqual({
      publicHeader: 'blue-bar',
      topBar: 'line',
      bannerPhoto: null,
      bannerSlides: [],
      logoSide: 'left',
      bannerHeight: 'short',
      appHeader: 'cornell',
      headings: 'sans',
      mode: 'auto',
      modeSwitch: false,
      nav: { align: 'center', style: 'tint', overlay: false },
      appDensity: 'website',
    });
  });

  it('defaults to the CDS website look: a white banner and the thin line', () => {
    expect(DEFAULT_LOOK.publicHeader).toBe('cornell');
    expect(DEFAULT_LOOK.topBar).toBe('line');
    expect(resolveLook({ topBar: 'bar' }).topBar).toBe('bar');
    expect(resolveLook({ topBar: 'ribbon' as never }).topBar).toBe('line');
  });

  it('keeps a banner photo only on the dark banner, and only a safe path or https URL', () => {
    expect(resolveLook({ publicHeader: 'dark-header', bannerPhoto: '/images/banner.jpg' }).bannerPhoto).toBe('/images/banner.jpg');
    expect(resolveLook({ publicHeader: 'dark-header', bannerPhoto: 'https://example.cornell.edu/a.jpg' }).bannerPhoto).toBe(
      'https://example.cornell.edu/a.jpg',
    );
    // another header: the photo needs the dark banner, so it falls back to none
    expect(resolveLook({ publicHeader: 'cornell', bannerPhoto: '/images/banner.jpg' }).bannerPhoto).toBeNull();
    for (const bad of ['banner.jpg', '//evil.example/x.jpg', 'http://example.cornell.edu/a.jpg', '/a b.jpg', '/a.jpg")', "/a.jpg'", 'javascript:alert(1)', '']) {
      expect(resolveLook({ publicHeader: 'dark-header', bannerPhoto: bad }).bannerPhoto, bad).toBeNull();
    }
  });

  it('keeps a slideshow of two to six safe pictures, only on the dark banner', () => {
    const dark = { publicHeader: 'dark-header' } as const;
    const three = ['/images/a.jpg', '/images/b.jpg', '/images/c.jpg'];
    const look = resolveLook({ ...dark, bannerPhoto: three });
    expect(look.bannerSlides).toEqual(three.map((src) => ({ src })));
    expect(look.bannerPhoto).toBe('/images/a.jpg');
    // an unsafe entry is dropped; one picture left is a single photo, not a slideshow
    const one = resolveLook({ ...dark, bannerPhoto: ['/images/a.jpg', 'javascript:alert(1)'] });
    expect(one.bannerSlides).toEqual([]);
    expect(one.bannerPhoto).toBe('/images/a.jpg');
    expect(resolveLook({ ...dark, bannerPhoto: Array.from({ length: 9 }, (_, i) => `/images/${i}.jpg`) }).bannerSlides).toHaveLength(MAX_BANNER_SLIDES);
    expect(resolveLook({ publicHeader: 'cornell', bannerPhoto: three }).bannerSlides).toEqual([]);
    expect(bannerSlideViews(look).map((s) => s.css)).toEqual(three.map((p) => `url("${p}")`));
    // the single-photo CSS value is left to the slideshow
    expect(bannerPhotoCss(look)).toBeNull();
    expect(bannerSlideViews(DEFAULT_LOOK)).toEqual([]);
  });

  it('keeps slide captions: trimmed and capped text, and a link only with a safe address and a label', () => {
    const dark = { publicHeader: 'dark-header' } as const;
    const look = resolveLook({
      ...dark,
      bannerPhoto: [
        { src: '/images/a.jpg', title: '  Headline  ', text: 'x'.repeat(300), href: '/tools', linkLabel: 'Explore' },
        { src: '/images/b.jpg', title: '', text: 'No link', href: 'javascript:alert(1)', linkLabel: 'Bad' },
        { src: '/images/c.jpg', href: '/no-label' },
        { src: 'https://evil.example/"x', title: 'dropped: unsafe picture' },
        null as never,
      ],
    });
    expect(look.bannerSlides).toHaveLength(3);
    expect(look.bannerSlides[0]).toEqual({ src: '/images/a.jpg', title: 'Headline', text: 'x'.repeat(240), href: '/tools', linkLabel: 'Explore' });
    expect(look.bannerSlides[1]).toEqual({ src: '/images/b.jpg', text: 'No link' });
    expect(look.bannerSlides[2]).toEqual({ src: '/images/c.jpg' });
    expect(bannerSlideViews(look)[0]).toEqual({ css: 'url("/images/a.jpg")', title: 'Headline', text: 'x'.repeat(240), href: '/tools', linkLabel: 'Explore', video: [] });
    expect(bannerSlideViews(look)[2]).toEqual({ css: 'url("/images/c.jpg")', title: null, text: null, href: null, linkLabel: null, video: [] });
  });

  it('keeps a slide video only from safe .webm or .mp4 paths, at most two, and tells the banner their types', () => {
    const dark = { publicHeader: 'dark-header' } as const;
    const look = resolveLook({
      ...dark,
      bannerPhoto: [
        '/images/a.jpg',
        { src: '/images/b.jpg', video: ['/images/b.webm', '/images/b.mp4', '/images/b-extra.mp4'] },
        { src: '/images/c.jpg', video: ['javascript:alert(1)', '/images/c.gif', 'https://cdn.example/c.mp4', 7 as never, '//evil.example/c.mp4'] },
        { src: '/images/d.jpg', video: 'not-a-list' as never },
      ],
    });
    expect(look.bannerSlides[0]).toEqual({ src: '/images/a.jpg' });
    expect(look.bannerSlides[1]?.video).toEqual(['/images/b.webm', '/images/b.mp4']);
    expect(look.bannerSlides[2]?.video).toEqual(['https://cdn.example/c.mp4']);
    expect(look.bannerSlides[3]).toEqual({ src: '/images/d.jpg' });
    const views = bannerSlideViews(look);
    expect(views[0]?.video).toEqual([]);
    expect(views[1]?.video).toEqual([
      { src: '/images/b.webm', type: 'video/webm' },
      { src: '/images/b.mp4', type: 'video/mp4' },
    ]);
  });

  it('puts the seal on the left or the right, and a slideshow is never shorter than medium', () => {
    expect(resolveLook({ logoSide: 'right' }).logoSide).toBe('right');
    expect(resolveLook({ logoSide: 'middle' as never }).logoSide).toBe('left');
    const dark = { publicHeader: 'dark-header' } as const;
    expect(resolveLook({ ...dark, bannerPhoto: ['/images/a.jpg', '/images/b.jpg'] }).bannerHeight).toBe('medium');
    expect(resolveLook({ ...dark, bannerPhoto: ['/images/a.jpg', '/images/b.jpg'], bannerHeight: 'tall' }).bannerHeight).toBe('tall');
    expect(resolveLook({ ...dark, bannerPhoto: '/images/a.jpg' }).bannerHeight).toBe('short');
  });

  it('keeps the banner height only when there is a picture', () => {
    const photo = { publicHeader: 'dark-header', bannerPhoto: '/images/banner.jpg' } as const;
    expect(resolveLook({ ...photo, bannerHeight: 'tall' }).bannerHeight).toBe('tall');
    expect(resolveLook({ ...photo, bannerHeight: 'medium' }).bannerHeight).toBe('medium');
    expect(resolveLook({ ...photo, bannerHeight: 'huge' as never }).bannerHeight).toBe('short');
    // no picture (or no dark banner): a tall banner of flat colour is dropped
    expect(resolveLook({ publicHeader: 'dark-header', bannerHeight: 'tall' }).bannerHeight).toBe('short');
    expect(resolveLook({ bannerHeight: 'tall' }).bannerHeight).toBe('short');
  });

  it('keeps the overlay navigation only when there is a banner photo', () => {
    const photo = { publicHeader: 'dark-header', bannerPhoto: '/images/banner.jpg' } as const;
    expect(resolveLook({ ...photo, nav: { overlay: true } }).nav.overlay).toBe(true);
    expect(resolveLook({ publicHeader: 'dark-header', nav: { overlay: true } }).nav.overlay).toBe(false);
    expect(resolveLook({ nav: { overlay: true } }).nav.overlay).toBe(false);
    // the photo itself being dropped (white header) takes the overlay with it
    expect(resolveLook({ publicHeader: 'cornell', bannerPhoto: '/images/banner.jpg', nav: { overlay: true } }).nav.overlay).toBe(false);
  });

  it('turns the banner photo into a CSS url()', () => {
    expect(bannerPhotoCss(DEFAULT_LOOK)).toBeNull();
    expect(bannerPhotoCss(resolveLook({ publicHeader: 'dark-header', bannerPhoto: '/images/banner.jpg' }))).toBe('url("/images/banner.jpg")');
  });

  it('builds the public nav classes', () => {
    expect(navClass(DEFAULT_LOOK)).toBe('cu-nav');
    expect(navClass(resolveLook({ nav: { align: 'even', style: 'underlines' } }))).toBe('cu-nav cu-nav--even cu-nav--underlines');
    expect(navClass(resolveLook({ nav: { align: 'end', style: 'red-bar' } }))).toBe('cu-nav cu-nav--end cu-nav--active-red');
  });

  it('builds the button-style and overlay nav classes', () => {
    expect(navClass(resolveLook({ nav: { style: 'red-button' } }))).toBe('cu-nav cu-nav--tall cu-nav--active-red');
    const overlay = resolveLook({ publicHeader: 'dark-header', bannerPhoto: '/images/banner.jpg', nav: { align: 'center', style: 'red-button', overlay: true } });
    expect(navClass(overlay)).toBe('cu-nav cu-nav--center cu-nav--tall cu-nav--active-red cu-nav--gradient');
  });

  it('matches the customizer (design-system/showcase/customizer.html): same options, values and defaults', () => {
    const html = readFileSync(new URL('../../../../design-system/showcase/customizer.html', import.meta.url), 'utf8');
    const values = (key: string): string[] => {
      const block = html.slice(html.indexOf(`key: '${key}'`));
      const list = block.slice(block.indexOf('values: ['), block.indexOf(']]') + 2);
      return [...list.matchAll(/\['([\w-]+)',/g)].map((m) => m[1]);
    };
    expect(values('publicHeader')).toEqual([...PUBLIC_HEADER_STYLES]);
    expect(values('topBar')).toEqual([...TOP_BAR_STYLES]);
    expect(values('appHeader')).toEqual([...APP_HEADER_STYLES]);
    expect(values('navAlign')).toEqual([...NAV_ALIGNS]);
    expect(values('navStyle')).toEqual([...NAV_STYLES]);
    expect(values('bannerHeight')).toEqual([...BANNER_HEIGHTS]);
    expect(values('logoSide')).toEqual([...LOGO_SIDES]);
    expect(values('bannerPhoto')).toEqual(['none', 'photo', 'slides']);
    const defaults = new Function(`return ${/var DEFAULTS = (\{[^}]*\});/.exec(html)![1]}`)() as Record<string, string>;
    expect(defaults).toMatchObject({
      publicHeader: DEFAULT_LOOK.publicHeader,
      topBar: DEFAULT_LOOK.topBar,
      appHeader: DEFAULT_LOOK.appHeader,
      navAlign: DEFAULT_LOOK.nav.align,
      navStyle: DEFAULT_LOOK.nav.style,
      headings: DEFAULT_LOOK.headings,
      mode: DEFAULT_LOOK.mode,
      appDensity: DEFAULT_LOOK.appDensity,
    });
  });

  it('puts the heading face on <html>, and takes it off again', () => {
    const root = fakeRoot();
    applyLookToRoot(resolveLook({ headings: 'sans' }), root);
    expect(root.attrs.get('data-headings')).toBe('sans');
    applyLookToRoot(DEFAULT_LOOK, root);
    expect(root.attrs.has('data-headings')).toBe(false);
  });

  it('LOOK defaults to the template look with no provider', () => {
    // providedIn root: its own factory is what a root injector runs when nothing provides it
    const factory = (LOOK as unknown as { ɵprov: { factory: () => unknown } }).ɵprov.factory;
    expect(factory()).toEqual(DEFAULT_LOOK);
  });

  it('provideLook provides the resolved look and applies it to <html> at start-up', () => {
    const root = fakeRoot();
    const parent = Injector.create({ providers: [{ provide: DOCUMENT, useValue: { documentElement: root } }] });
    const env = createEnvironmentInjector(provideLook({ headings: 'sans' }), parent as unknown as EnvironmentInjector);
    expect(env.get(LOOK).headings).toBe('sans');
    for (const init of env.get(APP_INITIALIZER)) runInInjectionContext(env, init);
    expect(root.attrs.get('data-headings')).toBe('sans');
  });
});
