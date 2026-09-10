import { describe, expect, it } from 'vitest';
import { chordAt, labelSlot, scaleToFit } from '../../src/utils/fit.js';

describe('scaleToFit', () => {
  it('contains by the tighter axis and never enlarges by default', () => {
    expect(scaleToFit({ width: 200, height: 50 }, { width: 100, height: 100 })).toBeCloseTo(0.5);
    expect(scaleToFit({ width: 20, height: 5 }, { width: 100, height: 100 })).toBe(1);
    expect(scaleToFit({ width: 20, height: 5 }, { width: 100, height: 100 }, { max: Infinity })).toBeCloseTo(5);
  });

  it('covers, matches one axis, or leaves the scale alone', () => {
    expect(scaleToFit({ width: 200, height: 50 }, { width: 100, height: 100 }, { mode: 'cover', max: Infinity })).toBeCloseTo(2);
    expect(scaleToFit({ width: 200, height: 50 }, { width: 100, height: 100 }, { mode: 'width' })).toBeCloseTo(0.5);
    expect(scaleToFit({ width: 200, height: 50 }, { width: 100, height: 100 }, { mode: 'height' })).toBe(1);
    expect(scaleToFit({ width: 200, height: 50 }, { width: 10, height: 10 }, { mode: 'none' })).toBe(1);
  });

  it('keeps padding free on both sides and survives degenerate sizes', () => {
    expect(scaleToFit({ width: 100, height: 100 }, { width: 100, height: 100 }, { padding: 0.1 })).toBeCloseTo(0.8);
    expect(scaleToFit({ width: 0, height: 0 }, { width: 100, height: 100 })).toBe(1);
    expect(scaleToFit({ width: 100, height: 100 }, { width: 0, height: 0 })).toBe(0);
  });
});

describe('labelSlot', () => {
  it('measures the chord at the label radius and the radial room around it', () => {
    const slot = labelSlot({ arc: 60 }, 200, 0, { radius: 0.5, margin: 0 });
    expect(slot.radius).toBe(100);
    expect(slot.chord).toBeCloseTo(chordAt(100, 60));
    expect(slot.chord).toBeCloseTo(100);
    // Centred at 100 in a 0..200 band: 100 either way, times the 0.96 inset.
    expect(slot.radial).toBeCloseTo(192);
    expect(slot.width).toBeCloseTo(slot.radial);
    expect(slot.height).toBeCloseTo(slot.chord);
  });

  it('swaps the axes for tangential and upright content', () => {
    const t = labelSlot({ arc: 30 }, 300, 60, { orientation: 'tangential' });
    expect(t.width).toBeCloseTo(t.chord);
    expect(t.height).toBeCloseTo(t.radial);
    const u = labelSlot({ arc: 30 }, 300, 60, { orientation: 'tangential-in' });
    expect(u.width).toBeCloseTo(t.width);
  });

  it('shrinks the radial room near the hub or the rim', () => {
    const nearRim = labelSlot({ arc: 30 }, 300, 0, { radius: 0.9 });
    expect(nearRim.radial).toBeCloseTo(2 * 30 * 0.96);
    const nearHub = labelSlot({ arc: 30 }, 300, 100, { radius: 0.4 });
    expect(nearHub.radial).toBeCloseTo(2 * 20 * 0.96);
  });
});
