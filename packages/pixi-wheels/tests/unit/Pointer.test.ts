import { describe, it, expect } from 'vitest';
import type { ResolvedPegs } from '../../src/config/types.js';
import { Pointer } from '../../src/pointer/Pointer.js';
import { RingGeometry } from '../../src/core/RingGeometry.js';
import { HeadlessPointerSkin } from '../../src/testing/testHarness.js';

const g = new RingGeometry(Array.from({ length: 4 }, (_, i) => ({ id: `s${i}` })), { startAngle: 0 });
// Pegs on the dividers, 9 px inside a 200 px rim. The headless skin is 60 px long,
// so an inward pointer with the default tipInset pins at 242: 51 px above the pegs.
const pegs: ResolvedPegs = { size: 6, radius: 191, angles: [0, 90, 180, 270] };
const crownDeg = (Math.atan((6 + 7) / 51) * 180) / Math.PI;

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

  it('seats itself on the rim facing the hub, or at the hub facing out', () => {
    const inward = new Pointer({ angle: -90 }, new HeadlessPointerSkin());
    inward.layout(200, 0);
    expect(inward.view.position.y).toBeCloseTo(-(200 - 18 + 60), 6);
    expect(inward.view.rotation).toBeCloseTo(Math.PI / 2, 6);
    expect(inward.pinRadius).toBe(242);
    const outward = new Pointer({ angle: -90, facing: 'outward' }, new HeadlessPointerSkin());
    outward.layout(200, 80);
    expect(outward.view.position.y).toBeCloseTo(-(80 + 18 - 60), 6);
    expect(outward.view.rotation).toBeCloseTo(-Math.PI / 2, 6);
  });
});

/** Turn the disc from `from` to `to` in `stepDeg` increments at 60 fps, recording the deflection. */
function crawl(p: Pointer, from: number, to: number, stepDeg: number): Array<{ rot: number; d: number; peg: number | null }> {
  const out: Array<{ rot: number; d: number; peg: number | null }> = [];
  let rot = from;
  while (rot < to - 1e-9) {
    const next = Math.min(to, rot + stepDeg);
    p.update(rot, next, 0.016, g, 'cw', pegs);
    rot = next;
    out.push({ rot, d: p.deflection, peg: p.engagedPeg });
  }
  return out;
}

