import type {
  AnticipationOptions,
  IdleConfig,
  LandingOptions,
  ResolvedSection,
  ResolvedTarget,
  SettleConfig,
  SkipConfig,
  SpinDirection,
  SpinOptions,
  SpinProfile,
  WheelSpinResult,
  WheelTarget,
} from '../config/types.js';
import { DEFAULT_LANDING, DEFAULT_SETTLE, DEFAULTS } from '../config/defaults.js';
import type { EventEmitter } from '../events/EventEmitter.js';
import type { WheelEvents } from '../events/WheelEvents.js';
import { RingGeometry, rotationForLocalAngle } from '../core/RingGeometry.js';
import { resolveTarget } from '../adapter/resolveTarget.js';
import { arcDelta, directionSign, normalizeDeg } from '../utils/angles.js';
import { resolveEase, type EaseFn } from '../utils/easing.js';
import { noticeWarn } from '../utils/notify.js';
import {
  planSettle,
  planSkip,
  planStop,
  type ResolvedAnticipation,
  type StopLeg,
} from './StopPlanner.js';

/** Where a ring is in its life. */
export type SpinState = 'idle' | 'idling' | 'starting' | 'cruising' | 'stopping' | 'settling';

/** What the controller needs from its ring. Kept as an interface so the controller is testable without PixiJS. */
export interface SpinHost {
  readonly ringId: string;
  readonly events: EventEmitter<WheelEvents>;
  readonly geometry: RingGeometry;
  readonly direction: SpinDirection;
  /** Screen angle of the pointer results are read against. */
  readonly pointerAngle: number;
  readonly rng: () => number;
  readonly profile: SpinProfile;
  readonly landingDefaults: LandingOptions;
  readonly skipConfig: Required<SkipConfig>;
  getRotation(): number;
  setRotation(deg: number): void;
}

/**
 * The spin state machine of one ring.
 *
 * ```
 * spin() -> starting -> cruising -> [setResult] -> stopping -> [settling] -> idle
 *                                                     ^ anticipation legs live here
 * ```
 *
 * Rotation is integrated from a signed angular speed while starting and
 * cruising, then driven by planned legs (see `StopPlanner`) once a result is
 * in. Everything is a function of the ticker's `deltaMS`, so a fake ticker
 * reproduces a spin frame for frame.
 */
export class SpinController {
  private _state: SpinState = 'idle';
  private _direction: SpinDirection;
  private _speed = 0; // signed, deg/s
  private _elapsedMs = 0;
  private _cruiseMs = 0;
  private _startMs = 0;
  private _spinStartRotation = 0;
  private _accelFrom = 0;
  private _accelEase: EaseFn = (t) => t;
  private _target: ResolvedTarget | null = null;
  private _landing: Required<Pick<LandingOptions, 'mode' | 'margin'>> & { settle: Required<SettleConfig>; anticipation: AnticipationOptions | null } | null = null;
  private _anticipation: ResolvedAnticipation | null = null;
  private _protectSkip = false;
  private _protectionSpent = false;
  private _legs: StopLeg[] = [];
  private _legIndex = 0;
  private _legMs = 0;
  private _legStartRotation = 0;
  private _landed = false;
  private _wasSkipped = false;
  private _skipQueued = false;
  private _resultTimeoutMs: number | null = null;
  private _resolve: ((r: WheelSpinResult) => void) | null = null;
  private _reject: ((e: Error) => void) | null = null;
  private _idle: Required<IdleConfig> | null = null;
  private _idleWanted = false;
  private _idleTargetSpeed = 0;
  private _lastFrameSpeed = 0;

  constructor(private readonly _host: SpinHost) {
    this._direction = _host.direction;
  }

  get state(): SpinState {
    return this._state;
  }

  /** The direction of the current or last spin. */
  get direction(): SpinDirection {
    return this._direction;
  }

  /** Signed angular speed, deg/s, as of the last frame. */
  get speed(): number {
    return this._lastFrameSpeed;
  }

  get isSpinning(): boolean {
    return this._state !== 'idle' && this._state !== 'idling';
  }

