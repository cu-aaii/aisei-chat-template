import { Injectable, computed, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { ThemeService } from './theme.service';

/**
 * Design-system colours for things that cannot read `var()`: a Chart.js canvas and a Mermaid diagram.
 *
 * Chart and diagram code names its colours as CSS, `var(--color-primary)`, so it holds no literal and stays
 * testable in node. At draw time a component resolves those strings to the colours the browser computes for the
 * current mode (`resolveTokens` / `resolveVarsInText` with a `CssColorProbe`), and draws again when
 * `ColorSchemeService.scheme()` changes. From payflow#71 (cu-aaii/base-template#139 S11); the Documentation
 * page's diagram is the worked example.
 */

/** A CSS colour that needs the browser to resolve it: anything with `var(` in it. */
export function isCssVar(value: string): boolean {
  return value.includes('var(');
}

/**
 * `value` with every string that names a CSS variable replaced by `resolve(string)`, at any depth (chart data,
 * chart options, a list of style strings). Functions and other values are kept as they are; the input is not
 * changed. Plain objects and arrays only: anything with another prototype is passed through untouched.
 */
export function resolveTokens<T>(value: T, resolve: (css: string) => string): T {
  if (typeof value === 'string') return (isCssVar(value) ? resolve(value) : value) as T;
  if (Array.isArray(value)) return value.map((item) => resolveTokens(item, resolve)) as T;
  if (value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) out[key] = resolveTokens(item, resolve);
    return out as T;
  }
  return value;
}

/**
 * Every `var(--name)` in a string replaced by `resolve('var(--name)')`: for text that is not one colour, like
 * a Mermaid `classDef fill:var(--a),stroke:var(--b)` line.
 */
export function resolveVarsInText(text: string, resolve: (css: string) => string): string {
  return text.replace(/var\(--[a-zA-Z0-9-]+\)/g, (match) => resolve(match));
}

/** The part of an element `CssColorProbe` needs; a real `HTMLElement` in the browser. */
export interface ProbeElement {
  style: { color: string };
  ownerDocument: {
    defaultView: { getComputedStyle(el: never): { color: string } } | null;
    createElement?(tag: 'canvas'): unknown;
  };
}

/** The part of a 2D canvas context `pixelHex` uses. */
interface PixelContext {
  fillStyle: string;
  clearRect(x: number, y: number, w: number, h: number): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  getImageData(x: number, y: number, w: number, h: number): { data: ArrayLike<number> };
}

/**
 * Any CSS colour as `#rrggbb` (alpha dropped), by painting one pixel. Computed colours come back as
 * `rgb(r, g, b)`, or as `oklab(…)` for a `color-mix()`, and neither survives everywhere they go: Mermaid splits
 * a `classDef` on its commas, and Chart.js cannot parse `oklab()`. A painted pixel is always plain sRGB.
 * Answers `null` when there is no canvas to paint on.
 */
export function pixelHex(ctx: PixelContext | null | undefined): ((css: string) => string) | null {
  if (!ctx) return null;
  return (css) => {
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = 'transparent'; // a known start, so a colour the canvas rejects paints nothing
    ctx.fillStyle = css;
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return '#' + [d[0], d[1], d[2]].map((n) => Number(n).toString(16).padStart(2, '0')).join('');
  };
}

/**
 * Resolves a CSS colour to what the browser computes for it **at `element`**, as `#rrggbb` where the page can
 * paint a pixel: its mode (`color-scheme`, so
 * `light-dark()` picks the right side) and its theme. `element` should be an invisible child of the thing being
 * drawn. Answers the input unchanged where there is no window to ask.
 */
export class CssColorProbe {
  private normalise: ((css: string) => string) | null | undefined;

  constructor(private readonly element: ProbeElement) {}

  /** `pixelHex` on a 1×1 canvas, made on first use; `null` where the document cannot make one. */
  private hex(): ((css: string) => string) | null {
    if (this.normalise === undefined) {
      const canvas = this.element.ownerDocument.createElement?.('canvas') as
        | { width: number; height: number; getContext(t: '2d', o: object): PixelContext | null }
        | undefined;
      if (canvas) canvas.width = canvas.height = 1;
      this.normalise = pixelHex(canvas?.getContext('2d', { willReadFrequently: true }));
    }
    return this.normalise;
  }

  resolve = (css: string): string => {
    const view = this.element.ownerDocument.defaultView;
    if (!view) return css;
    this.element.style.color = '';
    this.element.style.color = css;
    const color = view.getComputedStyle(this.element as never).color;
    this.element.style.color = '';
    if (!color) return css;
    return this.hex()?.(color) ?? color;
  };
}

/**
 * Which colour scheme the page is drawing in right now, as a signal: the stored mode (`ThemeService`), or the
 * operating system's when the mode is Automatic. A chart or graph reads it so that it draws again in the new
 * colours when either changes; CSS needs none of this, because `light-dark()` flips by itself.
 */
@Injectable({ providedIn: 'root' })
export class ColorSchemeService {
  private readonly theme = inject(ThemeService);
  private readonly osDark = signal(false);

  readonly scheme = computed<'light' | 'dark'>(() => {
    const mode = this.theme.mode();
    if (mode === 'light' || mode === 'dark') return mode;
    return this.osDark() ? 'dark' : 'light';
  });

  constructor() {
    const query = inject(DOCUMENT).defaultView?.matchMedia?.('(prefers-color-scheme: dark)');
    if (!query) return;
    this.osDark.set(query.matches);
    // A root service lives as long as the page, so the listener is never removed.
    query.addEventListener('change', (e) => this.osDark.set(e.matches));
  }
}
