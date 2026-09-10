import { describe, it, expect } from 'vitest';
import { RingGeometry, localAngleUnderPointer, rotationForLocalAngle } from '../../src/core/RingGeometry.js';

const four = [
  { id: 'a', weight: 1 },
  { id: 'b', weight: 1 },
  { id: 'c', weight: 1 },
  { id: 'd', weight: 1 },
];

describe('RingGeometry', () => {
  it('lays equal weights out as equal arcs from the start angle', () => {
    const g = new RingGeometry(four, { startAngle: -90 });
    expect(g.sections.map((s) => s.arc)).toEqual([90, 90, 90, 90]);
    expect(g.byId('a').startAngle).toBe(-90);
    expect(g.byId('a').endAngle).toBe(0);
    expect(g.byId('d').endAngle).toBe(270);
    expect(g.byId('b').midAngle).toBe(45);
  });

  it('gives unequal weights proportional arcs and closes the ring exactly', () => {
    const g = new RingGeometry([{ id: 'big', weight: 3 }, { id: 'small', weight: 1 }]);
    expect(g.byId('big').arc).toBe(270);
    expect(g.byId('small').arc).toBe(90);
    const last = g.sections[g.sections.length - 1];
    expect(last.endAngle - g.startAngle).toBe(360);
  });

  it('finds the section under a local angle, including across the wrap', () => {
    const g = new RingGeometry(four, { startAngle: -90 });
    expect(g.sectionAt(-45).id).toBe('a');
    expect(g.sectionAt(315).id).toBe('a');
    expect(g.sectionAt(0).id).toBe('b');
    expect(g.sectionAt(89.999).id).toBe('b');
    expect(g.sectionAt(90).id).toBe('c');
    expect(g.sectionAt(200).id).toBe('d');
  });

  it('rejects fewer than two sections, duplicate ids and bad weights', () => {
    expect(() => new RingGeometry([{ id: 'only' }])).toThrow(/at least 2/);
    expect(() => new RingGeometry([{ id: 'x' }, { id: 'x' }])).toThrow(/Duplicate section id "x"/);
    expect(() => new RingGeometry([{ id: 'x', weight: 0 }, { id: 'y' }])).toThrow(/weight/);
  });

  it('setWeights re-lays out and validates', () => {
    const g = new RingGeometry(four);
    g.setWeights({ a: 3 });
    expect(g.byId('a').arc).toBe(180);
    expect(g.byId('b').arc).toBe(60);
    expect(() => g.setWeights({ zzz: 1 })).toThrow(/unknown section "zzz"/);
    expect(() => g.setWeights({ a: -1 })).toThrow(/must be finite and > 0/);
  });

  it('entry and exit edges depend on the spin direction', () => {
    const g = new RingGeometry(four, { startAngle: 0 });
    const b = g.byId('b'); // 90..180
    expect(g.entryAngle(b, 'cw')).toBe(180);
    expect(g.exitAngle(b, 'cw')).toBe(90);
    expect(g.entryAngle(b, 'ccw')).toBe(90);
  });

  it('pointer <-> local angle helpers invert each other', () => {
    const pointer = -90;
    for (const local of [0, 33, 180, 359]) {
      const rot = rotationForLocalAngle(local, pointer);
      expect(localAngleUnderPointer(rot, pointer)).toBeCloseTo(local, 9);
    }
  });

  it('resolves palette colours by index and keeps explicit fills', () => {
    const g = new RingGeometry([{ id: 'a' }, { id: 'b', style: { fill: 0x123456 } }], { palette: [0xaaaaaa, 0xbbbbbb] });
    expect(g.byId('a').style.fill).toBe(0xaaaaaa);
    expect(g.byId('b').style.fill).toBe(0x123456);
  });
});
