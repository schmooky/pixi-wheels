import { describe, expect, it } from 'vitest';
import type { Ticker } from 'pixi.js';
import { WheelBuilder } from '../../src/core/WheelBuilder.js';
import { FakeTicker } from '../../src/testing/FakeTicker.js';
import { createTestWheel } from '../../src/testing/testHarness.js';

describe('pegs', () => {
  it('every ring has pegs on its dividers by default, and they follow dynamic sections', async () => {
    const h = createTestWheel({ sections: 4, startAngle: 0 });
    try {
      const pegs = h.wheel.main.pegs!;
      expect(pegs.size).toBe(6);
      expect(pegs.radius).toBe(200 - 9);
      expect([...pegs.angles]).toEqual([0, 90, 180, 270]);
      await h.wheel.main.setWeights({ s0: 3 }, { durationMs: 0 });
      expect([...h.wheel.main.pegs!.angles]).toEqual(h.wheel.main.geometry.boundaries());
      expect(h.wheel.main.pegs!.angles[1]).toBeCloseTo(180, 6);
    } finally {
      h.destroy();
    }
  });

  it('the tongue rides the pegs during a spin and comes to rest with the wheel', async () => {
    const h = createTestWheel({ sections: 8, startAngle: 0 });
    try {
      const tongue = h.wheel.main.pointers[0];
      let peak = 0;
      let rode = false;
      void h.wheel.spin();
      h.wheel.setResult({ section: 's3' });
      while (h.wheel.isSpinning) {
        h.ticker.tick(16);
        peak = Math.max(peak, Math.abs(tongue.deflection));
        if (tongue.engagedPeg !== null) rode = true;
      }
      expect(peak).toBeGreaterThan(5);
      expect(rode).toBe(true);
      for (let i = 0; i < 200; i++) h.ticker.tick(16);
      expect(tongue.deflection).toBe(0);
      expect(tongue.engagedPeg).toBeNull();
    } finally {
      h.destroy();
    }
  });

  it('pegs(false) leaves the tongue still, and pegs round-trip through the config', () => {
    const ticker = new FakeTicker() as unknown as Ticker;
    // Config-shaped skins, so the wheel round-trips through toConfig() / fromConfig().
    const build = (b: WheelBuilder) => b.radius(200).sections(Array.from({ length: 4 }, (_, i) => ({ id: `s${i}` }))).skin({ type: 'headless' }).ticker(ticker);
    const none = build(new WheelBuilder().pegs(false)).build();
    try {
      expect(none.main.pegs).toBeNull();
      void none.spin();
      none.setResult({ index: 2 });
      for (let i = 0; i < 400; i++) none.main.update(16);
      expect(none.main.pointers[0].deflection).toBe(0);
    } finally {
      none.destroy();
    }
    const custom = build(new WheelBuilder().pegs({ size: 9, inset: 14, angles: [10, 100] }));
    const cfg = custom.toConfig();
    expect(cfg.rings[0].pegs).toEqual({ size: 9, inset: 14, angles: [10, 100] });
    const rebuilt = WheelBuilder.fromConfig(cfg, { ticker }).build();
    try {
      expect(rebuilt.main.pegs).toEqual({ size: 9, radius: 186, angles: [10, 100] });
    } finally {
      rebuilt.destroy();
    }
    const off = build(new WheelBuilder().pegs(false)).toConfig();
    expect(off.rings[0].pegs).toBe(false);
  });
});
