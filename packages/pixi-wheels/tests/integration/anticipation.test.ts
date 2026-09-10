import { describe, it, expect } from 'vitest';
import type { ResolvedTarget } from '../../src/config/types.js';
import { SpinPresets } from '../../src/config/SpinPresets.js';
import { localAngleUnderPointer } from '../../src/core/RingGeometry.js';
import { captureEvents, createTestWheel, expectPointerOn, type TestWheelHandle } from '../../src/testing/testHarness.js';
import { resetNoticesForTest } from '../../src/utils/notify.js';

/** Tick the wheel to rest, sampling the local angle under the pointer every frame from a given event on. */
function traceFrom(h: TestWheelHandle, event: 'anticipation:bait' | 'spin:stopping'): { before: number[]; after: number[] } {
  const before: number[] = [];
  const after: number[] = [];
  let started = false;
  h.wheel.events.on(event, () => {
    started = true;
  });
  while (h.wheel.isSpinning) {
    h.ticker.tick(16);
    (started ? after : before).push(localAngleUnderPointer(h.wheel.main.rotationDeg, -90));
  }
  return { before, after };
}

// Eight sections from 0: s0 0..45, s1 45..90, ... A clockwise spin sweeps
// decreasing local angles under the pointer, so it meets s2 before s1.
describe('anticipation', () => {
  it('creep: the tease plays and the pointer still lands on the target', async () => {
    const h = createTestWheel({ sections: 8, startAngle: 0 });
    try {
      const log = captureEvents(h.wheel, ['anticipation:start', 'anticipation:bait', 'anticipation:end', 'spin:landing', 'spin:stopping']);
      const r = await h.spinAndLand({ section: 's1' }, { anticipation: { bait: 's2' } });
      expect(r.section.id).toBe('s1');
      expectPointerOn(h.wheel, 's1');
      const names = log.map((e) => e.event);
      expect(names).toEqual(['spin:stopping', 'anticipation:start', 'anticipation:bait', 'anticipation:end', 'spin:landing']);
      const stopping = log[0].args[0] as { anticipation: string };
      expect(stopping.anticipation).toBe('creep');
    } finally {
      h.destroy();
    }
  });

  it('auto picks overshoot when the bait follows the target', async () => {
    const h = createTestWheel({ sections: 8, startAngle: 0 });
    try {
      let style = '';
      h.wheel.events.on('anticipation:start', (i) => (style = i.style));
      const r = await h.spinAndLand({ section: 's2' }, { anticipation: { bait: 's1' } });
      expect(style).toBe('overshoot');
      expect(r.section.id).toBe('s2');
      expectPointerOn(h.wheel, 's2');
    } finally {
      h.destroy();
    }
  });

  it('stutter lands too, with a dwell in the middle', async () => {
    const h = createTestWheel({ sections: 8, startAngle: 0, profile: SpinPresets.QUICK });
    try {
      let dwellSeen = false;
      h.wheel.events.on('anticipation:bait', () => {
        dwellSeen = true;
        expect(Math.abs(h.wheel.main.speed)).toBeLessThan(1); // halted
      });
      await h.spinAndLand({ section: 's5' }, { anticipation: { bait: 's6', style: 'stutter', dwellMs: 300 } });
      expect(dwellSeen).toBe(true);
      expectPointerOn(h.wheel, 's5');
    } finally {
      h.destroy();
    }
  });

  it('a bait far from the target is dropped with a warning and the spin still lands', async () => {
    resetNoticesForTest();
    const h = createTestWheel({ sections: 8, startAngle: 0 });
    try {
      let started = 0;
      h.wheel.events.on('anticipation:start', () => started++);
      const r = await h.spinAndLand({ section: 's0' }, { anticipation: { bait: 's4' } });
      expect(started).toBe(0);
      expect(r.section.id).toBe('s0');
      expectPointerOn(h.wheel, 's0');
    } finally {
      h.destroy();
    }
  });

  it('ccw flips which neighbour counts as "before"', async () => {
    const h = createTestWheel({ sections: 8, startAngle: 0, direction: 'ccw' });
    try {
      let style = '';
      h.wheel.events.on('anticipation:start', (i) => (style = i.style));
      // ccw sweeps increasing local angles: it meets s0 before s1.
      await h.spinAndLand({ section: 's1' }, { anticipation: { bait: 's0' } });
      expect(style).toBe('creep');
      expectPointerOn(h.wheel, 's1');
    } finally {
      h.destroy();
    }
  });

  it('overshoot: only a few degrees over the line, a beat, a soft roll back, rest by the line', () => {
    // s2 is 90..135. Clockwise the pointer meets s2 then s1, so the bait s1
    // sits after the landing: overshoot. The shared line is 90.
    const h = createTestWheel({ sections: 8, startAngle: 0 });
    try {
      let resolved: ResolvedTarget | null = null;
      h.wheel.events.on('spin:resultSet', ({ target }) => (resolved = target));
      void h.wheel.spin();
      h.wheel.setResult({ section: 's2' }, { anticipation: { bait: 's1' } });
      // Rest 0.22 of a 45 deg section inside the line at 90.
      expect(resolved!.offset).toBeCloseTo(0.22, 6);
      expect(resolved!.landingAngle).toBeCloseTo(90 + 0.22 * 45, 6);

      const { before, after } = traceFrom(h, 'anticipation:bait');
      // The bait event fires at the apex: a fifth of the bait, capped at 5 deg past the line.
      const apex = after[0];
      expect(apex).toBeLessThan(90);
      expect(apex).toBeGreaterThan(90 - 5 - 0.6);
      // The last second before the apex only ever moves toward it: no wobble, no deeper.
      const approach = before.slice(-60);
      for (let i = 1; i < approach.length; i++) expect(approach[i]).toBeLessThanOrEqual(approach[i - 1] + 1e-6);
      expect(Math.min(...approach)).toBeGreaterThanOrEqual(apex - 1e-6);
      // After the beat the pointer rolls back over the line, monotonically, and never fast.
      let peakBack = 0;
      for (let i = 1; i < after.length; i++) {
        const step = after[i] - after[i - 1];
        expect(step).toBeGreaterThanOrEqual(-1e-6);
        peakBack = Math.max(peakBack, step / 0.016);
      }
      expect(peakBack).toBeLessThan(60); // deg/s: a push, not a snap
      expect(after[after.length - 1]).toBeCloseTo(90 + 0.22 * 45, 3);
      expectPointerOn(h.wheel, 's2');
    } finally {
      h.destroy();
    }
  });

  it('creep: crawls through the bait and rests just past the line', () => {
    // s1 is 45..90, the bait s2 is 90..135 and comes first. The shared line is 90.
    const h = createTestWheel({ sections: 8, startAngle: 0 });
    try {
      let resolved: ResolvedTarget | null = null;
      h.wheel.events.on('spin:resultSet', ({ target }) => (resolved = target));
      void h.wheel.spin();
      h.wheel.setResult({ section: 's1' }, { anticipation: { bait: 's2', creepSpeed: 40 } });
      expect(resolved!.offset).toBeCloseTo(0.78, 6);
      expect(resolved!.landingAngle).toBeCloseTo(90 - 0.22 * 45, 6);
      const { after } = traceFrom(h, 'anticipation:bait');
      // Enters the bait at its far edge (one frame of crawl in) and only ever moves on, never faster than the crawl.
      expect(after[0]).toBeLessThanOrEqual(135);
      expect(after[0]).toBeGreaterThan(135 - 1);
      for (let i = 1; i < after.length; i++) {
        const step = after[i - 1] - after[i];
        expect(step).toBeGreaterThanOrEqual(-1e-6);
        expect(step / 0.016).toBeLessThan(40 + 1);
      }
      expect(after[after.length - 1]).toBeCloseTo(90 - 0.22 * 45, 3);
      expectPointerOn(h.wheel, 's1');
    } finally {
      h.destroy();
    }
  });

  it("rest: 'keep', an explicit offset and an exact landing leave the landing angle alone", async () => {
    const h = createTestWheel({ sections: 8, startAngle: 0 });
    try {
      const seen: ResolvedTarget[] = [];
      h.wheel.events.on('spin:resultSet', ({ target }) => seen.push(target));
      await h.spinAndLand({ section: 's2' }, { anticipation: { bait: 's1', rest: 'keep' } });
      await h.spinAndLand({ section: 's2', offset: 0.4 }, { anticipation: { bait: 's1' } });
      await h.spinAndLand({ section: 's2' }, { mode: 'exact', anticipation: { bait: 's1' } });
      await h.spinAndLand({ section: 's2' }, { anticipation: { bait: 's1', rest: 0.1 } });
      expect(seen.map((t) => t.offset)).toEqual([0.5, 0.4, 0.5, 0.1]);
      expectPointerOn(h.wheel, 's2');
    } finally {
      h.destroy();
    }
  });
});
