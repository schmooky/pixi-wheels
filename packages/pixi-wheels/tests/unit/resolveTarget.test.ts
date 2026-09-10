import { describe, it, expect } from 'vitest';
import { RingGeometry } from '../../src/core/RingGeometry.js';
import { resolveTarget } from '../../src/adapter/resolveTarget.js';
import { createTargetAdapter, readPath } from '../../src/adapter/targetAdapter.js';

const g = new RingGeometry(
  [
    { id: 'x2a', value: 2 },
    { id: 'x5', value: 5 },
    { id: 'x2b', value: 2 },
    { id: 'x10', value: 10 },
  ],
  { startAngle: 0 },
);
const opts = { mode: 'center' as const, margin: 0.12, rng: () => 0.5 };

describe('resolveTarget', () => {
  it('by id lands on the middle of the section', () => {
    const t = resolveTarget(g, { section: 'x5' }, opts);
    expect(t.section.id).toBe('x5');
    expect(t.landingAngle).toBe(135);
    expect(t.offset).toBe(0.5);
  });

  it('by index', () => {
    expect(resolveTarget(g, { index: 3 }, opts).section.id).toBe('x10');
    expect(() => resolveTarget(g, { index: 9 }, opts)).toThrow(/out of range/);
  });

  it('by value picks among duplicates', () => {
    expect(resolveTarget(g, { value: 2, pick: 'first' }, opts).section.id).toBe('x2a');
    expect(resolveTarget(g, { value: 2, pick: 'last' }, opts).section.id).toBe('x2b');
    expect(resolveTarget(g, { value: 2 }, { ...opts, rng: () => 0.9 }).section.id).toBe('x2b');
    expect(resolveTarget(g, { value: 2 }, { ...opts, rng: () => 0.1 }).section.id).toBe('x2a');
    expect(() => resolveTarget(g, { value: 99 }, opts)).toThrow(/No section carries value 99/);
  });

  it('random mode keeps the margin from the edges', () => {
    const lo = resolveTarget(g, { section: 'x5' }, { mode: 'random', margin: 0.2, rng: () => 0 });
    const hi = resolveTarget(g, { section: 'x5' }, { mode: 'random', margin: 0.2, rng: () => 0.999999 });
    expect(lo.offset).toBeCloseTo(0.2, 6);
    expect(hi.offset).toBeCloseTo(0.8, 5);
  });

  it('explicit offset wins over the mode', () => {
    const t = resolveTarget(g, { section: 'x5', offset: 0.1 }, { mode: 'random', margin: 0.12, rng: () => 0.9 });
    expect(t.offset).toBe(0.1);
    expect(t.landingAngle).toBe(99);
    expect(() => resolveTarget(g, { section: 'x5', offset: 1.5 }, opts)).toThrow(/offset/);
  });

  it('absolute angle and position forms', () => {
    const a = resolveTarget(g, { angle: 200 }, opts);
    expect(a.section.id).toBe('x2b');
    expect(a.landingAngle).toBe(200);
    expect(a.offset).toBeCloseTo((200 - 180) / 90, 6);
    const p = resolveTarget(g, { position: 0.99 }, opts);
    expect(p.section.id).toBe('x10');
    expect(() => resolveTarget(g, { position: 2 }, opts)).toThrow(/position/);
  });
});

describe('target adapters', () => {
  it('reads dotted paths and fails loud on missing ones', () => {
    expect(readPath({ a: { b: [{ c: 7 }] } }, 'a.b.0.c')).toBe(7);
    expect(() => readPath({ a: 1 }, 'a.b')).toThrow(/not found/);
    expect(() => readPath({}, 'x')).toThrow(/undefined/);
  });

  it('compiles every `by` form', () => {
    expect(createTargetAdapter({ by: 'section', path: 'r.id' })({ r: { id: 'x5' } })).toEqual({ section: 'x5' });
    expect(createTargetAdapter({ by: 'index', path: 'r.i', indexBase: 1 })({ r: { i: 3 } })).toEqual({ index: 2 });
    expect(createTargetAdapter({ by: 'value', path: 'm' })({ m: 10 })).toEqual({ value: 10, pick: 'random' });
    expect(createTargetAdapter({ by: 'angle', path: 'deg' })({ deg: '33' })).toEqual({ angle: 33 });
    expect(createTargetAdapter({ by: 'position', path: 'p' })({ p: 0.25 })).toEqual({ position: 0.25 });
    expect(createTargetAdapter({ by: 'section', path: 'id', offsetPath: 'o' })({ id: 'a', o: 0.3 })).toEqual({ section: 'a', offset: 0.3 });
  });
});