  get target(): ResolvedTarget | null {
    return this._target;
  }

  get isIdling(): boolean {
    return this._state === 'idling';
  }

  /** The planned legs, for the debug snapshot. Empty until the stop is planned. */
  get legs(): readonly StopLeg[] {
    return this._legs;
  }

  get currentLegIndex(): number {
    return this._legIndex;
  }

  // ── Spin lifecycle ──────────────────────────────────────────────────────

  spin(options: SpinOptions = {}): Promise<WheelSpinResult> {
    if (this.isSpinning) {
      throw new Error(
        `Ring "${this._host.ringId}": spin() called while a spin is in progress (state "${this._state}"). ` +
          'Await the previous spin, or skip() it first.',
      );
    }
    const fromIdle = this._state === 'idling';
    this._direction = options.direction ?? this._host.direction;
    this._resultTimeoutMs = options.resultTimeoutMs ?? null;
    this._target = null;
    this._landing = null;
    this._anticipation = null;
    this._protectSkip = false;
    this._protectionSpent = false;
    this._legs = [];
    this._legIndex = 0;
    this._legMs = 0;
    this._landed = false;
    this._wasSkipped = false;
    this._skipQueued = false;
    this._elapsedMs = 0;
    this._cruiseMs = 0;
    this._startMs = 0;
    this._spinStartRotation = this._host.getRotation();
    this._accelFrom = this._speed;
    this._accelEase = resolveEase(this._host.profile.accelerationEase ?? 'power2.in');
    this._state = 'starting';
    const promise = new Promise<WheelSpinResult>((resolve, reject) => {
      this._resolve = resolve;
      this._reject = reject;
    });
    this._host.events.emit('spin:start', { ring: this._host.ringId, fromIdle, direction: this._direction });
    return promise;
  }

  /**
   * Decide where this spin lands. Allowed once per spin, while the ring is
   * starting or cruising.
   */
  setResult(target: WheelTarget, landing: LandingOptions = {}): ResolvedTarget {
    if (this._state === 'idle' || this._state === 'idling') {
      throw new Error(`Ring "${this._host.ringId}": setResult() before spin(). Call spin() first.`);
    }
    if (this._target) {
      throw new Error(`Ring "${this._host.ringId}": setResult() was already called for this spin.`);
    }
    if (this._state === 'stopping' || this._state === 'settling') {
      throw new Error(`Ring "${this._host.ringId}": setResult() after the stop began.`);
    }
    const defaults = this._host.landingDefaults;
    const mode = landing.mode ?? defaults.mode ?? DEFAULT_LANDING.mode;
    const margin = landing.margin ?? defaults.margin ?? DEFAULT_LANDING.margin;
    const resolved = resolveTarget(this._host.geometry, target, { mode, margin, rng: this._host.rng });
    const settleIn = landing.settle ?? defaults.settle ?? DEFAULT_SETTLE.mode;
    const settle: Required<SettleConfig> =
      typeof settleIn === 'string'
        ? { ...DEFAULT_SETTLE, mode: settleIn }
        : { ...DEFAULT_SETTLE, ...settleIn };
    const anticipation = landing.anticipation === undefined ? defaults.anticipation ?? null : landing.anticipation;
    this._target = resolved;
    this._landing = { mode, margin, settle, anticipation };
    this._anticipation = anticipation ? this._resolveAnticipation(anticipation, resolved) : null;
    this._protectSkip = this._anticipation
      ? anticipation?.protectSkip ?? this._host.skipConfig.protectAnticipation
      : false;
    this._host.events.emit('spin:resultSet', { ring: this._host.ringId, target: resolved });
    if (this._skipQueued) {
      this._skipQueued = false;
      this.skip();
    }
    return resolved;
  }

