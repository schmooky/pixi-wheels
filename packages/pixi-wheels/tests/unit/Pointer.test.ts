import { describe, it, expect } from 'vitest';
import type { ResolvedPegs } from '../../src/config/types.js';
import { Pointer } from '../../src/pointer/Pointer.js';
import { RingGeometry } from '../../src/core/RingGeometry.js';
import { HeadlessPointerSkin } from '../../src/testing/testHarness.js';

const g = new RingGeometry(Array.from({ length: 4 }, (_, i) => ({ id: `s${i}` })), { startAngle: 0 });
// Pegs where a ring puts them by default: `tipInset + size - bite` inside a
// 200 px rim, so the peg's shoulder bites 2 px into the blade. The headless
// skin is 60 px long, so an inward pointer pins at 242.
const pegs: ResolvedPegs = { size: 6, radius: 200 - (18 + 6 - 2), angles: [0, 90, 180, 270] };

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


/**
 * How far the nearest peg reaches inside the blade, px. Re-derived here on
 * purpose: the test states the geometry itself rather than asking the code
 * under test whether it is happy with its own work.
 */
function penetration(p: Pointer, rotation: number): number {
  const flap = p.flap!;
  const a = (p.angle * Math.PI) / 180;
  const L = p.skin.length;
  const baseHalf = flap.tipWidth / 2;
  const pin = { x: Math.cos(a) * p.pinRadius, y: Math.sin(a) * p.pinRadius };
  const dir = a + Math.PI + (p.deflection * Math.PI) / 180;
  const u = { x: Math.cos(dir), y: Math.sin(dir) };
  const tri = [
    { x: pin.x - u.y * baseHalf, y: pin.y + u.x * baseHalf },
    { x: pin.x + u.y * baseHalf, y: pin.y - u.x * baseHalf },
    { x: pin.x + u.x * L, y: pin.y + u.y * L },
  ];
  let worst = 0;
  for (const deg of pegs.angles) {
    const q = { x: Math.cos(((deg + rotation) * Math.PI) / 180) * pegs.radius, y: Math.sin(((deg + rotation) * Math.PI) / 180) * pegs.radius };
    const side = (i: number, j: number): number =>
      (tri[j].x - tri[i].x) * (q.y - tri[i].y) - (tri[j].y - tri[i].y) * (q.x - tri[i].x);
    const s = [side(0, 1), side(1, 2), side(2, 0)];
    const inside = s.every((v) => v >= 0) || s.every((v) => v <= 0);
    const edge = (i: number, j: number): number => {
      const dx = tri[j].x - tri[i].x;
      const dy = tri[j].y - tri[i].y;
      const len = dx * dx + dy * dy;
      const t = Math.max(0, Math.min(1, ((q.x - tri[i].x) * dx + (q.y - tri[i].y) * dy) / len));
      return Math.hypot(q.x - (tri[i].x + dx * t), q.y - (tri[i].y + dy * t));
    };
    const d = Math.min(edge(0, 1), edge(1, 2), edge(2, 0));
    worst = Math.max(worst, inside ? pegs.size + d : pegs.size - d);
  }
  return worst;
}

