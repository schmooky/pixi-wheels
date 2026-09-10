import { describe, it, expect } from 'vitest';
import { arcDelta, isAngleInArc, normalizeDeg, signedDeg } from '../../src/utils/angles.js';

describe('angles', () => {
  it('normalises into [0, 360)', () => {
    expect(normalizeDeg(370)).toBe(10);
    expect(normalizeDeg(-90)).toBe(270);
    expect(normalizeDeg(360)).toBe(0);
    expect(normalizeDeg(-720)).toBe(0);
  });

  it('signedDeg lands in (-180, 180]', () => {
    expect(signedDeg(190)).toBe(-170);
    expect(signedDeg(-190)).toBe(170);
    expect(signedDeg(180)).toBe(180);
  });

  it('arcDelta measures the distance travelled in the spin direction', () => {
    expect(arcDelta(10, 40, 'cw')).toBe(30);
    expect(arcDelta(10, 40, 'ccw')).toBe(330);
    expect(arcDelta(350, 10, 'cw')).toBe(20);
    expect(arcDelta(10, 350, 'ccw')).toBe(20);
    expect(arcDelta(5, 5, 'cw')).toBe(0);
  });

  it('isAngleInArc handles the wrap', () => {
    expect(isAngleInArc(355, 340, 30)).toBe(true);
    expect(isAngleInArc(5, 340, 30)).toBe(true);
    expect(isAngleInArc(15, 340, 30)).toBe(false);
    expect(isAngleInArc(340, 340, 30)).toBe(true); // start inclusive
    expect(isAngleInArc(10, 340, 30)).toBe(false); // end exclusive
  });
});
