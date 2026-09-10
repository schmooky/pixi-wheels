import type { AnticipationStyle, SettleConfig, SpinDirection, SpinProfile } from '../config/types.js';
import { arcDelta, directionSign, normalizeDeg, signedDeg } from '../utils/angles.js';
import { constantAccelEase, hermiteStopEase, plannerSlope, resolveEase, type EaseFn } from '../utils/easing.js';

/** What one leg of a stop is for. Drives events and debug output; the motion is the same. */
export type StopLegKind =
  | 'decel'
  | 'creep'
  | 'hesitate'
  | 'push'
  | 'dwell'
  | 'skip'
  | 'settle'
  | 'bounce'
  | 'bounce-return';

/**
 * One piece of a planned stop: cover `distance` degrees in `duration` ms
 * along `ease`, forwards unless `reverse`. A plan is a list of these played
 * back to back, so anticipation, skip and settle are all the same machinery.
 */
export interface StopLeg {
  kind: StopLegKind;
  /** Degrees covered, always >= 0. */
  distance: number;
  /** Against the spin direction when true. */
  reverse: boolean;
  /** Milliseconds. `0` is allowed only for a zero-distance leg. */
  duration: number;
  ease: EaseFn;
  /** Angular speed (deg/s) at the start and end, as the planner intended. */
  startSpeed: number;
  endSpeed: number;
  /** The pointer is on the landing angle when this leg ends. */
  landsAtEnd?: boolean;
  /** The pointer is at the bait when this leg begins. */
  baitAtStart?: boolean;
}

export interface StopPlan {
  legs: StopLeg[];
  /** Sum of leg durations, ms. */
  totalDuration: number;
  /** Rotation applied over the whole plan, signed by the spin direction. */
  netRotation: number;
  /** Full turns the deceleration makes before landing. */
  turns: number;
  anticipation: Exclude<AnticipationStyle, 'auto'> | null;
}

/** A bait with its geometry resolved against the ring. Built by the ring, consumed here. */
export interface ResolvedAnticipation {
  style: Exclude<AnticipationStyle, 'auto'>;
  baitId: string;
  /** Normalised rotation at which the pointer meets the bait's entry edge. */
  baitEntryRotation: number;
  /** Normalised rotation at which the pointer meets the bait's exit edge. */
  baitExitRotation: number;
  baitArc: number;
  /** Normalised rotation at which the pointer meets the target's entry edge; `'stall'` crawls from there. */
  targetEntryRotation: number;
  targetArc: number;
  creepSpeed: number;
  hesitateSpeed: number;
  dwellMs: number;
  pushMs: number;
  /** `'stall'`: crawl length before the rest, degrees. Undefined: the target's arc, at most 45. */
  approachDeg?: number;
}

export interface PlanStopInput {
  /** Current rotation, any range. */
  rotation: number;
  /** Current angular speed magnitude, deg/s. */
  speed: number;
  direction: SpinDirection;
  /** Normalised rotation at which the pointer sits on the landing angle. */
  landingRotation: number;
  profile: SpinProfile;
  anticipation?: ResolvedAnticipation | null;
}

const LINEAR: EaseFn = (t) => t;

/**
 * Choose how many full turns a stop should make.
 *
 * With the ease's start slope matched to the cruise speed, the duration is
 * fixed by the distance: `T = D * slope / v`. So the planner cannot pick a
 * duration directly; it picks the turn count whose duration lands closest
 * to the profile's `stopDuration`, within `[minTurns, maxTurns]`.
 */
export function pickTurns(
  base: number,
  slope: number,
  speed: number,
  profile: SpinProfile,
): { turns: number; distance: number; duration: number } {
  const minTurns = Math.max(0, Math.floor(profile.minTurns));
  const maxTurns = Math.max(minTurns, Math.floor(profile.maxTurns));
  let best: { turns: number; distance: number; duration: number } | null = null;
  for (let k = minTurns; k <= maxTurns; k++) {
    const distance = k * 360 + base;
    if (distance <= 0) continue;
    const duration = ((distance * slope) / speed) * 1000;
    if (!best || Math.abs(duration - profile.stopDuration) < Math.abs(best.duration - profile.stopDuration)) {
      best = { turns: k, distance, duration };
    }
  }
  if (!best) {
    // Every candidate had a non-positive distance: base was negative and
    // maxTurns is 0. One turn is the least surprising answer.
    const distance = 360 + base;
    return { turns: 1, distance, duration: ((distance * slope) / speed) * 1000 };
  }
  return best;
}

/**
 * Plan the deceleration from the current state to the landing rotation.
 *
 * The plain plan is one leg whose ease starts at the cruise speed, so the
 * hand-off from cruise is seamless. The three anticipation styles split it
 * into legs around the bait; see {@link AnticipationStyle}.
 */
