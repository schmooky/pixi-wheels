import { Container } from 'pixi.js';
import type {
  IdleConfig,
  LandingOptions,
  ResolvedSection,
  SpinOptions,
  WeightTransitionOptions,
  WheelSpinResult,
  WheelTarget,
} from '../config/types.js';
import { DEFAULTS } from '../config/defaults.js';
import type { EventEmitter } from '../events/EventEmitter.js';
import type { WheelEvents } from '../events/WheelEvents.js';
import type { Disposable } from '../utils/Disposable.js';
import type { Ring } from './Ring.js';
import type { RingGeometry } from './RingGeometry.js';

export interface WheelParams {
  rings: Ring[];
  events: EventEmitter<WheelEvents>;
}

/** Options for `wheel.spin()`: a ring to spin plus the per-spin options. */
export interface WheelSpinOptions extends SpinOptions {
  /** Which ring. Default the main ring. */
  ring?: string;
}

/** Options for `wheel.setResult()`: a ring plus the landing options. */
export interface WheelResultOptions extends LandingOptions {
  ring?: string;
}

/**
 * A bonus wheel: one or more rings sharing a centre and one typed event
 * stream. Place it like any container; everything else goes through the
 * methods below.
 *
 * Every method that takes a `ring` defaults to the main ring, so a
 * single-ring wheel never has to name one:
 *
 * ```ts
 * const spin = wheel.spin();
 * wheel.setResult({ section: 'x8' });
 * const result = await spin;
 * ```
 */
export class Wheel extends Container implements Disposable {
  readonly events: EventEmitter<WheelEvents>;
  readonly rings: readonly Ring[];
  private readonly _byId: Map<string, Ring>;
  private _isDestroyed = false;

  constructor(params: WheelParams) {
    super();
    this.label = 'pixi-wheels:wheel';
    this.events = params.events;
    this.rings = params.rings;
    this._byId = new Map(params.rings.map((r) => [r.id, r]));
    // Bigger rings first, so an inner ring draws above the outer one's centre.
    for (const ring of [...params.rings].sort((a, b) => b.outerRadius - a.outerRadius)) {
      this.addChild(ring);
    }
  }

  /** The main ring: the one `WheelBuilder`'s top-level section methods configure. */
  get main(): Ring {
    return this._byId.get(DEFAULTS.mainRing) ?? this.rings[0];
  }

  ring(id: string): Ring {
    const r = this._byId.get(id);
    if (!r) throw new Error(`Wheel: no ring "${id}". Rings: ${this.rings.map((x) => x.id).join(', ')}.`);
    return r;
  }

  hasRing(id: string): boolean {
    return this._byId.has(id);
  }

  /** The outermost radius across all rings. */
  get radius(): number {
    return Math.max(...this.rings.map((r) => r.outerRadius));
  }

  // ── Main-ring sugar ─────────────────────────────────────────────────────

  get geometry(): RingGeometry {
    return this.main.geometry;
  }

  get sections(): readonly ResolvedSection[] {
    return this.main.sections;
  }

  get rotationDeg(): number {
    return this.main.rotationDeg;
  }

  set rotationDeg(deg: number) {
    this.main.rotationDeg = deg;
  }

  get isSpinning(): boolean {
    return this.rings.some((r) => r.isSpinning);
  }

  sectionUnderPointer(pointerId?: string): ResolvedSection {
    return this.main.sectionUnderPointer(pointerId);
  }

  spin(options: WheelSpinOptions = {}): Promise<WheelSpinResult> {
    const { ring, ...rest } = options;
    return this._pick(ring).spin(rest);
  }

  setResult(target: WheelTarget, options: WheelResultOptions = {}): void {
    const { ring, ...landing } = options;
    this._pick(ring).setResult(target, landing);
  }

  /**
   * Skip the spinning ring. With one ring in flight this is that ring's
   * `skip()`, including its throw before `setResult()`; with several, every
   * ring that has a result skips. True if any ring skipped.
   */
  skip(ring?: string): boolean {
    if (ring) return this.ring(ring).skip();
    const spinning = this.rings.filter((r) => r.isSpinning);
    if (spinning.length === 1) return spinning[0].skip();
    let any = false;
    for (const r of spinning) if (r.controller.target) any = r.skip() || any;
    return any;
  }

  requestSkip(ring?: string): void {
    if (ring) {
      this.ring(ring).requestSkip();
      return;
    }
    for (const r of this.rings) if (r.isSpinning) r.requestSkip();
  }

  slamStop(ring?: string): void {
    if (ring) {
      this.ring(ring).slamStop();
      return;
    }
    for (const r of this.rings) if (r.isSpinning) r.slamStop();
  }

  /** Switch the speed profile on every ring (or one). */
  setSpeed(name: string, ring?: string): void {
    if (ring) {
      this.ring(ring).setSpeed(name);
      return;
    }
    for (const r of this.rings) r.setSpeed(name);
  }

  get activeSpeed(): string {
    return this.main.activeSpeed;
  }

  get speedNames(): string[] {
    return this.main.speedNames;
  }

  readonly idle = {
    start: (config?: IdleConfig, ring?: string): void => {
      if (ring) {
        this.ring(ring).idle.start(config);
        return;
      }
      this.main.idle.start(config);
    },
    stop: (ring?: string): void => {
      if (ring) {
        this.ring(ring).idle.stop();
        return;
      }
      for (const r of this.rings) r.idle.stop();
    },
  };

  setWeights(weights: Record<string, number>, options?: WeightTransitionOptions & { ring?: string }): Promise<void> {
    const { ring, ...rest } = options ?? {};
    return this._pick(ring).setWeights(weights, rest);
  }

  setStep(index: number, options?: WeightTransitionOptions & { ring?: string }): Promise<void> {
    const { ring, ...rest } = options ?? {};
    return this._pick(ring).setStep(index, rest);
  }

  nextStep(options?: WeightTransitionOptions & { ring?: string }): Promise<void> {
    const { ring, ...rest } = options ?? {};
    return this._pick(ring).nextStep(rest);
  }

  get step(): number | null {
    return this.main.step;
  }

  /** Turn a section highlight on (or off with `null`) on skins that support it. */
  highlight(sectionId: string | null, ring?: string): void {
    this._pick(ring).skin.highlight?.(sectionId);
  }

  private _pick(ring: string | undefined): Ring {
    return ring ? this.ring(ring) : this.main;
  }

  // ── Teardown ────────────────────────────────────────────────────────────

  get isDestroyed(): boolean {
    return this._isDestroyed;
  }

  override destroy(): void {
    if (this._isDestroyed) return;
    this._isDestroyed = true;
    for (const r of this.rings) r.destroy();
    this.events.emit('destroyed');
    this.events.removeAllListeners();
    super.destroy({ children: true });
  }
}
