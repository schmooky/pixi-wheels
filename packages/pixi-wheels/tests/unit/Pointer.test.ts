import { describe, it, expect } from 'vitest';
import { Pointer } from '../../src/pointer/Pointer.js';
import { RingGeometry } from '../../src/core/RingGeometry.js';
import { HeadlessPointerSkin } from '../../src/testing/testHarness.js';

const g = new RingGeometry(Array.from({ length: 4 }, (_, i) => ({ id: `s${i}` })), { startAngle: 0 });

describe('Pointer crossings', () => {
  it('reports each divider once, in order, for a clockwise step', () => {
    const p = new Pointer({ angle: -90, flap: false }, new HeadlessPointerSkin());
    // Pointer at -90: rotation 5 puts local 265 under it (inside s2: 180..270).
    // Turning cw by 190 deg sweeps local 265 -> 75, crossing the dividers at 180 and 90.
    const crossings = p.update(5, 195, 0.1, g, 'cw');
    expect(crossings.map((c) => `${c.from.id}>${c.to.id}`)).toEqual(['s2>s1', 's1>s0']);
    expect(crossings[0].speed).toBeCloseTo(1900, 6);
    expect(crossings[0].direction).toBe('cw');
  });

  it('reports the reverse order for a counter-clockwise step', () => {
    const p = new Pointer({ angle: -90, flap: false }, new HeadlessPointerSkin());
    // Local sweeps 270 -> 10: only the divider at 0/360 passes under the pointer.
    const crossings = p.update(0, -100, 0.1, g, 'ccw');
    expect(crossings.map((c) => `${c.from.id}>${c.to.id}`)).toEqual(['s3>s0']);
    const two = p.update(0, -200, 0.1, g, 'ccw');
    expect(two.map((c) => `${c.from.id}>${c.to.id}`)).toEqual(['s3>s0', 's0>s1']);
  });

  it('caps a huge frame at one full lap of dividers', () => {
    const p = new Pointer({ angle: -90, flap: false }, new HeadlessPointerSkin());
    // Start off a divider (rotation 5 => local 265) so all four dividers are strictly ahead.
    expect(p.update(5, 1005, 0.1, g, 'cw')).toHaveLength(4);
    // Starting exactly on a divider, the start divider is not re-counted.
    expect(p.update(0, 1000, 0.1, g, 'cw')).toHaveLength(3);
  });

  it('flap deflects on a crossing and springs back', () => {
    const skin = new HeadlessPointerSkin();
    const p = new Pointer({ angle: -90 }, skin);
    p.update(0, 100, 0.016, g, 'cw');
    expect(Math.abs(p.deflection)).toBeGreaterThan(0);
    for (let i = 0; i < 200; i++) p.update(100, 100, 0.016, g, 'cw');
    expect(p.deflection).toBe(0);
    expect(skin.ticks).toBe(1);
  });

  it('seats itself on the rim facing the hub, or at the hub facing out', () => {
    const inward = new Pointer({ angle: -90 }, new HeadlessPointerSkin());
    inward.layout(200, 0);
    expect(inward.view.position.y).toBeCloseTo(-(200 - 18 + 60), 6);
    expect(inward.view.rotation).toBeCloseTo(Math.PI / 2, 6);
    const outward = new Pointer({ angle: -90, facing: 'outward' }, new HeadlessPointerSkin());
    outward.layout(200, 80);
    expect(outward.view.position.y).toBeCloseTo(-(80 + 18 - 60), 6);
    expect(outward.view.rotation).toBeCloseTo(-Math.PI / 2, 6);
  });
});
