import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ICON_NAMES } from '../components/icon/icon-names';

/**
 * index.html carries only the icons this site uses (the full design-system sprite is 66 kB, on every prerendered
 * page). Each one must be the design system's own symbol, byte for byte (cornell-branding: one icon set, Material
 * Symbols Outlined 300), and every name `<app-icon>` accepts must be there.
 */
const read = (p: string) => readFileSync(new URL(`../../../../${p}`, import.meta.url), 'utf8');
const icons = (html: string) => (html.match(/<symbol id="cu-i-[\s\S]*?<\/symbol>/g) ?? []);
const id = (s: string) => /id="cu-i-([^"]+)"/.exec(s)?.[1];

describe('the icon symbols in index.html', () => {
  const upstream = new Map(icons(read('design-system/assets/icons.sprite.html')).map((s) => [id(s), s]));
  const local = icons(read('client/index.html'));

  it('are copies of the design system sprite', () => {
    expect(local.length).toBeGreaterThan(0);
    for (const s of local) expect(s).toBe(upstream.get(id(s)));
  });

  it('cover every icon name the app uses', () => {
    expect(new Set(local.map(id))).toEqual(new Set(ICON_NAMES));
  });
});