export function planStop(input: PlanStopInput): StopPlan {
  const { direction, profile } = input;
  const speed = Math.max(input.speed, 1);
  const current = normalizeDeg(input.rotation);
  const landing = normalizeDeg(input.landingRotation);
  const delta = arcDelta(current, landing, direction);
  const easeLabel = typeof profile.stopEase === 'string' ? profile.stopEase : 'custom';
  const ease = resolveEase(profile.stopEase ?? 'power3.out');
  const slope = plannerSlope(ease, easeLabel);
  const a = input.anticipation ?? null;

  if (!a) {
    const pick = pickTurns(delta, slope, speed, profile);
    const leg: StopLeg = {
      kind: 'decel',
      distance: pick.distance,
      reverse: false,
      duration: pick.duration,
      ease,
      startSpeed: speed,
      endSpeed: 0,
      landsAtEnd: true,
    };
    return finish([leg], direction, null);
  }

  if (a.style === 'creep') {
    // Distance from the bait's entry edge to the landing, along the spin.
    const creepDist = arcDelta(a.baitEntryRotation, landing, direction);
    const creepSpeed = Math.max(1, Math.min(a.creepSpeed, speed * 0.5));
    // The fast leg ends where the creep begins. Never shorter than half a
    // turn, or the wheel would visibly brake the moment the result arrived.
    let base = delta - creepDist;
    while (base < 180) base += 360;
    const accelEase = constantAccelEase(speed, creepSpeed);
    const pick = pickTurnsForDuration(base, speed, creepSpeed, profile);
    const decel: StopLeg = {
      kind: 'decel',
      distance: pick.distance,
      reverse: false,
      duration: pick.duration,
      ease: accelEase,
      startSpeed: speed,
      endSpeed: creepSpeed,
    };
    const creep: StopLeg = {
      kind: 'creep',
      distance: creepDist,
      reverse: false,
      duration: ((2 * creepDist) / creepSpeed) * 1000,
      ease: constantAccelEase(creepSpeed, 0),
      startSpeed: creepSpeed,
      endSpeed: 0,
      baitAtStart: true,
      landsAtEnd: true,
    };
    return finish([decel, creep], direction, 'creep');
  }

  if (a.style === 'stutter') {
    // Crawl into the bait, all but stall a hair short of the line, slip over
    // it. The wheel keeps moving throughout: the only stop is the rest.
    const creepSpeed = Math.max(1, Math.min(a.creepSpeed, speed * 0.5));
    const hesitateSpeed = Math.max(0.25, Math.min(a.hesitateSpeed, creepSpeed * 0.5));
    const baitSpan = arcDelta(a.baitEntryRotation, a.baitExitRotation, direction);
    const inside = Math.min(5, baitSpan * 0.2);
    const hesitateDist = Math.min((hesitateSpeed * a.dwellMs) / 1000, Math.max(0, baitSpan - inside) * 0.5);
    const hesitateMs = (hesitateDist / hesitateSpeed) * 1000;
    const crawlDist = Math.max(0, baitSpan - inside - hesitateDist);
    const pushDist = inside + arcDelta(a.baitExitRotation, landing, direction);
    let base = delta - arcDelta(a.baitEntryRotation, landing, direction);
    while (base < 180) base += 360;
    const pick = pickTurnsForDuration(base, speed, creepSpeed, profile);
    const decel: StopLeg = {
      kind: 'decel',
      distance: pick.distance,
      reverse: false,
      duration: pick.duration,
      ease: constantAccelEase(speed, creepSpeed),
      startSpeed: speed,
      endSpeed: creepSpeed,
    };
    const crawl: StopLeg = {
      kind: 'creep',
      distance: crawlDist,
      reverse: false,
      duration: ((2 * crawlDist) / (creepSpeed + hesitateSpeed)) * 1000,
      ease: constantAccelEase(creepSpeed, hesitateSpeed),
      startSpeed: creepSpeed,
      endSpeed: hesitateSpeed,
      baitAtStart: true,
    };
    const hesitate: StopLeg = {
      kind: 'hesitate',
      distance: hesitateDist,
      reverse: false,
      duration: hesitateMs,
      ease: LINEAR,
      startSpeed: hesitateSpeed,
      endSpeed: hesitateSpeed,
    };
    const pushMs = Math.max(1, a.pushMs);
    const push: StopLeg = {
      kind: 'push',
      distance: pushDist,
      reverse: false,
      duration: pushMs,
      // Takes over at the hesitation speed and eases to rest: no step in velocity.
      ease: hermiteStopEase((hesitateSpeed * (pushMs / 1000)) / Math.max(1e-6, pushDist)),
      startSpeed: hesitateSpeed,
      endSpeed: 0,
      landsAtEnd: true,
    };
    return finish([decel, crawl, hesitate, push], direction, 'stutter');
  }

  // stall: the pointer enters the target, crawls toward the bait's line as if
  // it will cross, and dies just short of it. One deceleration, one stop.
  const creepSpeed = Math.max(1, Math.min(a.creepSpeed, speed * 0.5));
  const room = arcDelta(a.targetEntryRotation, landing, direction);
  const approach = Math.max(0.5, Math.min(a.approachDeg ?? Math.min(45, a.targetArc), room));
  let base = delta - approach;
  while (base < 180) base += 360;
  const pick = pickTurnsForDuration(base, speed, creepSpeed, profile);
  const decel: StopLeg = {
    kind: 'decel',
    distance: pick.distance,
    reverse: false,
    duration: pick.duration,
    ease: constantAccelEase(speed, creepSpeed),
    startSpeed: speed,
    endSpeed: creepSpeed,
  };
  const crawl: StopLeg = {
    kind: 'creep',
    distance: approach,
    reverse: false,
    duration: ((2 * approach) / creepSpeed) * 1000,
    ease: constantAccelEase(creepSpeed, 0),
    startSpeed: creepSpeed,
    endSpeed: 0,
    baitAtStart: true,
    landsAtEnd: true,
  };
  return finish([decel, crawl], direction, 'stall');
}

