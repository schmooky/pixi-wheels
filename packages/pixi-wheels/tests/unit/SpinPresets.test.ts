import { describe, expect, it } from 'vitest';
import { SpinPresets } from '../../src/config/SpinPresets.js';
import { pickTurns } from '../../src/spin/StopPlanner.js';
import { plannerSlope, resolveEase } from '../../src/utils/easing.js';

/**
 * A stop leg whose ease starts at the cruise speed lasts
 * `distance * slope / speed`; the planner can only choose among whole turns.
 * A preset that asks for a duration outside its turn range silently gets
 * the nearest turn count instead, which is how a "four-second stop" became
 * a nine-second demo. Hold every preset to a reachable stopDuration.
 */
describe('SpinPresets', () => {
  for (const [name, p] of Object.entries(SpinPresets)) {
    it(`${name}: stopDuration is reachable inside [minTurns, maxTurns]`, () => {
      const slope = plannerSlope(resolveEase(p.stopEase ?? 'power3.out'), String(p.stopEase));
      const seconds = (turns: number) => (turns * 360 * slope) / p.spinSpeed;
      const want = p.stopDuration / 1000;
      expect(seconds(p.minTurns)).toBeLessThanOrEqual(want + 1e-9);
      expect(seconds(p.maxTurns)).toBeGreaterThanOrEqual(want - 1e-9);
      // With an average base distance the planner lands within a turn's worth of the ask.
      const pick = pickTurns(180, slope, p.spinSpeed, p);
      expect(Math.abs(pick.duration - p.stopDuration)).toBeLessThan(seconds(1) * 1000 * 0.75);
    });
  }
});