  /**
   * Land now-ish: a short fast-forward to the landing angle. Returns false
   * when nothing happened (skipping disabled, too early, no spin, or already
   * settling). Throws before `setResult()`: use `requestSkip()` to queue a
   * press made during the server round-trip.
   */
  skip(): boolean {
    const cfg = this._host.skipConfig;
    if (!cfg.allowed) return false;
    if (!this.isSpinning) return false;
    if (!this._target) {
      throw new Error(
        `Ring "${this._host.ringId}": skip() before setResult(). ` +
          'Call requestSkip() to queue the press until the result arrives.',
      );
    }
    if (this._elapsedMs < cfg.minimumSpinTime) return false;
    if (this._state === 'settling') return false;

    const landingRotation = this._landingRotation();
    if (this._state === 'stopping' && this._protectSkip && !this._protectionSpent && this._anticipation) {
      // First press: jump to the bait and let the tease play.
      const baitIndex = this._legs.findIndex((l) => l.baitAtStart);
      if (baitIndex > this._legIndex) {
        const rotation = this._host.getRotation();
        let baitStartRotation = this._legStartRotation;
        for (let i = this._legIndex; i < baitIndex; i++) {
          const l = this._legs[i];
          baitStartRotation += (l.reverse ? -1 : 1) * directionSign(this._direction) * l.distance;
        }
        const fast = planSkip({
          rotation,
          direction: this._direction,
          landingRotation: baitStartRotation,
          duration: this._host.profile.skipDuration,
        });
        fast.landsAtEnd = false;
        this._legs = [fast, ...this._legs.slice(baitIndex)];
        this._legIndex = 0;
        this._legMs = 0;
        this._legStartRotation = rotation;
        this._protectionSpent = true;
        this._host.events.emit('skip:requested', { ring: this._host.ringId, protectedByAnticipation: true });
        return true;
      }
    }

    const rotation = this._host.getRotation();
    const fast = planSkip({
      rotation,
      direction: this._direction,
      landingRotation,
      duration: this._host.profile.skipDuration,
    });
    this._legs = [fast, ...this._settleLegs(landingRotation)];
    this._legIndex = 0;
    this._legMs = 0;
    this._legStartRotation = rotation;
    this._wasSkipped = true;
    if (this._anticipation && this._state === 'stopping') {
      this._host.events.emit('anticipation:end', { ring: this._host.ringId, bait: this._host.geometry.byId(this._anticipation.baitId) });
      this._anticipation = null;
    }
    this._state = 'stopping';
    this._host.events.emit('skip:requested', { ring: this._host.ringId, protectedByAnticipation: false });
    return true;
  }

  /** `skip()` now if the result is in, otherwise the moment it arrives. */
  requestSkip(): void {
    if (!this.isSpinning) return;
    if (this._target) {
      this.skip();
      return;
    }
    this._skipQueued = true;
  }

  /**
   * Snap to the final position and complete synchronously. Ignores skip
   * protection and settle animation. This is what tests use.
   */
  slamStop(): void {
    if (!this.isSpinning) return;
    if (!this._target) {
      throw new Error(`Ring "${this._host.ringId}": slamStop() before setResult().`);
    }
    const landingRotation = this._landingRotation();
    const settle = this._landing!.settle;
    const finalRotation =
      settle.mode === 'center' ? rotationForLocalAngle(this._target.section.midAngle, this._host.pointerAngle) : landingRotation;
    if (this._anticipation && this._state === 'stopping') {
      this._host.events.emit('anticipation:end', { ring: this._host.ringId, bait: this._host.geometry.byId(this._anticipation.baitId) });
    }
    this._wasSkipped = true;
    this._host.events.emit('skip:requested', { ring: this._host.ringId, protectedByAnticipation: false });
    this._host.setRotation(landingRotation);
    this._onLanding();
    this._host.setRotation(finalRotation);
    this._host.events.emit('skip:completed', { ring: this._host.ringId });
    this._complete();
  }

  // ── Idle ────────────────────────────────────────────────────────────────

  startIdle(config: IdleConfig): void {
    const resolved: Required<IdleConfig> = {
      speed: config.speed,
      direction: config.direction ?? this._host.direction,
      autoStart: config.autoStart ?? false,
      rampMs: config.rampMs ?? DEFAULTS.idleRampMs,
    };
    if (!(resolved.speed > 0)) {
      throw new Error(`Ring "${this._host.ringId}": idle speed must be > 0, got ${String(config.speed)}.`);
    }
    this._idle = resolved;
    this._idleWanted = true;
    if (this.isSpinning) return; // resumes after the spin completes
    this._beginIdling();
  }

