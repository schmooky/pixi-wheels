import type { Wheel, WheelTarget } from 'pixi-wheels';

export interface MockWheelServerOptions {
  /** Odds per section id. Unlisted sections get weight 1. */
  odds?: Record<string, number>;
  /** Network latency to simulate, ms. Default 350. */
  latencyMs?: number;
  /** Random source. Default Math.random. */
  rng?: () => number;
}

/**
 * A stand-in for the game server: picks a section by odds (NOT by arc, the
 * way a real backend decides independently of the art) and answers after a
 * delay. Recipes call it between `spin()` and `setResult()` so the demos
 * show the real round trip.
 */
export function mockWheelServer(wheel: Wheel, options: MockWheelServerOptions = {}) {
  const rng = options.rng ?? Math.random;
  const latency = options.latencyMs ?? 350;
  return {
    async spin(ring?: string): Promise<{ sectionId: string; value: number | string | undefined; index: number }> {
      const sections = (ring ? wheel.ring(ring) : wheel.main).sections;
      const weights = sections.map((s) => options.odds?.[s.id] ?? 1);
      const total = weights.reduce((a, b) => a + b, 0);
      let r = rng() * total;
      let pick = sections[sections.length - 1];
      for (let i = 0; i < sections.length; i++) {
        r -= weights[i];
        if (r <= 0) {
          pick = sections[i];
          break;
        }
      }
      await new Promise((res) => setTimeout(res, latency));
      return { sectionId: pick.id, value: pick.value, index: pick.index };
    },
  };
}

/** Uniformly random target among a wheel's sections. */
export function randomTarget(wheel: Wheel, ring?: string, rng: () => number = Math.random): WheelTarget {
  const sections = (ring ? wheel.ring(ring) : wheel.main).sections;
  return { index: Math.min(sections.length - 1, Math.floor(rng() * sections.length)) };
}
