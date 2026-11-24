import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * index.html inlines the official seal and wordmark so the headers can draw them with `<use href="#cu-seal">`
 * before any request. They must stay byte-identical to the design system's own sprite
 * (design-system/assets/cornell-logos.sprite.html): the logos are never redrawn or retyped (cornell-branding).
 * After a sync that changes the sprite, paste its <symbol>s into index.html again.
 */
const read = (p: string) => readFileSync(new URL(`../../../../${p}`, import.meta.url), 'utf8');
// Logo symbols only: index.html also carries the icon symbols (cu-i-*), which icon-sprite.test.ts checks.
const symbols = (html: string) => (html.match(/<symbol[\s\S]*?<\/symbol>/g) ?? []).filter((s) => !s.startsWith('<symbol id="cu-i-'));

describe('the logo sprite in index.html', () => {
  it('is the design system sprite, symbol for symbol', () => {
    const upstream = symbols(read('design-system/assets/cornell-logos.sprite.html'));
    expect(upstream.length).toBeGreaterThan(0);
    expect(symbols(read('client/index.html'))).toEqual(upstream);
  });
});
