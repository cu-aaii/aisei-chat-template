import { Injectable, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { LOOK } from '../../look/look';

/** Colour mode. `auto` follows the operating system (no data-mode attribute). */
export type ColorMode = 'auto' | 'light' | 'dark';

/** The design system's brand frames (design-system/themes/). `cornell` is the default and sets no attribute. */
export const BRAND_THEMES = ['cornell', 'dark-header', 'red-header', 'light-bar', 'dark-bar', 'blue-bar'] as const;
export type BrandTheme = (typeof BRAND_THEMES)[number];

/** localStorage keys; the inline script in client/index.html reads the same two before first paint. */
export const MODE_KEY = 'cu-mode';
export const THEME_KEY = 'cu-theme';

const MODES: readonly ColorMode[] = ['auto', 'light', 'dark'];

/**
 * Mode and theme for the Cornell design system: sets `data-mode` and `data-theme` on <html>, which is all the
 * design system reads (design-system/README.md, "Switching mode and theme in the app"), and remembers the
 * choice. Storage can be unavailable (private windows, blocked site data), so every read and write is guarded
 * and the page still works with the defaults.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly doc = inject(DOCUMENT);
  /** The app's chosen defaults (provideLook): what a visitor sees until they pick something else. */
  private readonly look = inject(LOOK);
  private readonly defaultMode: ColorMode = this.look.mode;
  private readonly defaultTheme: BrandTheme = this.look.appHeader;

  private readonly _mode = signal<ColorMode>('auto');
  private readonly _theme = signal<BrandTheme>('cornell');
  readonly mode = this._mode.asReadonly();
  readonly theme = this._theme.asReadonly();

  constructor() {
    const mode = this.read(MODE_KEY);
    const theme = this.read(THEME_KEY);
    this._mode.set(isMode(mode) ? mode : this.defaultMode);
    this._theme.set(isTheme(theme) ? theme : this.defaultTheme);
    this.apply();
  }

  /** A choice equal to the app's default is not stored, so a later change of default reaches everyone. */
  setMode(mode: ColorMode): void {
    this._mode.set(isMode(mode) ? mode : this.defaultMode);
    this.write(MODE_KEY, this._mode() === this.defaultMode ? null : this._mode());
    this.apply();
  }

  setTheme(theme: BrandTheme): void {
    this._theme.set(isTheme(theme) ? theme : this.defaultTheme);
    this.write(THEME_KEY, this._theme() === this.defaultTheme ? null : this._theme());
    this.apply();
  }

  private apply(): void {
    const root = this.doc.documentElement;
    if (this._mode() === 'auto') root.removeAttribute('data-mode');
    else root.setAttribute('data-mode', this._mode());
    if (this._theme() === 'cornell') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', this._theme());
  }

  private read(key: string): string | null {
    try {
      return this.doc.defaultView?.localStorage.getItem(key) ?? null;
    } catch {
      return null;
    }
  }

  private write(key: string, value: string | null): void {
    try {
      const store = this.doc.defaultView?.localStorage;
      if (!store) return;
      if (value === null) store.removeItem(key);
      else store.setItem(key, value);
    } catch {
      // Storage refused (private window, quota): the choice still applies for this page.
    }
  }
}

function isMode(v: unknown): v is ColorMode {
  return typeof v === 'string' && (MODES as readonly string[]).includes(v);
}

function isTheme(v: unknown): v is BrandTheme {
  return typeof v === 'string' && (BRAND_THEMES as readonly string[]).includes(v);
}
