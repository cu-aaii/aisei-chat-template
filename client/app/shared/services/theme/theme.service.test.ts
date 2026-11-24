// `@angular/compiler` first: see client.service.test.ts for why.
import '@angular/compiler';

import { describe, it, expect } from 'vitest';
import { Injector } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { BRAND_THEMES, MODE_KEY, THEME_KEY, ThemeService } from './theme.service';
import { DEFAULT_LOOK, LOOK, resolveLook, type Look } from '../../look/look';

/** A <html> stand-in that records its attributes: the node test environment has no DOM. */
function fakeRoot() {
  const attrs = new Map<string, string>();
  return {
    attrs,
    setAttribute: (k: string, v: string) => void attrs.set(k, v),
    removeAttribute: (k: string) => void attrs.delete(k),
  };
}

function memoryStore(seed: Record<string, string> = {}) {
  const data = new Map(Object.entries(seed));
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

const throwingStore = {
  getItem: () => {
    throw new Error('SecurityError');
  },
  setItem: () => {
    throw new Error('QuotaExceeded');
  },
  removeItem: () => {
    throw new Error('SecurityError');
  },
};

function make(defaultView: unknown, look: Look = DEFAULT_LOOK) {
  const root = fakeRoot();
  const doc = { documentElement: root, defaultView };
  const injector = Injector.create({
    providers: [
      { provide: DOCUMENT, useValue: doc },
      { provide: LOOK, useValue: look },
      { provide: ThemeService, useClass: ThemeService, deps: [] },
    ],
  });
  return { theme: injector.get(ThemeService), root };
}

describe('ThemeService', () => {
  it('defaults to auto mode and the cornell theme, and sets no attributes', () => {
    const store = memoryStore();
    const { theme, root } = make({ localStorage: store });
    expect(theme.mode()).toBe('auto');
    expect(theme.theme()).toBe('cornell');
    expect(root.attrs.size).toBe(0);
  });

  it('applies a stored mode and theme on start', () => {
    const { theme, root } = make({ localStorage: memoryStore({ [MODE_KEY]: 'dark', [THEME_KEY]: 'red-header' }) });
    expect(theme.mode()).toBe('dark');
    expect(theme.theme()).toBe('red-header');
    expect(root.attrs.get('data-mode')).toBe('dark');
    expect(root.attrs.get('data-theme')).toBe('red-header');
  });

  it('ignores stored values it does not know', () => {
    const { theme, root } = make({ localStorage: memoryStore({ [MODE_KEY]: 'sepia', [THEME_KEY]: 'steel' }) });
    expect(theme.mode()).toBe('auto');
    expect(theme.theme()).toBe('cornell');
    expect(root.attrs.size).toBe(0);
  });

  it('sets, stores and clears the mode', () => {
    const store = memoryStore();
    const { theme, root } = make({ localStorage: store });
    theme.setMode('light');
    expect(root.attrs.get('data-mode')).toBe('light');
    expect(store.data.get(MODE_KEY)).toBe('light');
    theme.setMode('auto');
    expect(root.attrs.has('data-mode')).toBe(false);
    expect(store.data.has(MODE_KEY)).toBe(false);
  });

  it('sets, stores and clears the theme, and every design-system theme is accepted', () => {
    const store = memoryStore();
    const { theme, root } = make({ localStorage: store });
    for (const t of BRAND_THEMES.filter((t) => t !== 'cornell')) {
      theme.setTheme(t);
      expect(root.attrs.get('data-theme')).toBe(t);
      expect(store.data.get(THEME_KEY)).toBe(t);
    }
    theme.setTheme('cornell');
    expect(root.attrs.has('data-theme')).toBe(false);
    expect(store.data.has(THEME_KEY)).toBe(false);
  });

  it('falls back to the defaults for a value outside the type (from untyped callers)', () => {
    const { theme } = make({ localStorage: memoryStore() });
    theme.setMode('sepia' as never);
    theme.setTheme('steel' as never);
    expect(theme.mode()).toBe('auto');
    expect(theme.theme()).toBe('cornell');
  });

  it('still works when storage throws (private window, blocked site data)', () => {
    const { theme, root } = make({ localStorage: throwingStore });
    expect(theme.mode()).toBe('auto');
    theme.setMode('dark');
    theme.setTheme('dark-header');
    expect(root.attrs.get('data-mode')).toBe('dark');
    expect(root.attrs.get('data-theme')).toBe('dark-header');
  });

  it('still works with no window at all', () => {
    const { theme, root } = make(null);
    theme.setMode('dark');
    expect(root.attrs.get('data-mode')).toBe('dark');
  });

  it("starts from the app's look (provideLook), and does not store a choice equal to it", () => {
    const store = memoryStore();
    const { theme, root } = make({ localStorage: store }, resolveLook({ appHeader: 'blue-bar', mode: 'dark' }));
    expect(theme.theme()).toBe('blue-bar');
    expect(theme.mode()).toBe('dark');
    expect(root.attrs.get('data-theme')).toBe('blue-bar');
    expect(root.attrs.get('data-mode')).toBe('dark');
    theme.setTheme('cornell');
    expect(store.data.get(THEME_KEY)).toBe('cornell');
    expect(root.attrs.has('data-theme')).toBe(false);
    theme.setTheme('blue-bar');
    expect(store.data.has(THEME_KEY)).toBe(false);
    theme.setMode('auto');
    expect(store.data.get(MODE_KEY)).toBe('auto');
    theme.setMode('dark');
    expect(store.data.has(MODE_KEY)).toBe(false);
  });
});
