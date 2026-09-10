import { describe, it, expect } from 'vitest';
import { SpinPresets } from '../../src/config/SpinPresets.js';
import { defaultOvershootDeg, defaultReturnMs, pickTurns, planSettle, planSkip, planStop } from '../../src/spin/StopPlanner.js';
import { resolveEase } from '../../src/utils/easing.js';

const profile = SpinPresets.NORMAL;

function simulate(plan: ReturnType<typeof planStop>, rotation: number, direction: 'cw' | 'ccw') {
  const sign = direction === 'cw' ? 1 : -1;
  let rot = rotation;
  for (const leg of plan.legs) rot += (leg.reverse ? -1 : 1) * sign * leg.distance;
  return rot;
}

describe('planStop', () => {
  it('lands exactly on the landing rotation and makes at least minTurns turns', () => {
    const plan = planStop({ rotation: 33, speed: 540, direction: 'cw', landingRotation: 200, profile });
    const end = simulate(plan, 33, 'cw');
    expect(((end % 360) + 360) % 360).toBeCloseTo(200, 6);
    expect(plan.turns).toBeGreaterThanOrEqual(profile.minTurns);
    expect(plan.legs).toHaveLength(1);
    expect(plan.legs[0].landsAtEnd).toBe(true);
  });

  it('works counter-clockwise', () => {
    const plan = planStop({ rotation: 33, speed: 540, direction: 'ccw', landingRotation: 200, profile });
    const end = simulate(plan, 33, 'ccw');
    expect(((end % 360) + 360) % 360).toBeCloseTo(200, 6);
  });

  it('matches the cruise speed at the start of the deceleration', () => {
    const speed = 540;
    const plan = planStop({ rotation: 0, speed, direction: 'cw', landingRotation: 90, profile });
    const leg = plan.legs[0];
    const h = 1e-4;
    const initialSpeed = ((leg.ease(h) - leg.ease(0)) / h) * (leg.distance / (leg.duration / 1000));
    expect(initialSpeed / speed).toBeCloseTo(1, 2);
  });

  it('picks the turn count whose duration is closest to stopDuration', () => {
    const slope = 4; // power3.out
    const pick = pickTurns(90, slope, 540, { ...profile, stopDuration: 4200, minTurns: 0, maxTurns: 20 });
    // duration = D * 4 / 540 s; 4.2 s => D = 567 => ~1.3 turns => k = 1 (450 deg, 3.33 s) or k = 2 (810 deg, 6 s)
    expect(pick.turns).toBe(1);
    const far = pickTurns(90, slope, 540, { ...profile, stopDuration: 6000, minTurns: 0, maxTurns: 20 });
    expect(far.turns).toBe(2);
  });

  it('clamps turns to [minTurns, maxTurns]', () => {
    const pick = pickTurns(0, 4, 540, { ...profile, stopDuration: 100, minTurns: 3, maxTurns: 5 });
    expect(pick.turns).toBe(3);
    const many = pickTurns(0, 4, 540, { ...profile, stopDuration: 60_000, minTurns: 1, maxTurns: 4 });
    expect(many.turns).toBe(4);
  });

  it('creep: decelerates to the creep speed at the bait entry and lands after the crawl', () => {
    const plan = planStop({
      rotation: 0,
      speed: 540,
      direction: 'cw',
      landingRotation: 100,
      profile,
      anticipation: {
        style: 'creep',
        baitId: 'bait',
        baitEntryRotation: 40, // 60 deg before landing
        baitExitRotation: 80,
        baitArc: 40,
        creepSpeed: 40,
        dwellMs: 700,
        pushMs: 900,
        overshootDeg: 6,
        returnMs: 800,
      },
    });
    expect(plan.anticipation).toBe('creep');
    expect(plan.legs.map((l) => l.kind)).toEqual(['decel', 'creep']);
    expect(plan.legs[0].endSpeed).toBe(40);
    expect(plan.legs[1].distance).toBeCloseTo(60, 6);
    expect(plan.legs[1].baitAtStart).toBe(true);
    const end = simulate(plan, 0, 'cw');
    expect(((end % 360) + 360) % 360).toBeCloseTo(100, 6);
  });

  it('stutter: halts inside the bait, dwells, then pushes over the line', () => {
    const plan = planStop({
      rotation: 0,
      speed: 540,
      direction: 'cw',
      landingRotation: 100,
      profile,
      anticipation: {
        style: 'stutter',
        baitId: 'bait',
        baitEntryRotation: 40,
        baitExitRotation: 90,
        baitArc: 50,
        creepSpeed: 40,
        dwellMs: 500,
        pushMs: 800,
        overshootDeg: 6,
        returnMs: 800,
      },
    });
    expect(plan.legs.map((l) => l.kind)).toEqual(['decel', 'dwell', 'push']);
    expect(plan.legs[1].duration).toBe(500);
    // halt 5 deg before exit (90) => at 85; push covers 85 -> 100 = 15 deg
    expect(plan.legs[2].distance).toBeCloseTo(15, 6);
    expect(simulate(plan, 0, 'cw') % 360).toBeCloseTo(100, 6);
  });

  it('overshoot: passes the landing, dwells in the bait, rolls back', () => {
    const plan = planStop({
      rotation: 0,
      speed: 540,
      direction: 'cw',
      landingRotation: 100,
      profile,
      anticipation: {
        style: 'overshoot',
        baitId: 'bait',
        baitEntryRotation: 120, // just after the landing
        baitExitRotation: 160,
        baitArc: 40,
        creepSpeed: 40,
        dwellMs: 600,
        pushMs: 800,
        overshootDeg: 6,
        returnMs: 700,
      },
    });
    expect(plan.legs.map((l) => l.kind)).toEqual(['decel', 'dwell', 'return']);
    expect(plan.legs[2].reverse).toBe(true);
    expect(plan.legs[2].distance).toBeCloseTo(26, 6); // 20 to the bait entry + 6 overshoot
    expect(plan.legs[2].duration).toBe(700);
    expect(simulate(plan, 0, 'cw') % 360).toBeCloseTo(100, 6);
  });

  it('overshoot defaults: only slightly over the line, and a roll back that scales with the distance', () => {
    const plan = planStop({
      rotation: 0,
      speed: 540,
      direction: 'cw',
      landingRotation: 100,
      profile,
      anticipation: {
        style: 'overshoot',
        baitId: 'bait',
        baitEntryRotation: 106.6, // the landing rests 6.6 deg inside a 30 deg target
        baitExitRotation: 136.6,
        baitArc: 30,
        creepSpeed: 40,
        dwellMs: 180,
        pushMs: 700,
      },
    });
    const ret = plan.legs[2];
    // a fifth of a 30 deg bait is 6, capped to 5
    expect(defaultOvershootDeg(30)).toBe(5);
    expect(defaultOvershootDeg(60)).toBe(5);
    expect(defaultOvershootDeg(10)).toBe(2);
    expect(ret.distance).toBeCloseTo(6.6 + 5, 6);
    expect(ret.duration).toBeCloseTo(defaultReturnMs(11.6), 6);
    expect(defaultReturnMs(11.6)).toBeCloseTo(814, 6);
    expect(defaultReturnMs(1)).toBe(450);
    expect(defaultReturnMs(40)).toBe(1200);
    expect(plan.legs[1].duration).toBe(180);
    expect(simulate(plan, 0, 'cw') % 360).toBeCloseTo(100, 6);
  });
});

