import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const dir = import.meta.dirname;

describe('the app theme files leave the focus ring to the design system', () => {
  // A fixed colour in an outline cannot flip in dark mode. The old #2e5690 sat in the highest layer, beat the
  // design system's ring and left it at about 1.9:1 on the dark theme (found by Phil, 11-19-26).
  it('has no hard-coded colour in any outline declaration', () => {
    const offenders: string[] = [];
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.css'))) {
      const css = readFileSync(join(dir, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      for (const m of css.matchAll(/outline(?:-color)?\s*:[^;}]*/g)) {
        if (/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i.test(m[0])) offenders.push(`${file}: ${m[0].trim()}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('uses the focus token and its halo for the global ring', () => {
    const css = readFileSync(join(dir, 'accessability.css'), 'utf8');
    expect(css).toMatch(/:focus-visible\s*\{[^}]*outline:\s*3px solid var\(--color-focus\)/);
    expect(css).toMatch(/box-shadow:\s*0 0 0 2px var\(--color-focus-halo\)/);
  });
});