  stopIdle(): void {
    this._idleWanted = false;
    if (this._state === 'idling') {
      this._idleTargetSpeed = 0;
    }
  }

  private _beginIdling(): void {
    const idle = this._idle!;
    this._state = 'idling';
    this._idleTargetSpeed = directionSign(idle.direction) * idle.speed;
    this._host.events.emit('idle:start', { ring: this._host.ringId, speed: idle.speed, direction: idle.direction });
  }

  // ── Frame ───────────────────────────────────────────────────────────────

  /** Advance by `dtMs` milliseconds. */
  update(dtMs: number): void {
    const dt = Math.min(Math.max(dtMs, 0), 100) / 1000;
    if (dt <= 0) return;
    const before = this._host.getRotation();
    switch (this._state) {
      case 'idle':
        this._speed = 0;
        break;
      case 'idling':
        this._updateIdling(dt);
        break;
      case 'starting':
        this._updateStarting(dt);
        break;
      case 'cruising':
        this._updateCruising(dt);
        break;
      case 'stopping':
      case 'settling':
        this._updateLegs(dt);
        break;
    }
    const after = this._host.getRotation();
    this._lastFrameSpeed = (after - before) / dt;
  }

  private _updateIdling(dt: number): void {
    const idle = this._idle!;
    const rate = idle.speed / Math.max(0.001, idle.rampMs / 1000);
    const diff = this._idleTargetSpeed - this._speed;
    const step = rate * dt;
    this._speed = Math.abs(diff) <= step ? this._idleTargetSpeed : this._speed + Math.sign(diff) * step;
    this._host.setRotation(this._host.getRotation() + this._speed * dt);
    if (this._idleTargetSpeed === 0 && this._speed === 0) {
      this._state = 'idle';
      this._host.events.emit('idle:stop', { ring: this._host.ringId });
    }
  }

  private _updateStarting(dt: number): void {
    const profile = this._host.profile;
    this._elapsedMs += dt * 1000;
    this._startMs += dt * 1000;
    const cruise = directionSign(this._direction) * profile.spinSpeed;
    const accel = Math.max(1, profile.accelerationMs);
    const t = Math.min(1, this._startMs / accel);
    this._speed = this._accelFrom + (cruise - this._accelFrom) * this._accelEase(t);
    this._host.setRotation(this._host.getRotation() + this._speed * dt);
    if (t >= 1) {
      this._speed = cruise;
      this._state = 'cruising';
      this._host.events.emit('spin:cruise', { ring: this._host.ringId, speed: profile.spinSpeed });
      this._maybeBeginStop();
    }
  }

  private _updateCruising(dt: number): void {
    this._elapsedMs += dt * 1000;
    this._cruiseMs += dt * 1000;
    this._host.setRotation(this._host.getRotation() + this._speed * dt);
    if (this._resultTimeoutMs !== null && !this._target && this._cruiseMs >= this._resultTimeoutMs) {
      const err = new Error(
        `Ring "${this._host.ringId}": no result within ${this._resultTimeoutMs} ms of cruising. ` +
          'Landing on the current section.',
      );
      const reject = this._reject;
      this._resolve = null;
      this._reject = null;
      const local = normalizeDeg(this._host.pointerAngle - this._host.getRotation());
      const section = this._host.geometry.sectionAt(local);
      this.setResult({ section: section.id }, { anticipation: null });
      reject?.(err);
    }
    this._maybeBeginStop();
  }

  private _maybeBeginStop(): void {
    if (this._state !== 'cruising' || !this._target) return;
    const profile = this._host.profile;
    if (this._elapsedMs < profile.minimumSpinTime) return;
    if (this._cruiseMs < profile.minCruiseMs) return;
    this._beginStop();
  }

