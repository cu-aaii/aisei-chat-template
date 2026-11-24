import { describe, expect, it } from 'vitest';
import { stopsIn, wrapTab } from './focus-wrap';

const stop = () => {
  const el = { focused: false, focus() { el.focused = true; } };
  return el;
};
const key = (shiftKey: boolean) => {
  const e = { shiftKey, prevented: false, preventDefault() { e.prevented = true; } };
  return e;
};

describe('wrapTab', () => {
  it('sends Tab on the last stop to the first', () => {
    const [a, b, c] = [stop(), stop(), stop()];
    const e = key(false);
    expect(wrapTab(e, [a, b, c], {}, c)).toBe(true);
    expect(e.prevented).toBe(true);
    expect(a.focused).toBe(true);
  });

  it('sends Shift+Tab on the first stop to the last', () => {
    const [a, b, c] = [stop(), stop(), stop()];
    const e = key(true);
    expect(wrapTab(e, [a, b, c], {}, a)).toBe(true);
    expect(c.focused).toBe(true);
  });

  it('sends Shift+Tab on the panel itself (after a click on blank space) to the last stop', () => {
    const [a, b] = [stop(), stop()];
    const panel = {};
    const e = key(true);
    expect(wrapTab(e, [a, b], panel, panel)).toBe(true);
    expect(b.focused).toBe(true);
  });

  it('leaves Tab in the middle of the panel alone', () => {
    const [a, b, c] = [stop(), stop(), stop()];
    const e = key(false);
    expect(wrapTab(e, [a, b, c], {}, b)).toBe(false);
    expect(wrapTab(key(true), [a, b, c], {}, b)).toBe(false);
    expect(e.prevented).toBe(false);
    expect([a, b, c].some((s) => s.focused)).toBe(false);
  });

  it('does nothing when the panel has no stops', () => {
    expect(wrapTab(key(false), [], {}, {})).toBe(false);
  });

  it('wraps a single stop onto itself', () => {
    const a = stop();
    expect(wrapTab(key(false), [a], {}, a)).toBe(true);
    expect(a.focused).toBe(true);
  });
});

describe('stopsIn', () => {
  it('keeps the stops that are drawn and drops the ones that are not', () => {
    const drawn = { getClientRects: () => [1], closest: () => null };
    const hidden = { getClientRects: () => [], closest: () => null };
    const inClosedDetails = { getClientRects: () => [1], closest: () => ({}) };
    const panel = { querySelectorAll: () => [drawn, hidden, inClosedDetails] } as unknown as ParentNode;
    expect(stopsIn(panel)).toEqual([drawn]);
  });
});
