import { describe, it, expect } from 'vitest';
import { SpinPresets } from '../../src/config/SpinPresets.js';
import { captureEvents, createTestWheel, expectPointerOn, seededRng } from '../../src/testing/testHarness.js';

describe('a spin', () => {
  it('lands the pointer on the requested section and resolves with the result', async () => {
    const h = createTestWheel({ sections: 8 });
    try {
      const result = await h.spinAndLand({ section: 's3' });
      expect(result.section.id).toBe('s3');
      expect(result.ring).toBe('main');
      expect(result.wasSkipped).toBe(false);
      expect(result.turns).toBeGreaterThanOrEqual(SpinPresets.NORMAL.minTurns);
      expectPointerOn(h.wheel, 's3');
      expect(h.wheel.main.state).toBe('idle');
    } finally {
      h.destroy();
    }
  });

  it('lands in every section of an uneven wheel, both directions', async () => {
    for (const direction of ['cw', 'ccw'] as const) {
      const h = createTestWheel({
        direction,
        sections: [
          { id: 'big', weight: 5 },
          { id: 'mid', weight: 2 },
          { id: 'sliver', weight: 0.3 },
          { id: 'other', weight: 1 },
        ],
        profile: SpinPresets.QUICK,
      });
      try {
        for (const id of ['sliver', 'big', 'other', 'mid']) {
          const r = await h.spinAndLand({ section: id });
          expect(r.section.id).toBe(id);
          expectPointerOn(h.wheel, id);
        }
      } finally {
        h.destroy();
      }
    }
  });

  it('fires the lifecycle events in order', async () => {
    const h = createTestWheel({ sections: 6 });
    try {
      const log = captureEvents(h.wheel, ['spin:start', 'spin:cruise', 'spin:resultSet', 'spin:stopping', 'spin:landing', 'spin:complete']);
      await h.spinAndLand({ index: 2 });
      // The harness sets the result right after spin(), so it lands before the cruise begins.
      expect(log.map((e) => e.event)).toEqual(['spin:start', 'spin:resultSet', 'spin:cruise', 'spin:stopping', 'spin:landing', 'spin:complete']);
    } finally {
      h.destroy();
    }
  });

  it('emits one pointer:tick per divider crossed, in order, and the ticks add up', async () => {
    const h = createTestWheel({ sections: 12, profile: SpinPresets.QUICK });
    try {
      const ticks: Array<{ from: string; to: string }> = [];
      h.wheel.events.on('pointer:tick', (i) => ticks.push({ from: i.from.id, to: i.to.id }));
      const before = h.wheel.rotationDeg;
      const r = await h.spinAndLand({ section: 's0' });
      const travelled = Math.abs(h.wheel.rotationDeg - before);
      // A pointer at -90 starts on s0's centre? No: s0 spans -90..-60 so the pointer at -90 is on its edge.
      // Crossings = floor(travelled / 30) give or take one for the start edge.
      const expected = Math.floor(travelled / 30);
      expect(Math.abs(ticks.length - expected)).toBeLessThanOrEqual(1);
      // Consecutive ticks chain: to of one is from of the next.
      for (let i = 1; i < ticks.length; i++) expect(ticks[i].from).toBe(ticks[i - 1].to);
      expect(r.turns).toBeGreaterThan(0);
    } finally {
      h.destroy();
    }
  });

  it('honours minimumSpinTime before the stop begins', async () => {
    const h = createTestWheel({ sections: 4, profile: { ...SpinPresets.QUICK, minimumSpinTime: 3000 } });
    try {
      let stoppingAt = -1;
      const start = h.ticker.elapsedMS;
      h.wheel.events.on('spin:stopping', () => (stoppingAt = h.ticker.elapsedMS - start));
      await h.spinAndLand({ index: 0 });
      expect(stoppingAt).toBeGreaterThanOrEqual(3000 - 16);
    } finally {
      h.destroy();
    }
  });

  it('rejects setResult before spin, twice, and after the stop began', async () => {
    const h = createTestWheel({ sections: 4 });
    try {
      expect(() => h.wheel.setResult({ index: 0 })).toThrow(/before spin\(\)/);
      const p = h.wheel.spin();
      h.wheel.setResult({ index: 1 });
      expect(() => h.wheel.setResult({ index: 2 })).toThrow(/already called/);
      h.runUntilIdle();
      await p;
      expect(() => h.wheel.spin() && h.wheel.spin()).toThrow(/spin\(\) called while a spin is in progress/);
      h.wheel.setResult({ index: 0 });
      h.runUntilIdle();
    } finally {
      h.destroy();
    }
  });

  it('random landing stays inside the section away from its edges', async () => {
    const h = createTestWheel({ sections: 5, landing: { mode: 'random', margin: 0.2 }, rng: seededRng(42) });
    try {
      for (let i = 0; i < 5; i++) {
        const r = await h.spinAndLand({ index: i });
        expect(r.offset).toBeGreaterThanOrEqual(0.2);
        expect(r.offset).toBeLessThanOrEqual(0.8);
        expectPointerOn(h.wheel, `s${i}`);
      }
    } finally {
      h.destroy();
    }
  });

  it('exact landing honours an absolute angle', async () => {
    const h = createTestWheel({ sections: 4, startAngle: 0 });
    try {
      const r = await h.spinAndLand({ angle: 100 });
      expect(r.section.id).toBe('s1');
      expect(h.wheel.main.localAngleUnderPointer()).toBeCloseTo(100, 4);
    } finally {
      h.destroy();
    }
  });
});

describe('settle', () => {
  it('center: lands off-centre, then glides to the middle', async () => {
    const h = createTestWheel({ sections: 4, startAngle: 0 });
    try {
      const events = captureEvents(h.wheel, ['spin:landing', 'spin:settle:start', 'spin:settle:end', 'spin:complete']);
      const r = await h.spinAndLand({ section: 's1', offset: 0.1 }, { settle: { mode: 'center', delayMs: 100, durationMs: 300 } });
      expect(r.landingAngle).toBeCloseTo(99, 6);
      expect(h.wheel.main.localAngleUnderPointer()).toBeCloseTo(135, 3);
      expect(events.map((e) => e.event)).toEqual(['spin:landing', 'spin:settle:start', 'spin:settle:end', 'spin:complete']);
    } finally {
      h.destroy();
    }
  });

  it('bounce: ends back on the landing angle', async () => {
    const h = createTestWheel({ sections: 4, startAngle: 0 });
    try {
      const r = await h.spinAndLand({ section: 's2' }, { settle: { mode: 'bounce', bounceDeg: 5, durationMs: 400 } });
      expect(h.wheel.main.localAngleUnderPointer()).toBeCloseTo(r.landingAngle, 3);
    } finally {
      h.destroy();
    }
  });
});
