import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkDesignSystem } from './check-design-system.mjs';
import { diffLock, hashTree, mapPath, ownedRoots } from './design-system-lock.mjs';

const dirs: string[] = [];
function tree(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'cds-check-'));
  dirs.push(root);
  for (const [p, body] of Object.entries(files)) {
    mkdirSync(dirname(join(root, p)), { recursive: true });
    writeFileSync(join(root, p), body);
  }
  return root;
}
const lock = (root: string) =>
  writeFileSync(
    join(root, 'design-system.lock.json'),
    JSON.stringify({ repo: 'cu-aaii/cornell-design-system', ref: 'main', sha: 'abc1234def', files: hashTree(root) }),
  );

afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe('mapPath', () => {
  it('maps design-system/ as is and cornell-* skills into .claude/skills', () => {
    expect(mapPath('design-system/index.css')).toBe('design-system/index.css');
    expect(mapPath('agent-skills/cornell-look/SKILL.md')).toBe('.claude/skills/cornell-look/SKILL.md');
  });

  it('ignores every other upstream path', () => {
    expect(mapPath('angular-template/client/app/app.ts')).toBeNull();
    expect(mapPath('agent-skills/other/SKILL.md')).toBeNull();
    expect(mapPath('README.md')).toBeNull();
    expect(mapPath('design-system-source/cds-full/x.html')).toBeNull();
  });
});

describe('ownedRoots and hashTree', () => {
  it('owns design-system/ and only the cornell-* skill folders', () => {
    const root = tree({
      'design-system/index.css': 'a',
      '.claude/skills/cornell-look/SKILL.md': 'b',
      '.claude/skills/routing/SKILL.md': 'c',
    });
    expect(ownedRoots(root)).toEqual(['design-system', '.claude/skills/cornell-look']);
    expect(Object.keys(hashTree(root))).toEqual(['.claude/skills/cornell-look/SKILL.md', 'design-system/index.css']);
  });

  it('does not hash the app-generated COMPONENTS.md', () => {
    const root = tree({ 'design-system/index.css': 'a', 'design-system/COMPONENTS.md': 'per app' });
    expect(Object.keys(hashTree(root))).toEqual(['design-system/index.css']);
  });
});

describe('diffLock', () => {
  it('reports missing, extra and changed files', () => {
    expect(diffLock({ a: '1', b: '2', c: '3' }, { a: '1', b: 'x', d: '4' })).toEqual({
      missing: ['c'],
      extra: ['d'],
      changed: ['b'],
      ok: false,
    });
    expect(diffLock({ a: '1' }, { a: '1' }).ok).toBe(true);
  });
});

describe('checkDesignSystem', () => {
  it('is skipped when there is no lock', () => {
    const { code, lines } = checkDesignSystem(tree({ 'design-system/index.css': 'a' }));
    expect(code).toBe(0);
    expect(lines[0]).toMatch(/skipped/);
  });

  it('passes on an untouched copy, and when only COMPONENTS.md changes', () => {
    const root = tree({ 'design-system/index.css': 'a', 'design-system/COMPONENTS.md': 'x' });
    lock(root);
    expect(checkDesignSystem(root).code).toBe(0);
    writeFileSync(join(root, 'design-system/COMPONENTS.md'), 'rebuilt for this app');
    expect(checkDesignSystem(root).code).toBe(0);
  });

  it('fails on an edited, added or removed synced file and says to fix upstream', () => {
    const root = tree({ 'design-system/index.css': 'a', '.claude/skills/cornell-look/SKILL.md': 'b' });
    lock(root);
    writeFileSync(join(root, 'design-system/index.css'), 'edited');
    writeFileSync(join(root, 'design-system/local.css'), 'added');
    rmSync(join(root, '.claude/skills/cornell-look'), { recursive: true });
    const { code, lines } = checkDesignSystem(root);
    expect(code).toBe(1);
    expect(lines).toContain('  changed  design-system/index.css');
    expect(lines).toContain('  extra    design-system/local.css');
    expect(lines).toContain('  missing  .claude/skills/cornell-look/SKILL.md');
    expect(lines.join('\n')).toMatch(/upstream/);
  });

  it('leaves a non-cornell skill alone', () => {
    const root = tree({ 'design-system/index.css': 'a' });
    lock(root);
    mkdirSync(join(root, '.claude/skills/routing'), { recursive: true });
    writeFileSync(join(root, '.claude/skills/routing/SKILL.md'), 'app skill');
    expect(checkDesignSystem(root).code).toBe(0);
  });
});