  private _beginStop(): void {
    const landingRotation = this._landingRotation();
    const plan = planStop({
      rotation: this._host.getRotation(),
      speed: Math.abs(this._speed),
      direction: this._direction,
      landingRotation,
      profile: this._host.profile,
      anticipation: this._anticipation,
    });
    this._legs = [...plan.legs, ...this._settleLegs(landingRotation)];
    this._legIndex = 0;
    this._legMs = 0;
    this._legStartRotation = this._host.getRotation();
    this._state = 'stopping';
    this._host.events.emit('spin:stopping', {
      ring: this._host.ringId,
      turns: plan.turns,
      duration: plan.totalDuration,
      anticipation: plan.anticipation,
    });
    if (this._anticipation) {
      this._host.events.emit('anticipation:start', {
        ring: this._host.ringId,
        bait: this._host.geometry.byId(this._anticipation.baitId),
        style: this._anticipation.style,
      });
    }
    this._enterLeg();
  }

  private _enterLeg(): void {
    const leg = this._legs[this._legIndex];
    if (!leg) return;
    if (leg.baitAtStart && this._anticipation) {
      this._host.events.emit('anticipation:bait', {
        ring: this._host.ringId,
        bait: this._host.geometry.byId(this._anticipation.baitId),
      });
    }
    if (this._landed && (leg.kind === 'settle' || leg.kind === 'bounce')) {
      this._state = 'settling';
      this._host.events.emit('spin:settle:start', {
        ring: this._host.ringId,
        mode: leg.kind === 'settle' ? 'center' : 'bounce',
      });
    }
  }

  private _updateLegs(dt: number): void {
    this._elapsedMs += dt * 1000;
    let remaining = dt * 1000;
    while (remaining > 0 && this._legIndex < this._legs.length) {
      const leg = this._legs[this._legIndex];
      const sign = (leg.reverse ? -1 : 1) * directionSign(this._direction);
      const step = Math.min(remaining, Math.max(0, leg.duration - this._legMs));
      this._legMs += step;
      remaining -= step;
      const p = leg.duration > 0 ? Math.min(1, this._legMs / leg.duration) : 1;
      this._host.setRotation(this._legStartRotation + sign * leg.ease(p) * leg.distance);
      if (p >= 1) {
        // Land exactly on the leg's end to keep floating point out of the geometry.
        this._legStartRotation = this._legStartRotation + sign * leg.distance;
        this._host.setRotation(this._legStartRotation);
        if (leg.kind === 'skip' && this._wasSkipped) {
          this._host.events.emit('skip:completed', { ring: this._host.ringId });
        }
        if (leg.landsAtEnd && !this._landed) this._onLanding();
        if (this._state === 'settling' && (leg.kind === 'settle' || leg.kind === 'bounce-return')) {
          this._host.events.emit('spin:settle:end', { ring: this._host.ringId });
        }
        this._legIndex++;
        this._legMs = 0;
        if (this._legIndex < this._legs.length) this._enterLeg();
      } else {
        break;
      }
    }
    if (this._legIndex >= this._legs.length) {
      if (!this._landed) this._onLanding();
      this._complete();
    }
  }

  private _onLanding(): void {
    this._landed = true;
    const target = this._target!;
    // The tease is over before the landing beat begins, so a listener can
    // stop its tension loop and start the reveal in that order.
    if (this._anticipation) {
      this._host.events.emit('anticipation:end', {
        ring: this._host.ringId,
        bait: this._host.geometry.byId(this._anticipation.baitId),
      });
      this._anticipation = null;
    }
    this._host.events.emit('spin:landing', {
      ring: this._host.ringId,
      section: target.section,
      landingAngle: target.landingAngle,
    });
  }

  private _complete(): void {
    const target = this._target!;
    const travelled = Math.abs(this._host.getRotation() - this._spinStartRotation);
    const result: WheelSpinResult = {
      ring: this._host.ringId,
      section: target.section,
      landingAngle: target.landingAngle,
      offset: target.offset,
      wasSkipped: this._wasSkipped,
      duration: Math.round(this._elapsedMs),
      turns: Math.floor(travelled / 360),
    };
    const resolve = this._resolve;
    this._resolve = null;
    this._reject = null;
    this._speed = 0;
    this._legs = [];
    this._state = 'idle';
    this._host.events.emit('spin:complete', result);
    resolve?.(result);
    if (this._idleWanted && this._idle) this._beginIdling();
  }

