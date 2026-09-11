import { Container, type Ticker } from 'pixi.js';
import type {
  DynamicSectionsConfig,
  IdleConfig,
  LandingOptions,
  ResolvedSection,
  SkipConfig,
  SpinDirection,
  SpinOptions,
  SpinProfile,
  WeightTransitionOptions,
  WheelSpinResult,
  WheelTarget, PegConfig, ResolvedPegs } from '../config/types.js';
import { DEFAULTS, DEFAULT_PEGS, DEFAULT_POINTER } from '../config/defaults.js';
import type { EventEmitter } from '../events/EventEmitter.js';
import type { WheelEvents } from '../events/WheelEvents.js';
import type { Pointer } from '../pointer/Pointer.js';
import type { RingSkin } from '../skins/RingSkin.js';
import { SpinController, type SpinHost, type SpinState } from '../spin/SpinController.js';
import { DEG_TO_RAD, normalizeDeg } from '../utils/angles.js';
import type { Disposable } from '../utils/Disposable.js';
import { resolveEase, type EaseFn } from '../utils/easing.js';
import { TickerRef } from '../utils/TickerRef.js';
import type { RingGeometry } from './RingGeometry.js';

export interface RingParams {
  id: string;
  outerRadius: number;
  innerRadius: number;
  geometry: RingGeometry;
  direction: SpinDirection;
  pointers: Pointer[];
  skin: RingSkin;
  profiles: Map<string, SpinProfile>;
  initialSpeed: string;
  landing: LandingOptions;
  skip: Required<SkipConfig>;
  idle: IdleConfig | null;
  dynamic: DynamicSectionsConfig | null;
  /** Pegs the tongues touch; null for none. */
  pegs: PegConfig | null;
  rng: () => number;
  events: EventEmitter<WheelEvents>;
  ticker: Ticker;
}

/**
 * One spinning disc with its sections, pointers and skin.
 *
 * A single-ring wheel is one of these under a `Wheel`; a wheel with an
 * inner and an outer ring is two, sharing the centre and the event stream.
 * Built by `WheelBuilder`; consumers reach it through `wheel.main` or
 * `wheel.ring(id)`.
 */
export class Ring extends Container implements Disposable {
  readonly id: string;
  readonly outerRadius: number;
  readonly innerRadius: number;
  readonly geometry: RingGeometry;
  readonly events: EventEmitter<WheelEvents>;
  /** Rotates with the wheel. */
  readonly disc = new Container();
  /** Fixed. Pointers and static decoration. */
  readonly overlay = new Container();
  readonly pointers: readonly Pointer[];
  readonly skin: RingSkin;
  private readonly _direction: SpinDirection;
  private readonly _profiles: Map<string, SpinProfile>;
  private _activeSpeed: string;
  private readonly _landing: LandingOptions;
  private readonly _skip: Required<SkipConfig>;
  private readonly _idleConfig: IdleConfig | null;
  private readonly _dynamic: DynamicSectionsConfig | null;
  private readonly _pegConfig: PegConfig | null;
  private _pegs: ResolvedPegs | null = null;
  private readonly _rng: () => number;
  private readonly _controller: SpinController;
  private readonly _tickerRef: TickerRef;
  private _rotationDeg = 0;
  private _prevRotation = 0;
  private _dragDeg = 0;
  private _transition: {
    from: Record<string, number>;
    to: Record<string, number>;
    ms: number;
    duration: number;
    ease: EaseFn;
    step: number | null;
    resolve: () => void;
  } | null = null;
  private _step: number | null = null;
  private _isDestroyed = false;

