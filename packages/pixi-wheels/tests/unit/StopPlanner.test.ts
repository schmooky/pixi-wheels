import { describe, it, expect } from 'vitest';
import { SpinPresets } from '../../src/config/SpinPresets.js';
import { pickTurns, planSettle, planSkip, planStop } from '../../src/spin/StopPlanner.js';
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
        targetEntryRotation: 80,
        targetArc: 45,
        creepSpeed: 40,
        hesitateSpeed: 2,
        dwellMs: 600,
        pushMs: 700,
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

  it('stutter: crawls into the bait, all but stalls short of the line, slips over it without ever stopping', () => {
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
        targetEntryRotation: 90,
        targetArc: 45,
        creepSpeed: 40,
        hesitateSpeed: 2,
        dwellMs: 500,
        pushMs: 800,
      },
    });
    expect(plan.legs.map((l) => l.kind)).toEqual(['decel', 'creep', 'hesitate', 'push']);
    const [, crawl, hesitate, push] = plan.legs;
    // hesitation: 2 deg/s for 500 ms = 1 deg, ending 5 deg short of the line at 90
    expect(hesitate.duration).toBeCloseTo(500, 6);
    expect(hesitate.distance).toBeCloseTo(1, 6);
    expect(crawl.distance).toBeCloseTo(50 - 5 - 1, 6);
    expect(crawl.endSpeed).toBe(2);
    // push: the 5 deg to the line plus 10 deg to the landing
    expect(push.distance).toBeCloseTo(15, 6);
    expect(push.startSpeed).toBe(2);
    expect(push.landsAtEnd).toBe(true);
    // the wheel never stops before the rest and never reverses
    for (const l of plan.legs) {
      expect(l.reverse).toBe(false);
      if (!l.landsAtEnd) expect(l.endSpeed).toBeGreaterThan(0);
    }
    // the push ease takes over smoothly and is monotonic
    let prev = 0;
    for (let t = 0.05; t <= 1.0001; t += 0.05) {
      const v = push.ease(Math.min(1, t));
      expect(v).toBeGreaterThan(prev);
      prev = v;
    }
    expect(simulate(plan, 0, 'cw') % 360).toBeCloseTo(100, 6);
  });

  it('stall: crawls across the target toward the line and dies short of it, no reverse leg', () => {
    const plan = planStop({
      rotation: 0,
      speed: 540,
      direction: 'cw',
      landingRotation: 100,
      profile,
      anticipation: {
        style: 'stall',
        baitId: 'bait',
        baitEntryRotation: 106.75, // the line, 6.75 deg past the rest
        baitExitRotation: 151.75,
        baitArc: 45,
        targetEntryRotation: 61.75,
        targetArc: 45,
        creepSpeed: 40,
        hesitateSpeed: 2,
        dwellMs: 600,
        pushMs: 700,
      },
    });
    expect(plan.anticipation).toBe('stall');
    expect(plan.legs.map((l) => l.kind)).toEqual(['decel', 'creep']);
    const [decel, crawl] = plan.legs;
    expect(decel.endSpeed).toBe(40);
    // the crawl starts where the pointer enters the target: 100 - 61.75
    expect(crawl.distance).toBeCloseTo(38.25, 6);
    expect(crawl.duration).toBeCloseTo((2 * 38.25 / 40) * 1000, 6);
    expect(crawl.endSpeed).toBe(0);
    expect(crawl.baitAtStart).toBe(true);
    expect(crawl.landsAtEnd).toBe(true);
    expect(plan.legs.every((l) => !l.reverse)).toBe(true);
    expect(simulate(plan, 0, 'cw') % 360).toBeCloseTo(100, 6);
  });

  it('stall: approachDeg shortens the crawl, and it never exceeds the room inside the target', () => {
    const base = {
      rotation: 0,
      speed: 540,
      direction: 'cw' as const,
      landingRotation: 100,
      profile,
    };
    const anticipation = {
      style: 'stall' as const,
      baitId: 'bait',
      baitEntryRotation: 106.75,
      baitExitRotation: 151.75,
      baitArc: 45,
      targetEntryRotation: 61.75,
      targetArc: 45,
      creepSpeed: 40,
      hesitateSpeed: 2,
      dwellMs: 600,
      pushMs: 700,
    };
    expect(planStop({ ...base, anticipation: { ...anticipation, approachDeg: 20 } }).legs[1].distance).toBeCloseTo(20, 6);
    expect(planStop({ ...base, anticipation: { ...anticipation, approachDeg: 200 } }).legs[1].distance).toBeCloseTo(38.25, 6);
    // a wide target: the default crawl caps at 45 degrees
    const wide = planStop({ ...base, anticipation: { ...anticipation, targetEntryRotation: 0, targetArc: 120, baitEntryRotation: 118, baitExitRotation: 160 } });
    expect(wide.legs[1].distance).toBeCloseTo(45, 6);
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