describe('planSkip', () => {
  it('takes the forward path, at least a third of a turn', () => {
    const near = planSkip({ rotation: 0, direction: 'cw', landingRotation: 30, duration: 400 });
    expect(near.distance).toBe(390);
    const far = planSkip({ rotation: 0, direction: 'cw', landingRotation: 250, duration: 400 });
    expect(far.distance).toBe(250);
    expect(far.landsAtEnd).toBe(true);
  });
});

describe('planSettle', () => {
  const base = { mode: 'center' as const, delayMs: 200, durationMs: 500, ease: 'sine.inOut', bounceDeg: 4 };
  it('center glides the short way, forwards or back', () => {
    const fwd = planSettle(100, 110, base, 'cw');
    expect(fwd.map((l) => l.kind)).toEqual(['dwell', 'settle']);
    expect(fwd[1].reverse).toBe(false);
    expect(fwd[1].distance).toBeCloseTo(10, 6);
    const back = planSettle(100, 92, base, 'cw');
    expect(back[1].reverse).toBe(true);
    expect(back[1].distance).toBeCloseTo(8, 6);
    expect(planSettle(100, 100, base, 'cw')).toEqual([]);
  });

  it('bounce goes out and comes back the same distance', () => {
    const legs = planSettle(100, 100, { ...base, mode: 'bounce' }, 'cw');
    expect(legs.map((l) => l.kind)).toEqual(['bounce', 'bounce-return']);
    expect(legs[0].distance).toBe(legs[1].distance);
    expect(legs[1].reverse).toBe(true);
  });

  it('none adds nothing', () => {
    expect(planSettle(1, 2, { ...base, mode: 'none' }, 'cw')).toEqual([]);
    void resolveEase;
  });
});
