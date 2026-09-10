import { describe, it, expect } from 'vitest';
import { SpinPresets } from '../../src/config/SpinPresets.js';
import { captureEvents, createTestWheel, expectPointerOn } from '../../src/testing/testHarness.js';
import { resetNoticesForTest } from '../../src/utils/notify.js';

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
});
