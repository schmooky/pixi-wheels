import { describe, it, expect } from 'vitest';
import { SpinPresets } from '../../src/config/SpinPresets.js';
import { captureEvents, createTestWheel, expectPointerOn } from '../../src/testing/testHarness.js';

describe('skip', () => {
  it('skip() after setResult fast-forwards to the landing and flags the result', async () => {
    const h = createTestWheel({ sections: 8 });
    try {
      const log = captureEvents(h.wheel, ['skip:requested', 'skip:completed', 'spin:landing', 'spin:complete']);
      const p = h.wheel.spin();
      h.advance(500);
      h.wheel.setResult({ section: 's5' });
      expect(h.wheel.skip()).toBe(true);
      h.runUntilIdle();
      const r = await p;
      expect(r.wasSkipped).toBe(true);
      expect(r.duration).toBeLessThan(2000);
      expectPointerOn(h.wheel, 's5');
      expect(log.map((e) => e.event)).toEqual(['skip:requested', 'skip:completed', 'spin:landing', 'spin:complete']);
    } finally {
      h.destroy();
    }
  });

  it('skip() before setResult throws; requestSkip() queues the press', async () => {
    const h = createTestWheel({ sections: 8 });
    try {
      const p = h.wheel.spin();
      h.advance(300);
      expect(() => h.wheel.skip()).toThrow(/requestSkip/);
      h.wheel.requestSkip();
      h.advance(300);
      h.wheel.setResult({ section: 's1' });
      h.runUntilIdle();
      const r = await p;
      expect(r.wasSkipped).toBe(true);
      expectPointerOn(h.wheel, 's1');
    } finally {
      h.destroy();
    }
  });

  it('skip() mid-deceleration still lands on the target', async () => {
    const h = createTestWheel({ sections: 8 });
    try {
      const p = h.wheel.spin();
      h.wheel.setResult({ section: 's6' });
      // Run until the stop is under way, then skip.
      let stopping = false;
      h.wheel.events.on('spin:stopping', () => (stopping = true));
      while (!stopping) h.ticker.tick(16);
      h.advance(700);
      h.wheel.skip();
      h.runUntilIdle();
      await p;
      expectPointerOn(h.wheel, 's6');
    } finally {
      h.destroy();
    }
  });

  it('skip config: disabled and minimumSpinTime', async () => {
    const off = createTestWheel({ sections: 4, skip: { allowed: false } });
    try {
      const p = off.wheel.spin();
      off.wheel.setResult({ index: 0 });
      expect(off.wheel.skip()).toBe(false);
      off.runUntilIdle();
      expect((await p).wasSkipped).toBe(false);
    } finally {
      off.destroy();
    }
    const late = createTestWheel({ sections: 4, skip: { minimumSpinTime: 2000 } });
    try {
      const p = late.wheel.spin();
      late.wheel.setResult({ index: 0 });
      late.advance(500);
      expect(late.wheel.skip()).toBe(false);
      late.advance(1600);
      expect(late.wheel.skip()).toBe(true);
      late.runUntilIdle();
      expect((await p).wasSkipped).toBe(true);
    } finally {
      late.destroy();
    }
  });

  it('slamStop() completes synchronously on the final position', async () => {
    const h = createTestWheel({ sections: 6, startAngle: 0 });
    try {
      const p = h.wheel.spin();
      h.advance(200);
      h.wheel.setResult({ section: 's4', offset: 0.2 }, { settle: 'center' });
      h.wheel.slamStop();
      expect(h.wheel.main.state).toBe('idle');
      const r = await p;
      expect(r.wasSkipped).toBe(true);
      expectPointerOn(h.wheel, 's4');
      // settle center applied instantly
      expect(h.wheel.main.localAngleUnderPointer()).toBeCloseTo(270, 4);
    } finally {
      h.destroy();
    }
  });

  it('a protected tease survives the first press and ends on the second', async () => {
    const h = createTestWheel({ sections: 8, startAngle: 0, profile: SpinPresets.NORMAL });
    try {
      const log = captureEvents(h.wheel, ['anticipation:start', 'anticipation:bait', 'skip:requested', 'anticipation:end', 'spin:landing']);
      const p = h.wheel.spin();
      // cw: the pointer meets s2 before s1; bait s2, land s1.
      h.wheel.setResult({ section: 's1' }, { anticipation: { bait: 's2', style: 'creep', protectSkip: true } });
      let stopping = false;
      h.wheel.events.on('spin:stopping', () => (stopping = true));
      while (!stopping) h.ticker.tick(16);
      h.advance(200);
      expect(h.wheel.skip()).toBe(true); // jumps to the bait
      const first = log.filter((e) => e.event === 'skip:requested');
      expect((first[0].args[0] as { protectedByAnticipation: boolean }).protectedByAnticipation).toBe(true);
      h.advance(900); // in the creep now
      expect(log.some((e) => e.event === 'anticipation:bait')).toBe(true);
      expect(h.wheel.skip()).toBe(true); // second press lands
      h.runUntilIdle();
      const r = await p;
      expect(r.wasSkipped).toBe(true);
      expectPointerOn(h.wheel, 's1');
    } finally {
      h.destroy();
    }
  });
});

describe('skip timing', () => {
  it('requestSkip() before minimumSpinTime is held, not dropped', async () => {
    const h = createTestWheel({ sections: 6, skip: { minimumSpinTime: 1500 } });
    try {
      const log = captureEvents(h.wheel, ['skip:requested']);
      const p = h.wheel.spin();
      h.advance(200);
      h.wheel.requestSkip();
      h.wheel.setResult({ section: 's2' });
      h.advance(500);
      expect(log).toHaveLength(0); // too early: still held
      h.advance(1000);
      expect(log).toHaveLength(1); // released the frame it became legal
      h.runUntilIdle();
      const r = await p;
      expect(r.wasSkipped).toBe(true);
      expectPointerOn(h.wheel, 's2');
    } finally {
      h.destroy();
    }
  });

  it('a skip from the cruise emits spin:stopping once, a skip mid-stop does not repeat it', async () => {
    const h = createTestWheel({ sections: 6, profile: { ...SpinPresets.NORMAL, minimumSpinTime: 4000 } });
    try {
      const log = captureEvents(h.wheel, ['spin:stopping', 'skip:requested', 'spin:landing']);
      const p = h.wheel.spin();
      h.wheel.setResult({ section: 's1' });
      h.advance(1500); // cruising, the stop may not begin before 4000 ms
      expect(h.wheel.main.state).toBe('cruising');
      h.wheel.skip();
      expect(log.map((e) => e.event)).toEqual(['skip:requested', 'spin:stopping']);
      h.runUntilIdle();
      await p;
      expect(log.filter((e) => e.event === 'spin:stopping')).toHaveLength(1);
    } finally {
      h.destroy();
    }
    const mid = createTestWheel({ sections: 6 });
    try {
      const log = captureEvents(mid.wheel, ['spin:stopping']);
      const p = mid.wheel.spin();
      mid.wheel.setResult({ section: 's1' });
      while (log.length === 0) mid.ticker.tick(16);
      mid.advance(300);
      mid.wheel.skip();
      mid.runUntilIdle();
      await p;
      expect(log).toHaveLength(1);
    } finally {
      mid.destroy();
    }
  });
});
