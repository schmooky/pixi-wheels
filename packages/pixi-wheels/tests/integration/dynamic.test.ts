import { describe, it, expect } from 'vitest';
import { captureEvents, createTestWheel } from '../../src/testing/testHarness.js';

describe('dynamic sections', () => {
  it('setWeights animates the boundaries and reports when done', async () => {
    const h = createTestWheel({ sections: [{ id: 'red' }, { id: 'green' }] });
    try {
      const log = captureEvents(h.wheel, ['sections:transition:start', 'sections:transition:end', 'sections:changed']);
      const done = h.wheel.setWeights({ red: 3 }, { durationMs: 500 });
      h.advance(250);
      const mid = h.wheel.geometry.byId('red').arc;
      expect(mid).toBeGreaterThan(180);
      expect(mid).toBeLessThan(270);
      h.advance(300);
      await done;
      expect(h.wheel.geometry.byId('red').arc).toBeCloseTo(270, 6);
      expect(log.map((e) => e.event)).toEqual(['sections:transition:start', 'sections:transition:end', 'sections:changed']);
    } finally {
      h.destroy();
    }
  });

  it('steps from the builder config apply in order and wrap', async () => {
    const h = createTestWheel({
      sections: [{ id: 'red' }, { id: 'green' }],
      dynamic: { steps: [{ red: 1, green: 1 }, { red: 3, green: 1 }, { red: 1, green: 3 }], durationMs: 0 },
    });
    try {
      expect(h.wheel.step).toBe(0);
      await h.wheel.setStep(1);
      expect(h.wheel.geometry.byId('red').arc).toBe(270);
      await h.wheel.nextStep();
      expect(h.wheel.step).toBe(2);
      expect(h.wheel.geometry.byId('green').arc).toBe(270);
      await h.wheel.nextStep();
      expect(h.wheel.step).toBe(0);
      expect(() => h.wheel.setStep(7)).toThrow(/out of range/);
    } finally {
      h.destroy();
    }
  });

  it('a weight change during a spin does not move the planned landing', async () => {
    const h = createTestWheel({ sections: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }], startAngle: 0 });
    try {
      const p = h.wheel.spin();
      h.wheel.setResult({ section: 'c' });
      h.advance(800);
      void h.wheel.setWeights({ a: 2 }, { durationMs: 0 });
      h.runUntilIdle();
      const r = await p;
      // Landing angle was fixed at setResult time; the section under the pointer is whatever now covers it.
      expect(h.wheel.main.localAngleUnderPointer()).toBeCloseTo(r.landingAngle, 4);
    } finally {
      h.destroy();
    }
  });

  it('rejects unknown ids and non-positive weights before animating', () => {
    const h = createTestWheel({ sections: 3 });
    try {
      expect(() => h.wheel.setWeights({ nope: 1 })).toThrow(/unknown section "nope"/);
      expect(() => h.wheel.setWeights({ s0: 0 })).toThrow(/> 0/);
    } finally {
      h.destroy();
    }
  });
});