  /** Drop the pending promise without resolving. Called from destroy(). */
  abandon(): void {
    this._resolve = null;
    this._reject = null;
    this._state = 'idle';
    this._legs = [];
    this._speed = 0;
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  private _landingRotation(): number {
    return rotationForLocalAngle(this._target!.landingAngle, this._host.pointerAngle);
  }

  private _settleLegs(landingRotation: number): StopLeg[] {
    const settle = this._landing!.settle;
    const center = rotationForLocalAngle(this._target!.section.midAngle, this._host.pointerAngle);
    return planSettle(landingRotation, center, settle, this._direction);
  }

  /**
   * Turn bait options into geometry. Decides the style when it is `'auto'`
   * and refuses (with a warning, not a throw: a spin must still land) when
   * the bait is nowhere near the landing.
   */
  private _resolveAnticipation(options: AnticipationOptions, target: ResolvedTarget): ResolvedAnticipation | null {
    const geometry = this._host.geometry;
    const bait: ResolvedSection =
      typeof options.bait === 'string' ? geometry.byId(options.bait) : geometry.byIndex(options.bait.index);
    if (bait.id === target.section.id) {
      noticeWarn('bait-is-target', `Ring "${this._host.ringId}": bait "${bait.id}" is the landing section; no tease planned.`);
      return null;
    }
    const dir = this._direction;
    const pointer = this._host.pointerAngle;
    const landingRotation = rotationForLocalAngle(target.landingAngle, pointer);
    const entry = rotationForLocalAngle(geometry.entryAngle(bait, dir), pointer);
    const exit = rotationForLocalAngle(geometry.exitAngle(bait, dir), pointer);
    const maxDistance = options.maxDistanceDeg ?? 150;
    // How far the pointer travels from the bait's entry to the landing (bait before target)...
    const baitThenTarget = arcDelta(entry, landingRotation, dir);
    // ...and from the landing to the bait's entry (target before bait).
    const targetThenBait = arcDelta(landingRotation, entry, dir);

    let style = options.style ?? 'auto';
    if (style === 'auto') {
      if (baitThenTarget <= maxDistance) style = 'creep';
      else if (targetThenBait <= maxDistance) style = 'overshoot';
      else {
        noticeWarn(
          'bait-too-far',
          `Ring "${this._host.ringId}": bait "${bait.id}" is ${Math.round(Math.min(baitThenTarget, targetThenBait))} deg from the landing ` +
            `(max ${maxDistance}); no tease planned. Pick a bait next to the target or raise maxDistanceDeg.`,
        );
        return null;
      }
    }
    if ((style === 'creep' || style === 'stutter') && baitThenTarget > maxDistance) {
      noticeWarn(
        'bait-order',
        `Ring "${this._host.ringId}": "${style}" needs the bait just BEFORE the landing in the spin direction, ` +
          `but "${bait.id}" is ${Math.round(baitThenTarget)} deg ahead of it. Use style 'overshoot' or another bait.`,
      );
      return null;
    }
    if (style === 'overshoot' && targetThenBait > maxDistance) {
      noticeWarn(
        'bait-order',
        `Ring "${this._host.ringId}": "overshoot" needs the bait just AFTER the landing in the spin direction, ` +
          `but "${bait.id}" is ${Math.round(targetThenBait)} deg before it. Use style 'creep' or another bait.`,
      );
      return null;
    }
    return {
      style,
      baitId: bait.id,
      baitEntryRotation: entry,
      baitExitRotation: exit,
      baitArc: bait.arc,
      creepSpeed: options.creepSpeed ?? 40,
      dwellMs: options.dwellMs ?? 700,
      pushMs: options.pushMs ?? 900,
      overshootDeg: options.overshootDeg ?? 6,
      returnMs: options.returnMs ?? 800,
    };
  }
}
