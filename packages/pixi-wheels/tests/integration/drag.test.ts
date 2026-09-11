import { describe, expect, it } from 'vitest';
import { createTestWheel } from '../../src/testing/testHarness.js';
import { DEG_TO_RAD } from '../../src/utils/angles.js';

describe('flap drag', () => {
  it('holds the ring back against a climbing peg and lets go over the crown', () => {
    const h = createTestWheel({ sections: 8, startAngle: 0, pointers: [{ angle: -90, flap: { drag: 1 } }] });
    try {
      const ring = h.wheel.main;
      const pegs = ring.pegs!;
      // The hold can never exceed the contact arc: half a tip plus a peg.
      const maxHold = ((pegs.size + 14 / 2) / pegs.radius) * (180 / Math.PI);
      let mostHeld = 0;
      let released = false;
      void h.wheel.spin();
      h.wheel.setResult({ section: 's3' });
      while (h.wheel.isSpinning) {
        h.ticker.tick(16);
        const held = Math.abs(ring.dragDeg);
        mostHeld = Math.max(mostHeld, held);
        if (mostHeld > 0 && held === 0) released = true;
        // A hold is bounded by the geometry, never an arbitrary jump.
        expect(held).toBeLessThanOrEqual(maxHold + 1e-9);
      }
      expect(mostHeld).toBeGreaterThan(0.2);
      expect(released).toBe(true);
    } finally {
      h.destroy();
    }
  });

  it('always relaxes to zero, so the wheel rests drawn exactly on its result', async () => {
    const h = createTestWheel({ sections: 12, startAngle: 0, pointers: [{ angle: -90, flap: { drag: 1, dragRelease: 6 } }] });
    try {
      const ring = h.wheel.main;
      const spin = h.wheel.spin();
      h.wheel.setResult({ section: 's7' });
      while (h.wheel.isSpinning) h.ticker.tick(16);
      const result = await spin;
      expect(result.section.id).toBe('s7');
      for (let i = 0; i < 120; i++) h.ticker.tick(16);
      expect(ring.dragDeg).toBe(0);
      expect(ring.visualRotationDeg).toBe(ring.rotationDeg);
      expect(ring.disc.rotation).toBeCloseTo(ring.rotationDeg * DEG_TO_RAD, 10);
      expect(ring.sectionUnderPointer().id).toBe('s7');
    } finally {
      h.destroy();
    }
  });

  it('is off by default and costs a rigid pointer nothing', () => {
    const h = createTestWheel({ sections: 8, startAngle: 0 });
    try {
      const ring = h.wheel.main;
      void h.wheel.spin();
      h.wheel.setResult({ index: 2 });
      while (h.wheel.isSpinning) {
        h.ticker.tick(16);
        expect(ring.dragDeg).toBe(0);
      }
      expect(ring.visualRotationDeg).toBe(ring.rotationDeg);
    } finally {
      h.destroy();
    }
  });
});