  constructor(params: RingParams) {
    super();
    this.id = params.id;
    this.label = `pixi-wheels:ring:${params.id}`;
    this.outerRadius = params.outerRadius;
    this.innerRadius = params.innerRadius;
    this.geometry = params.geometry;
    this.events = params.events;
    this.pointers = params.pointers;
    this.skin = params.skin;
    this._direction = params.direction;
    this._profiles = params.profiles;
    this._activeSpeed = params.initialSpeed;
    this._landing = params.landing;
    this._skip = params.skip;
    this._idleConfig = params.idle;
    this._dynamic = params.dynamic;
    this._pegConfig = params.pegs;
    this._rng = params.rng;
    this._resolvePegs();
    this.disc.label = 'pixi-wheels:disc';
    this.overlay.label = 'pixi-wheels:overlay';
    this.addChild(this.disc, this.overlay);

    const host: SpinHost = {
      ringId: this.id,
      events: this.events,
      geometry: this.geometry,
      direction: this._direction,
      pointerAngle: this.pointers[0]?.angle ?? -90,
      rng: this._rng,
      get profile() {
        return self._profiles.get(self._activeSpeed)!;
      },
      landingDefaults: this._landing,
      skipConfig: this._skip,
      getRotation: () => this._rotationDeg,
      setRotation: (deg) => this._setRotation(deg),
    };
    // `self` for the getter above: `this` inside an object literal getter is the literal.
    const self = this;
    this._controller = new SpinController(host);

    this.skin.attach({
      ringId: this.id,
      geometry: this.geometry,
      outerRadius: this.outerRadius,
      innerRadius: this.innerRadius,
      disc: this.disc,
      overlay: this.overlay,
      direction: this._direction,
      pointerAngles: this.pointers.map((p) => p.angle),
      get pegs() {
        return self._pegs;
      },
    });
    for (const p of this.pointers) {
      p.layout(this.outerRadius, this.innerRadius);
      this.overlay.addChild(p.view);
    }
    if (this._dynamic && this._dynamic.steps.length > 0) {
      const initial = this._dynamic.initialStep ?? 0;
      this.geometry.setWeights(this._dynamic.steps[initial] ?? {});
      this._step = initial;
      this._resolvePegs();
      this.skin.layout();
    }
    this.skin.syncRotation?.(this.visualRotationDeg);

    this._wireSkinHooks();

    this._tickerRef = new TickerRef(params.ticker);
    this._tickerRef.add((t) => this.update(t.deltaMS));

    if (this._idleConfig?.autoStart) this._controller.startIdle(this._idleConfig);
  }

  // ── State ───────────────────────────────────────────────────────────────

  /** Disc rotation in degrees (clockwise positive), unbounded. */
  get rotationDeg(): number {
    return this._rotationDeg;
  }

  set rotationDeg(deg: number) {
    if (this._controller.isSpinning) {
      throw new Error(`Ring "${this.id}": rotationDeg cannot be set while spinning.`);
    }
    this._setRotation(deg);
    this._prevRotation = deg;
  }

  get direction(): SpinDirection {
    return this._direction;
  }

  get state(): SpinState {
    return this._controller.state;
  }

  get isSpinning(): boolean {
    return this._controller.isSpinning;
  }

  /** Signed angular speed of the last frame, deg/s. */
  get speed(): number {
    return this._controller.speed;
  }

  /** The controller, for the debug snapshot. */
  get controller(): SpinController {
    return this._controller;
  }

  get sections(): readonly ResolvedSection[] {
    return this.geometry.sections;
  }

  /** The pegs the tongues touch, resolved against the current geometry. Null when the ring has none. */
  get pegs(): ResolvedPegs | null {
    return this._pegs;
  }

  private _resolvePegs(): void {
    const cfg = this._pegConfig;
    if (!cfg) {
      this._pegs = null;
      return;
    }
    const size = cfg.size ?? DEFAULT_PEGS.size;
    // Default depth: just inside the first tongue's tip, so a peg bites a
    // couple of pixels into the blade. Pegs further out than that are past
    // the tip, and a blade has to lift clear over its whole width to let one
    // by - a huge swing that reads as a broken hinge rather than a ratchet.
    const bite = DEFAULT_PEGS.bite;
    const tip = this.pointers[0]?.tipInset ?? DEFAULT_POINTER.tipInset;
    const inset = cfg.inset ?? tip + size - bite;
    this._pegs = {
      size,
      radius: this.outerRadius - Math.max(size, inset),
      angles: (cfg.angles ?? this.geometry.boundaries()).map((a) => normalizeDeg(a)),
    };
  }

  /** The section under a pointer right now (the first pointer by default). */
  sectionUnderPointer(pointerId?: string): ResolvedSection {
    const p = pointerId ? this.pointers.find((x) => x.id === pointerId) : this.pointers[0];
    if (!p) throw new Error(`Ring "${this.id}": no pointer${pointerId ? ` "${pointerId}"` : ''}.`);
    return this.geometry.sectionAt(p.localAngle(this._rotationDeg));
  }

  /** The wheel-local angle under a pointer right now. */
  localAngleUnderPointer(pointerId?: string): number {
    const p = pointerId ? this.pointers.find((x) => x.id === pointerId) : this.pointers[0];
    if (!p) throw new Error(`Ring "${this.id}": no pointer${pointerId ? ` "${pointerId}"` : ''}.`);
    return p.localAngle(this._rotationDeg);
  }

