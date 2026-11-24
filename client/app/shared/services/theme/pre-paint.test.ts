// `@angular/compiler` first: ThemeService's module pulls in Angular, which falls back to JIT here (see client.service.test.ts).
import '@angular/compiler';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BRAND_THEMES } from './theme.service';

/**
 * client/assets/pre-paint.js applies the stored mode and theme before Angular boots, so a dark-mode visitor never
 * sees a light flash. It is plain script with its own copy of the keys and theme names; this keeps the two in step.
 */
const script = readFileSync(new URL('../../../../assets/pre-paint.js', import.meta.url), 'utf8');

describe('assets/pre-paint.js', () => {
  it('reads the same localStorage keys as ThemeService', () => {
    expect(script).toContain("localStorage.getItem('cu-mode')");
    expect(script).toContain("localStorage.getItem('cu-theme')");
  });

  it('accepts exactly the non-default brand themes', () => {
    const list = script.match(/\/\^\(([^)]+)\)\$\//)?.[1].split('|').sort();
    expect(list).toEqual(BRAND_THEMES.filter((t) => t !== 'cornell').sort());
  });

  it('is loaded by index.html, not inlined (a strict CSP blocks inline scripts)', () => {
    const html = readFileSync(new URL('../../../../index.html', import.meta.url), 'utf8');
    expect(html).toContain('<script src="/assets/pre-paint.js"></script>');
    expect(html).not.toMatch(/<script>\s*try/);
  });
});