/**
 * Turn count for a constant-deceleration leg between two speeds, whose
 * duration is `2 * D / (v0 + v1)`.
 */
function pickTurnsForDuration(
  base: number,
  v0: number,
  v1: number,
  profile: SpinProfile,
): { turns: number; distance: number; duration: number } {
  const minTurns = Math.max(0, Math.floor(profile.minTurns));
  const maxTurns = Math.max(minTurns, Math.floor(profile.maxTurns));
  let best: { turns: number; distance: number; duration: number } | null = null;
  for (let k = minTurns; k <= maxTurns; k++) {
    const distance = k * 360 + base;
    if (distance <= 0) continue;
    const duration = ((2 * distance) / (v0 + v1)) * 1000;
    if (!best || Math.abs(duration - profile.stopDuration) < Math.abs(best.duration - profile.stopDuration)) {
      best = { turns: k, distance, duration };
    }
  }
  return best ?? { turns: 1, distance: 360 + base, duration: ((2 * (360 + base)) / (v0 + v1)) * 1000 };
}

function finish(
  legs: StopLeg[],
  direction: SpinDirection,
  anticipation: StopPlan['anticipation'],
): StopPlan {
  const sign = directionSign(direction);
  let net = 0;
  let forward = 0;
  for (const l of legs) {
    net += (l.reverse ? -1 : 1) * l.distance;
    if (!l.reverse) forward += l.distance;
  }
  return {
    legs,
    totalDuration: legs.reduce((s, l) => s + l.duration, 0),
    netRotation: sign * net,
    turns: Math.floor(forward / 360),
    anticipation,
  };
}

export interface PlanSkipInput {
  rotation: number;
  direction: SpinDirection;
  landingRotation: number;
  /** ms for the fast-forward. */
  duration: number;
}

/**
 * The fast-forward a skip plays: the shortest forward path to the landing,
 * padded to at least a third of a turn so a slam never reads as a snap.
 */
export function planSkip(input: PlanSkipInput): StopLeg {
  let distance = arcDelta(normalizeDeg(input.rotation), normalizeDeg(input.landingRotation), input.direction);
  if (distance < 120) distance += 360;
  const duration = Math.max(1, input.duration);
  return {
    kind: 'skip',
    distance,
    reverse: false,
    duration,
    ease: constantAccelEase(1, 0),
    startSpeed: (2 * distance * 1000) / duration,
    endSpeed: 0,
    landsAtEnd: true,
  };
}

/**
 * The legs a settle adds after landing. `center` glides the shortest way
 * to the section's middle; `bounce` overshoots and springs back.
 */
export function planSettle(
  landingRotation: number,
  centerRotation: number,
  settle: Required<SettleConfig>,
  direction: SpinDirection,
): StopLeg[] {
  if (settle.mode === 'none') return [];
  const ease = resolveEase(settle.ease);
  if (settle.mode === 'center') {
    const signed = signedDeg(centerRotation - landingRotation);
    const distance = Math.abs(signed);
    if (distance < 0.01) return [];
    const reverse = signed * directionSign(direction) < 0;
    const legs: StopLeg[] = [];
    if (settle.delayMs > 0) {
      legs.push({ kind: 'dwell', distance: 0, reverse: false, duration: settle.delayMs, ease: LINEAR, startSpeed: 0, endSpeed: 0 });
    }
    legs.push({ kind: 'settle', distance, reverse, duration: Math.max(1, settle.durationMs), ease, startSpeed: 0, endSpeed: 0 });
    return legs;
  }
  // bounce
  const out = Math.max(0.01, settle.bounceDeg);
  return [
    {
      kind: 'bounce',
      distance: out,
      reverse: false,
      duration: Math.max(1, settle.durationMs * 0.4),
      ease: resolveEase('sine.out'),
      startSpeed: 0,
      endSpeed: 0,
    },
    {
      kind: 'bounce-return',
      distance: out,
      reverse: true,
      duration: Math.max(1, settle.durationMs * 0.6),
      ease,
      startSpeed: 0,
      endSpeed: 0,
    },
  ];
}