  // ── Spin ────────────────────────────────────────────────────────────────

  spin(options?: SpinOptions): Promise<WheelSpinResult> {
    return this._controller.spin(options);
  }

  setResult(target: WheelTarget, landing?: LandingOptions): void {
    this._controller.setResult(target, landing);
  }

  skip(): boolean {
    return this._controller.skip();
  }

  requestSkip(): void {
    this._controller.requestSkip();
  }

  slamStop(): void {
    this._controller.slamStop();
  }

  // ── Speed ───────────────────────────────────────────────────────────────

  get speedNames(): string[] {
    return [...this._profiles.keys()];
  }

  get activeSpeed(): string {
    return this._activeSpeed;
  }

  get profile(): SpinProfile {
    return this._profiles.get(this._activeSpeed)!;
  }

  setSpeed(name: string): void {
    const profile = this._profiles.get(name);
    if (!profile) {
      throw new Error(`Ring "${this.id}": unknown speed "${name}". Registered: ${this.speedNames.join(', ')}.`);
    }
    if (name === this._activeSpeed) return;
    const previous = this._activeSpeed;
    this._activeSpeed = name;
    this.events.emit('speed:changed', { ring: this.id, name, profile, previous });
  }

  addSpeed(name: string, profile: SpinProfile): void {
    this._profiles.set(name, profile);
  }

  // ── Idle ────────────────────────────────────────────────────────────────

  readonly idle = {
    start: (config?: IdleConfig): void => {
      const cfg = config ?? this._idleConfig;
      if (!cfg) {
        throw new Error(`Ring "${this.id}": idle.start() needs a config, or .idle({ speed }) on the builder.`);
      }
      this._controller.startIdle(cfg);
    },
    stop: (): void => this._controller.stopIdle(),
    get isActive(): boolean {
      return false;
    },
  };

  // ── Dynamic sections ────────────────────────────────────────────────────

  /** The step the ring is on, when built with `.dynamic({ steps })`. */
  get step(): number | null {
    return this._step;
  }

  get stepCount(): number {
    return this._dynamic?.steps.length ?? 0;
  }

  /**
   * Move to a dynamic step: apply its weights, animated by default. The
   * promise resolves when the boundaries have finished moving.
   */
  setStep(index: number, options: WeightTransitionOptions = {}): Promise<void> {
    if (!this._dynamic) {
      throw new Error(`Ring "${this.id}": setStep() needs .dynamic({ steps }) on the builder.`);
    }
    const steps = this._dynamic.steps;
    if (index < 0 || index >= steps.length) {
      throw new Error(`Ring "${this.id}": step ${index} is out of range 0..${steps.length - 1}.`);
    }
    return this._transitionWeights(steps[index], options, index);
  }

  /** Move to the next step, wrapping around. */
  nextStep(options?: WeightTransitionOptions): Promise<void> {
    const count = this.stepCount;
    if (count === 0) throw new Error(`Ring "${this.id}": nextStep() needs .dynamic({ steps }) on the builder.`);
    return this.setStep(((this._step ?? -1) + 1) % count, options);
  }

  /**
   * Change section weights directly. Animated unless `durationMs` is 0.
   * Purely cosmetic: a spin already in flight keeps its planned landing.
   */
  setWeights(weights: Record<string, number>, options: WeightTransitionOptions = {}): Promise<void> {
    return this._transitionWeights(weights, options, null);
  }

  private _transitionWeights(
    target: Record<string, number>,
    options: WeightTransitionOptions,
    step: number | null,
  ): Promise<void> {
    // Validate before animating so a bad id throws now, not mid-transition.
    const current = this.geometry.weights();
    for (const id of Object.keys(target)) {
      if (!(id in current)) {
        throw new Error(`Ring "${this.id}": unknown section "${id}". Known: ${Object.keys(current).join(', ')}.`);
      }
      if (!(target[id] > 0)) throw new Error(`Ring "${this.id}": weight for "${id}" must be > 0.`);
    }
    const duration = options.durationMs ?? this._dynamic?.durationMs ?? DEFAULTS.weightTransitionMs;
    if (this._transition) {
      // A new transition supersedes the running one; resolve the old promise so nobody hangs.
      this._transition.resolve();
      this._transition = null;
    }
    if (duration <= 0) {
      this.geometry.setWeights(target);
      this._step = step;
      this._resolvePegs();
      this.skin.layout();
      this.events.emit('sections:changed', { ring: this.id, sections: this.geometry.sections, step });
      return Promise.resolve();
    }
    const ease = resolveEase(options.ease ?? this._dynamic?.ease ?? DEFAULTS.weightTransitionEase);
    return new Promise<void>((resolve) => {
      this._transition = { from: current, to: { ...current, ...target }, ms: 0, duration, ease, step, resolve };
      this.events.emit('sections:transition:start', { ring: this.id, durationMs: duration, step });
    });
  }

