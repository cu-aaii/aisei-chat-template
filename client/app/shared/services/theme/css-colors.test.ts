// `@angular/compiler` first: see client.service.test.ts for why.
import '@angular/compiler';

import { describe, it, expect } from 'vitest';
import { Injector } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { ThemeService } from './theme.service';
import { DEFAULT_LOOK, LOOK } from '../../look/look';
import { ColorSchemeService, CssColorProbe, isCssVar, pixelHex, resolveTokens, resolveVarsInText } from './css-colors';

const upper = (css: string) => `resolved(${css})`;
/** A stub method that does nothing (a canvas or storage call the test does not look at). */
const noop = (): void => undefined;

describe('resolveTokens', () => {
  it('resolves strings that name a CSS variable and leaves every other value alone', () => {
    const fn = () => 1;
    const input = {
      a: 'var(--color-primary)',
      b: '#not-a-var',
      c: 3,
      d: [{ e: 'var(--x)' }, 'plain', null],
      f: fn,
      g: { h: { i: 'light-dark(var(--a), var(--b))' } },
      j: undefined,
      k: true,
    };
    const out = resolveTokens(input, upper);
    expect(out).toEqual({
      a: 'resolved(var(--color-primary))',
      b: '#not-a-var',
      c: 3,
      d: [{ e: 'resolved(var(--x))' }, 'plain', null],
      f: fn,
      g: { h: { i: 'resolved(light-dark(var(--a), var(--b)))' } },
      j: undefined,
      k: true,
    });
    expect(input.a).toBe('var(--color-primary)');
  });

  it('passes instances that are not plain objects through untouched', () => {
    const date = new Date(0);
    expect(resolveTokens({ date }, upper).date).toBe(date);
  });

  it('knows a CSS variable when it sees one', () => {
    expect(isCssVar('var(--a)')).toBe(true);
    expect(isCssVar('rgb(0, 0, 0)')).toBe(false);
  });
});

describe('resolveVarsInText', () => {
  it('replaces each var() inside a longer string', () => {
    expect(resolveVarsInText('classDef x fill:var(--a),stroke:var(--b-2),color:red', (c) => c.slice(6, -1))).toBe(
      'classDef x fill:a,stroke:b-2,color:red',
    );
  });
});

describe('CssColorProbe', () => {
  it('asks the window for the computed colour at its element, and clears the element after', () => {
    const el = { style: { color: '' }, ownerDocument: { defaultView: null as unknown } };
    const seen: string[] = [];
    el.ownerDocument.defaultView = {
      getComputedStyle: () => {
        seen.push(el.style.color);
        return { color: 'rgb(0, 102, 153)' };
      },
    };
    const probe = new CssColorProbe(el as never);
    expect(probe.resolve('var(--color-primary)')).toBe('rgb(0, 102, 153)');
    expect(seen).toEqual(['var(--color-primary)']);
    expect(el.style.color).toBe('');
  });

  it('answers the input when the browser computes nothing, or there is no window', () => {
    const blank = { style: { color: '' }, ownerDocument: { defaultView: { getComputedStyle: () => ({ color: '' }) } } };
    expect(new CssColorProbe(blank as never).resolve('var(--a)')).toBe('var(--a)');
    const none = { style: { color: '' }, ownerDocument: { defaultView: null } };
    expect(new CssColorProbe(none as never).resolve('var(--a)')).toBe('var(--a)');
  });
});

describe('pixelHex', () => {
  it('reads the painted pixel back as #rrggbb, whatever syntax the colour came in', () => {
    const ctx = {
      fillStyle: '',
      painted: [] as string[],
      clearRect: noop,
      fillRect() {
        this.painted.push(this.fillStyle);
      },
      getImageData: () => ({ data: [0, 102, 153, 255] }),
    };
    expect(pixelHex(ctx)!('oklab(0.5 0 0)')).toBe('#006699');
    expect(ctx.painted).toEqual(['oklab(0.5 0 0)']);
    expect(pixelHex(null)).toBeNull();
  });

  it('is what the probe answers when the document can make a canvas', () => {
    const ctx = { fillStyle: '', clearRect: noop, fillRect: noop, getImageData: () => ({ data: [255, 255, 255, 255] }) };
    let made = 0;
    const el = {
      style: { color: '' },
      ownerDocument: {
        defaultView: { getComputedStyle: () => ({ color: 'rgb(255, 255, 255)' }) },
        createElement: () => (made++, { width: 0, height: 0, getContext: () => ctx }),
      },
    };
    const probe = new CssColorProbe(el as never);
    expect(probe.resolve('var(--a)')).toBe('#ffffff');
    expect(probe.resolve('var(--b)')).toBe('#ffffff');
    expect(made).toBe(1);
  });
});

describe('ColorSchemeService', () => {
  function make(view: unknown) {
    const doc = { documentElement: { setAttribute: noop, removeAttribute: noop }, defaultView: view };
    const injector = Injector.create({
      providers: [
        { provide: DOCUMENT, useValue: doc },
        { provide: LOOK, useValue: DEFAULT_LOOK },
        { provide: ThemeService, useClass: ThemeService, deps: [] },
        { provide: ColorSchemeService, useClass: ColorSchemeService, deps: [] },
      ],
    });
    return { theme: injector.get(ThemeService), scheme: injector.get(ColorSchemeService) };
  }

  function osQuery(matches: boolean) {
    let listener: ((e: { matches: boolean }) => void) | null = null;
    return {
      view: {
        localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
        matchMedia: () => ({ matches, addEventListener: (_: string, fn: typeof listener) => (listener = fn) }),
      },
      change: (next: boolean) => listener?.({ matches: next }),
    };
  }

  it('follows the operating system while the mode is Automatic, and the stored mode otherwise', () => {
    const os = osQuery(true);
    const { theme, scheme } = make(os.view);
    expect(scheme.scheme()).toBe('dark');
    os.change(false);
    expect(scheme.scheme()).toBe('light');
    theme.setMode('dark');
    expect(scheme.scheme()).toBe('dark');
    theme.setMode('light');
    os.change(true);
    expect(scheme.scheme()).toBe('light');
  });

  it('is light where the window cannot answer the media query', () => {
    expect(make({ localStorage: { getItem: () => null } }).scheme.scheme()).toBe('light');
    expect(make(null).scheme.scheme()).toBe('light');
  });
});