describe('Pointer against pegs', () => {
  it('never lets a peg into the blade, at any speed', () => {
    for (const step of [0.2, 1.5, 6, 40]) {
      const p = new Pointer({ angle: -90 }, new HeadlessPointerSkin());
      p.layout(200, 0);
      let worst = 0;
      let rot = -40;
      while (rot < 40) {
        const next = rot + step;
        p.update(rot, next, 0.016, g, 'cw', pegs);
        worst = Math.max(worst, penetration(p, next));
        rot = next;
      }
      // A hair of tolerance for the bisection that finds the clearing angle.
      expect(worst, `step ${step} deg`).toBeLessThan(0.25);
    }
  });

  it('is pushed aside as a peg comes through, then falls only once it has gone', () => {
    const p = new Pointer({ angle: -90, flap: { friction: 0 } }, new HeadlessPointerSkin());
    p.layout(200, 0);
    const trace = crawl(p, -14, 20, 0.2);
    const peakAt = trace.reduce((best, t, i) => (Math.abs(t.d) > Math.abs(trace[best].d) ? i : best), 0);
    expect(trace[0].d).toBe(0);
    expect(trace[0].peg).toBeNull();
    // A monotone ride up the peg's face, thrown negative: inward pointer, cw disc.
    for (let i = 1; i <= peakAt; i++) expect(Math.abs(trace[i].d)).toBeGreaterThanOrEqual(Math.abs(trace[i - 1].d) - 1e-9);
    expect(trace[peakAt].d).toBeLessThan(0);
    // The blade has to lift its tip clear of the peg, so the swing is real:
    // about 13 deg for a peg biting 2 px into a 60 px blade, with friction 0.
    expect(Math.abs(trace[peakAt].d)).toBeGreaterThan(8);
    expect(Math.abs(trace[peakAt].d)).toBeLessThanOrEqual(p.flap!.maxAngle);
    expect(trace[peakAt].peg).toBe(3);
    // It is still held at the peak when it lets go, and only then does it drop.
    const after = trace.slice(peakAt + 1);
    const released = after.findIndex((t) => t.peg === null);
    expect(released).toBeGreaterThanOrEqual(0);
    for (let i = 0; i < released; i++) expect(Math.abs(after[i].d)).toBeGreaterThan(Math.abs(trace[peakAt].d) * 0.85);
    expect(Math.abs(after[released].d)).toBeLessThan(Math.abs(trace[peakAt].d));
    for (let i = 0; i < 500; i++) p.update(20, 20, 0.016, g, 'cw', pegs);
    expect(p.deflection).toBe(0);
  });

  it('friction holds it up longer, elasticity throws it further', () => {
    const heldTo = (friction: number): number => {
      const p = new Pointer({ angle: -90, flap: { friction } }, new HeadlessPointerSkin());
      p.layout(200, 0);
      return Math.max(...crawl(p, -14, 24, 0.2).filter((t) => t.peg !== null).map((t) => t.rot));
    };
    expect(heldTo(1)).toBeGreaterThan(heldTo(0) + 1);

    const peak = (elasticity: number): number => {
      const p = new Pointer({ angle: -90, flap: { elasticity, maxAngle: 120 } }, new HeadlessPointerSkin());
      p.layout(200, 0);
      return Math.max(...crawl(p, -14, 20, 0.2).map((t) => Math.abs(t.d)));
    };
    expect(peak(1.4)).toBeGreaterThan(peak(1) * 1.2);
    // Under 1 is clamped: yielding less than the geometry means cutting through.
    expect(peak(0.4)).toBeCloseTo(peak(1), 6);
  });

  it('a peg that passes within one frame flicks the tongue and it springs back', () => {
    const skin = new HeadlessPointerSkin();
    const p = new Pointer({ angle: -90 }, skin);
    p.layout(200, 0);
    p.update(0, 100, 0.016, g, 'cw', pegs);
    expect(Math.abs(p.deflection)).toBeGreaterThan(4);
    expect(skin.ticks).toBe(1);
    for (let i = 0; i < 400; i++) p.update(100, 100, 0.016, g, 'cw', pegs);
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
    const peak = Math.max(...crawl(capped, -14, 16, 0.2).map((t) => Math.abs(t.d)));
    expect(peak).toBeLessThanOrEqual(5);
  });

  it('rests straight before the wheel has ever turned, even over a peg', () => {
    const p = new Pointer({ angle: -90 }, new HeadlessPointerSkin());
    p.layout(200, 0);
    for (let i = 0; i < 10; i++) p.update(0, 0, 0.016, g, 'cw', pegs);
    expect(p.deflection).toBe(0);
    expect(p.engagedPeg).toBeNull();
  });

  it('the debug contact width follows the peg size and the tip width', () => {
    const p = new Pointer({ angle: -90, flap: { tipWidth: 20 } }, new HeadlessPointerSkin());
    expect(p.contactHalfWidth({ size: 4, radius: 190, angles: [] })).toBe(14);
  });
});