  private _updateTransition(dtMs: number): void {
    const t = this._transition;
    if (!t) return;
    t.ms += dtMs;
    const p = Math.min(1, t.ms / t.duration);
    const k = t.ease(p);
    const weights: Record<string, number> = {};
    for (const id of Object.keys(t.to)) {
      const a = t.from[id];
      const b = t.to[id];
      weights[id] = Math.max(1e-4, a + (b - a) * k);
    }
    this.geometry.setWeights(p >= 1 ? t.to : weights);
    this._resolvePegs();
    this.skin.layout();
    if (p >= 1) {
      this._transition = null;
      this._step = t.step;
      this.events.emit('sections:transition:end', { ring: this.id, step: t.step });
      this.events.emit('sections:changed', { ring: this.id, sections: this.geometry.sections, step: t.step });
      t.resolve();
    }
  }

  // ── Frame ───────────────────────────────────────────────────────────────

  /** Advance one frame. Called from the ticker; call directly with a fake ticker in tests. */
  update(deltaMS: number): void {
    if (this._isDestroyed) return;
    const dt = Math.min(Math.max(deltaMS, 0), 100) / 1000;
    this._controller.update(deltaMS);
    this._updateTransition(Math.min(Math.max(deltaMS, 0), 100));
    const rotation = this._rotationDeg;
    // Last frame's hold, so the tongue is tested against the pegs where they
    // were drawn. It is a fraction of a degree; the crossings, the geometry
    // and the landing all stay on the logical rotation.
    const dragOffset = this._dragDeg;
    let drag = 0;
    for (const p of this.pointers) {
      const crossings = p.update(this._prevRotation, rotation, dt, this.geometry, this._direction, this._pegs, dragOffset);
      drag += p.dragDeg;
      for (const c of crossings) {
        this.events.emit('pointer:tick', { ring: this.id, ...c });
      }
    }
    this._dragDeg = drag;
    this._prevRotation = rotation;
    this._applyRotation();
    this.skin.syncRotation?.(this.visualRotationDeg);
  }

  private _setRotation(deg: number): void {
    this._rotationDeg = deg;
    this._applyRotation();
  }

  private _applyRotation(): void {
    this.disc.rotation = (this._rotationDeg + this._dragDeg) * DEG_TO_RAD;
  }

  private _wireSkinHooks(): void {
    const skin = this.skin;
    const onStart = (info: { ring: string }): void => {
      if (info.ring === this.id) skin.onSpinStart?.();
    };
    const onStopping = (info: { ring: string }): void => {
      if (info.ring === this.id) skin.onSpinStop?.();
    };
    const onLanding = (info: { ring: string; section: ResolvedSection }): void => {
      if (info.ring === this.id) skin.onLanded?.(info.section);
    };
    this.events.on('spin:start', onStart);
    this.events.on('spin:stopping', onStopping);
    this.events.on('spin:landing', onLanding);
  }

  /**
   * Where the disc is actually drawn, degrees: {@link rotationDeg} plus the
   * arc the tongues are holding back (`flap.drag`). Equal to `rotationDeg`
   * for a weightless tongue and whenever the ring is at rest, so the wheel
   * always comes to rest drawn exactly on its result.
   */
  get visualRotationDeg(): number {
    return this._rotationDeg + this._dragDeg;
  }

  /** The arc the tongues are holding back right now, degrees. 0 without `flap.drag`. */
  get dragDeg(): number {
    return this._dragDeg;
  }

  /** Normalised rotation, 0..360. */
  get rotationNormalized(): number {
    return normalizeDeg(this._rotationDeg);
  }

  // ── Teardown ────────────────────────────────────────────────────────────

  get isDestroyed(): boolean {
    return this._isDestroyed;
  }

  override destroy(): void {
    if (this._isDestroyed) return;
    this._isDestroyed = true;
    this._tickerRef.destroy();
    this._controller.abandon();
    if (this._transition) {
      this._transition.resolve();
      this._transition = null;
    }
    for (const p of this.pointers) p.destroy();
    this.skin.destroy();
    super.destroy({ children: true });
  }
}
