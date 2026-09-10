import { describe, it, expect } from 'vitest';
import { EASE_NAMES, constantAccelEase, initialSlope, resolveEase } from '../../src/utils/easing.js';
import { hermiteStopEase as hermiteStop } from '../../src/utils/easing.js';

describe('easing', () => {
  it('every named ease is normalised: f(0) = 0 and f(1) = 1', () => {
    for (const name of EASE_NAMES) {
      const f = resolveEase(name);
      expect(f(0), name).toBeCloseTo(0, 6);
      expect(f(1), name).toBeCloseTo(1, 6);
    }
  });

  it('throws on an unknown name and lists the known ones', () => {
    expect(() => resolveEase('bouncy.out')).toThrow(/Unknown ease "bouncy.out"/);
    expect(() => resolveEase('bouncy.out')).toThrow(/power3.out/);
  });

  it('accepts a function as-is', () => {
    const f = (t: number) => t * t;
    expect(resolveEase(f)).toBe(f);
  });

  it('parses back.out with a parameter', () => {
    const f = resolveEase('back.out(2.5)');
    expect(f(1)).toBeCloseTo(1, 6);
    // Overshoots past 1 on the way.
    expect(Math.max(...Array.from({ length: 50 }, (_, i) => f(i / 49)))).toBeGreaterThan(1);
  });

  it('power N out starts with slope N', () => {
    expect(initialSlope(resolveEase('power1.out'))).toBeCloseTo(2, 2);
    expect(initialSlope(resolveEase('power2.out'))).toBeCloseTo(3, 2);
    expect(initialSlope(resolveEase('power3.out'))).toBeCloseTo(4, 2);
  });

  it('constantAccelEase from v to 0 is power1.out; the duration relation holds', () => {
    const f = constantAccelEase(100, 0);
    const p1 = resolveEase('power1.out');
    for (let t = 0; t <= 1; t += 0.1) expect(f(t)).toBeCloseTo(p1(t), 6);
    // Between two speeds the curve is monotonic and ends at 1.
    const g = constantAccelEase(300, 60);
    let prev = 0;
    for (let t = 0.05; t <= 1; t += 0.05) {
      expect(g(t)).toBeGreaterThan(prev);
      prev = g(t);
    }
    expect(g(1)).toBeCloseTo(1, 6);
  });
});

describe('hermiteStopEase', () => {
  it('starts at the given slope, ends flat at 1, and stays monotonic', () => {
    const ease = hermiteStop(0.4);
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBeCloseTo(1, 12);
    expect((ease(1e-4) - ease(0)) / 1e-4).toBeCloseTo(0.4, 3);
    expect((ease(1) - ease(1 - 1e-4)) / 1e-4).toBeCloseTo(0, 3);
    let prev = 0;
    for (let t = 0.02; t <= 1; t += 0.02) {
      const v = ease(t);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
    // slopes are clamped into the monotonic band
    expect(hermiteStop(9)(0.5)).toBe(hermiteStop(3)(0.5));
  });
});
