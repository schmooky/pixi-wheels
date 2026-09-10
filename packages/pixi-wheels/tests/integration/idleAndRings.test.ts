import { describe, it, expect } from 'vitest';
import { SpinPresets } from '../../src/config/SpinPresets.js';
import { captureEvents, createTestWheel, expectPointerOn } from '../../src/testing/testHarness.js';

describe('idle', () => {
  it('idles at the configured speed, spins from idle, and resumes after', async () => {
    const h = createTestWheel({ sections: 6, idle: { speed: 30, autoStart: true, rampMs: 200 } });
    try {
      const log = captureEvents(h.wheel, ['idle:start', 'spin:start', 'idle:stop']);
      expect(h.wheel.main.state).toBe('idling');
      h.advance(1000);
      expect(h.wheel.main.speed).toBeCloseTo(30, 0);
      const before = h.wheel.rotationDeg;
      h.advance(1000);
      expect(h.wheel.rotationDeg - before).toBeCloseTo(30, 0);
      const r = await h.spinAndLand({ index: 2 });
      expect((log.find((e) => e.event === 'spin:start')!.args[0] as { fromIdle: boolean }).fromIdle).toBe(true);
      expect(r.section.id).toBe('s2');
      expect(h.wheel.main.state).toBe('idling'); // resumed
      h.wheel.idle.stop();
      h.advance(1000);
      expect(h.wheel.main.state).toBe('idle');
      expect(log.filter((e) => e.event === 'idle:stop')).toHaveLength(1);
    } finally {
      h.destroy();
    }
  });

  it('idle.start() without config throws unless the builder had one', () => {
    const h = createTestWheel({ sections: 4 });
    try {
      expect(() => h.wheel.idle.start()).toThrow(/needs a config/);
      h.wheel.idle.start({ speed: 10 });
      expect(h.wheel.main.state).toBe('idling');
    } finally {
      h.destroy();
    }
  });
});

describe('rings', () => {
  it('two rings spin independently and each lands its own target', async () => {
    const h = createTestWheel({
      sections: 8,
      radius: 300,
      innerRadius: 200,
      rings: [
        {
          id: 'inner',
          outerRadius: 180,
          innerRadius: 40,
          direction: 'ccw',
          sections: [{ id: 'grand' }, { id: 'minor' }, { id: 'major' }],
          pointers: [{ angle: 0 }],
        },
      ],
      profile: SpinPresets.QUICK,
    });
    try {
      const outer = h.wheel.spin();
      const inner = h.wheel.spin({ ring: 'inner' });
      h.wheel.setResult({ section: 's7' });
      h.wheel.setResult({ section: 'grand' }, { ring: 'inner' });
      h.runUntilIdle();
      const [ro, ri] = await Promise.all([outer, inner]);
      expect(ro.ring).toBe('main');
      expect(ri.ring).toBe('inner');
      expectPointerOn(h.wheel, 's7');
      expectPointerOn(h.wheel, 'grand', 'inner');
      expect(h.wheel.ring('inner').direction).toBe('ccw');
    } finally {
      h.destroy();
    }
  });

  it('the outer ring can trigger the inner one from its landing event', async () => {
    const h = createTestWheel({
      sections: [{ id: 'spinInner' }, { id: 'cash' }, { id: 'cash2' }],
      radius: 300,
      innerRadius: 200,
      rings: [{ id: 'inner', outerRadius: 180, innerRadius: 40, sections: [{ id: 'grand' }, { id: 'minor' }] }],
      profile: SpinPresets.QUICK,
    });
    try {
      let innerPromise: Promise<unknown> | null = null;
      h.wheel.events.on('spin:landing', (info) => {
        if (info.ring === 'main' && info.section.id === 'spinInner') {
          innerPromise = h.wheel.spin({ ring: 'inner' });
          h.wheel.setResult({ section: 'minor' }, { ring: 'inner' });
        }
      });
      await h.spinAndLand({ section: 'spinInner' });
      expect(innerPromise).not.toBeNull();
      h.runUntilIdle();
      await innerPromise;
      expectPointerOn(h.wheel, 'minor', 'inner');
    } finally {
      h.destroy();
    }
  });
});

describe('speed profiles', () => {
  it('setSpeed switches profiles and emits', async () => {
    const h = createTestWheel({ sections: 4 });
    try {
      h.wheel.main.addSpeed('turbo', SpinPresets.TURBO);
      const log = captureEvents(h.wheel, ['speed:changed']);
      h.wheel.setSpeed('turbo');
      expect(h.wheel.activeSpeed).toBe('turbo');
      expect(log).toHaveLength(1);
      expect(() => h.wheel.setSpeed('warp')).toThrow(/unknown speed "warp"/);
      const r = await h.spinAndLand({ index: 1 });
      expect(r.duration).toBeLessThan(5000);
    } finally {
      h.destroy();
    }
  });
});
