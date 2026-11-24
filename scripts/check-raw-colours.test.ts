import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { BASELINE, checkRawColours, findColours, overBaseline, tally } from './check-raw-colours.mjs';

const dirs: string[] = [];
function tree(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'colours-'));
  dirs.push(root);
  for (const [p, body] of Object.entries(files)) {
    mkdirSync(dirname(join(root, p)), { recursive: true });
    writeFileSync(join(root, p), body);
  }
  return root;
}
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
const tokens = (src: string, ts = true) => findColours(src, ts).map((f) => f.token);

describe('findColours', () => {
  it('finds hex and colour functions in CSS values, lower-cased, with their lines', () => {
    expect(findColours('a { color: #B31B1B; }\nb { background: rgba(0, 0, 0, 0.3); border: 1px solid #fff }', false)).toEqual([
      { token: '#b31b1b', line: 1 },
      { token: 'rgba(', line: 2 },
      { token: '#fff', line: 2 },
    ]);
    expect(tokens('c { color: hsl(0 0% 0%); x: #11223344; }')).toEqual(['hsl(', '#11223344']);
  });

  it('ignores comments: issue numbers, an old colour in a note, a commented-out rule', () => {
    expect(tokens('/* #139: was #b31b1b */ a { color: var(--color-ink); }')).toEqual([]);
    expect(tokens("// see #81 and rgb(1, 2, 3)\nconst x = 'var(--color-primary)';")).toEqual([]);
    expect(tokens('<!-- #222 --><p>x</p>', false)).toEqual([]);
  });

  it('keeps a // inside a URL and still sees a colour after it', () => {
    expect(tokens("const u = 'https://example.com'; const c = '#123456';")).toEqual(['#123456']);
  });

  it('does not take tokens, ids, entities or longer words for colours', () => {
    expect(tokens("a { color: var(--color-accent); } #main { } x = 'name&#64;cornell.edu'; y = '#abcdefg'; z = 'red-rgb(';")).toEqual([]);
  });
});

describe('tally and overBaseline', () => {
  it('counts per file and token, and only an increase fails', () => {
    const now = tally([
      ['a.ts', findColours("x='#fff'; y='#fff'; z='rgb('", true)],
      ['b.ts', []],
    ]);
    expect(now).toEqual({ 'a.ts': { '#fff': 2, 'rgb(': 1 } });
    expect(overBaseline(now, { 'a.ts': { '#fff': 2, 'rgb(': 1 } })).toEqual([]);
    expect(overBaseline(now, { 'a.ts': { '#fff': 3, 'rgb(': 4 } })).toEqual([]);
    expect(overBaseline(now, { 'a.ts': { '#fff': 1 } })).toEqual([
      { file: 'a.ts', token: '#fff', extra: 1 },
      { file: 'a.ts', token: 'rgb(', extra: 1 },
    ]);
  });
});

describe('checkRawColours', () => {
  it('passes a tree with no raw colours and no baseline (base-template today)', () => {
    const root = tree({ 'client/app/a.component.ts': "styles: `a { color: var(--color-ink); }`" });
    expect(checkRawColours(root)).toMatchObject({ code: 0 });
  });

  it('fails a new colour with file, line and the fix, and skips tests, assets and theme.css', () => {
    const root = tree({
      'client/app/a.component.ts': "x\nstyles: `a { color: #b31b1b; }`",
      'client/app/a.component.test.ts': "'#000'",
      'client/assets/logo.svg.css': '#000',
      'client/theme.css': '--mat-sys-primary: #2d668e;',
      'design-system/blocks/x.css': '#000',
    });
    const { code, lines } = checkRawColours(root);
    expect(code).toBe(1);
    expect(lines).toContain('  client/app/a.component.ts:2  #b31b1b');
    expect(lines.join('\n')).toMatch(/design-system token/);
    expect(lines.join('\n')).not.toMatch(/test\.ts|assets|theme\.css|design-system\/blocks/);
  });

  it('--write-baseline records today, then only allows fewer', () => {
    const root = tree({ 'client/app/a.css': 'a { color: #111; background: #222; }' });
    expect(checkRawColours(root, { writeBaseline: true }).code).toBe(0);
    expect(JSON.parse(readFileSync(join(root, BASELINE), 'utf8'))).toEqual({ 'client/app/a.css': { '#111': 1, '#222': 1 } });
    writeFileSync(join(root, 'client/app/a.css'), 'a { color: #111; }');
    expect(checkRawColours(root).code).toBe(0);
    writeFileSync(join(root, 'client/app/a.css'), 'a { color: #111; border-color: #333; }');
    expect(checkRawColours(root).code).toBe(1);
  });
});