describe('Pointer against pegs', () => {
  it('is pushed aside as a peg approaches, carried on its crown, then released into the spring', () => {
    const p = new Pointer({ angle: -90 }, new HeadlessPointerSkin());
    p.layout(200, 0);
    // The peg at local 270 sits under the pointer at rotation 0. Come in from 12 deg before it.
    const trace = crawl(p, -12, 14, 0.25);
    const c = p.contactHalfWidth(pegs); // 13 px
    expect(c).toBe(13);
    const touchDeg = (c / pegs.radius) * (180 / Math.PI); // ~3.9 deg before the axis
    const releaseDeg = touchDeg * 1.35; // friction 0.35
    const before = trace.filter((t) => t.rot < -touchDeg - 0.3);
    expect(before.every((t) => t.d === 0 && t.peg === null)).toBe(true);
    const approach = trace.filter((t) => t.rot > -touchDeg + 0.3 && t.rot < -0.3);
    expect(approach.length).toBeGreaterThan(5);
    for (let i = 1; i < approach.length; i++) expect(Math.abs(approach[i].d)).toBeGreaterThan(Math.abs(approach[i - 1].d));
    expect(approach.every((t) => t.peg === 3)).toBe(true);
    // On the crown and carried: the full geometric deflection, held flat until release.
    const carried = trace.filter((t) => t.rot > 0.3 && t.rot < releaseDeg - 0.3);
    expect(carried.length).toBeGreaterThan(3);
    for (const t of carried) expect(Math.abs(t.d)).toBeCloseTo(crownDeg, 4);
    // Inward pointer, clockwise disc: the tongue is thrown to negative deflection.
    expect(carried[0].d).toBeLessThan(0);
    // Released: no peg, and the spring brings it home.
    const after = trace.filter((t) => t.rot > releaseDeg + 0.3);
    expect(after.every((t) => t.peg === null)).toBe(true);
    for (let i = 0; i < 300; i++) p.update(14, 14, 0.016, g, 'cw', pegs);
    expect(p.deflection).toBe(0);
  });

  it('elasticity scales the push and friction sets the carry', () => {
    const soft = new Pointer({ angle: -90, flap: { elasticity: 0.5, friction: 0 } }, new HeadlessPointerSkin());
    soft.layout(200, 0);
    const trace = crawl(soft, -12, 14, 0.25);
    const peak = Math.max(...trace.map((t) => Math.abs(t.d)));
    expect(peak).toBeCloseTo(crownDeg * 0.5, 3);
    // friction 0: lets go as soon as the peg centre has passed the tip, one contact half-width past the axis
    const touch = (13 / pegs.radius) * (180 / Math.PI);
    const carried0 = trace.filter((t) => t.rot > 0 && t.peg !== null);
    expect(carried0.length).toBeGreaterThan(0);
    expect(Math.max(...carried0.map((t) => t.rot))).toBeLessThanOrEqual(touch + 0.3);
    const sticky = new Pointer({ angle: -90, flap: { friction: 1 } }, new HeadlessPointerSkin());
    sticky.layout(200, 0);
    const carried = crawl(sticky, -12, 14, 0.25).filter((t) => t.peg !== null && t.rot > 0);
    const touchDeg = (13 / pegs.radius) * (180 / Math.PI);
    expect(Math.max(...carried.map((t) => t.rot))).toBeGreaterThan(touchDeg * 1.9);
  });

  it('a peg that passes within one frame flicks the tongue to the crown and it springs back', () => {
    const skin = new HeadlessPointerSkin();
    const p = new Pointer({ angle: -90 }, skin);
    p.layout(200, 0);
    p.update(0, 100, 0.016, g, 'cw', pegs);
    // Flicked to the crown, then one frame of spring already applied.
    expect(Math.abs(p.deflection)).toBeGreaterThan(crownDeg * 0.8);
    expect(Math.abs(p.deflection)).toBeLessThanOrEqual(crownDeg);
    expect(skin.ticks).toBe(1);
    for (let i = 0; i < 300; i++) p.update(100, 100, 0.016, g, 'cw', pegs);
    expect(p.deflection).toBe(0);
  });

  it('stays at rest without pegs, when rigid, and never beyond maxAngle', () => {
    const noPegs = new Pointer({ angle: -90 }, new HeadlessPointerSkin());
    noPegs.layout(200, 0);
    noPegs.update(0, 100, 0.016, g, 'cw', null);
    expect(noPegs.deflection).toBe(0);
    const rigid = new Pointer({ angle: -90, flap: false }, new HeadlessPointerSkin());
    rigid.layout(200, 0);
    rigid.update(0, 100, 0.016, g, 'cw', pegs);
    expect(rigid.deflection).toBe(0);
    expect(rigid.flap).toBeNull();
    const capped = new Pointer({ angle: -90, flap: { maxAngle: 5, elasticity: 3 } }, new HeadlessPointerSkin());
    capped.layout(200, 0);
    const peak = Math.max(...crawl(capped, -12, 14, 0.25).map((t) => Math.abs(t.d)));
    expect(peak).toBeLessThanOrEqual(5);
  });

  it('rests straight before the wheel has ever turned, even over a peg', () => {
    const p = new Pointer({ angle: -90 }, new HeadlessPointerSkin());
    p.layout(200, 0);
    // rotation 0 puts the peg at local 270 exactly under the pointer
    for (let i = 0; i < 10; i++) p.update(0, 0, 0.016, g, 'cw', pegs);
    expect(p.deflection).toBe(0);
    expect(p.engagedPeg).toBeNull();
  });

  it('the debug contact width follows the peg size and the tip width', () => {
    const p = new Pointer({ angle: -90, flap: { tipWidth: 20 } }, new HeadlessPointerSkin());
    expect(p.contactHalfWidth({ size: 4, radius: 190, angles: [] })).toBe(14);
  });
});
