import { Container, type Ticker } from 'pixi.js';
import type {
  IdleConfig,
  LandingOptions,
  PointerConfig,
  SkipConfig,
  SpinDirection,
  SpinProfile,
  WheelSectionConfig,
  WheelSpinResult,
  WheelTarget,
} from '../config/types.js';
import { SpinPresets } from '../config/SpinPresets.js';
import type { Wheel } from '../core/Wheel.js';
import { WheelBuilder, type RingBuilder } from '../core/WheelBuilder.js';
import type { WheelEvents } from '../events/WheelEvents.js';
import type { PointerSkin } from '../pointer/PointerSkin.js';
import { HeadlessRingSkin } from '../skins/HeadlessRingSkin.js';
import { debugArc } from '../debug/debug.js';
import { FakeTicker } from './FakeTicker.js';

/** A pointer skin that is an empty container. Pin-to-tip length is fixed. */
export class HeadlessPointerSkin implements PointerSkin {
  readonly view = new Container();
  readonly length = 60;
  deflection = 0;
  ticks = 0;
  private _isDestroyed = false;

  setDeflection(deg: number): void {
    this.deflection = deg;
  }

  tick(): void {
    this.ticks++;
  }

  get isDestroyed(): boolean {
    return this._isDestroyed;
  }

  destroy(): void {
    this._isDestroyed = true;
  }
}

export interface TestWheelOptions {
  /** Sections, or a count of equal sections named `s0..sN-1` with `value: index`. Default 8. */
  sections?: WheelSectionConfig[] | number;
  radius?: number;
  innerRadius?: number;
  direction?: SpinDirection;
  startAngle?: number;
  /** Pointer placements. Default one at -90. */
  pointers?: PointerConfig[];
  /** Spin profile registered as `'normal'`. Default `SpinPresets.NORMAL`. */
  profile?: SpinProfile;
  landing?: LandingOptions;
  skip?: SkipConfig;
  idle?: IdleConfig;
  dynamic?: Parameters<RingBuilder['dynamic']>[0];
  /** Pegs for the main ring. Default: the builder's own (one per divider). */
  pegs?: Parameters<RingBuilder['pegs']>[0];
  /** Extra rings. Each gets the headless skin and pointer. */
  rings?: Array<{ id: string; outerRadius: number; innerRadius: number; sections: WheelSectionConfig[]; direction?: SpinDirection; pointers?: PointerConfig[] }>;
  /** Random source. Default a fixed seeded generator, so tests are deterministic. */
  rng?: () => number;
}

export interface TestWheelHandle {
  wheel: Wheel;
  ticker: FakeTicker;
  /** Advance fake time. */
  advance(ms: number, stepMs?: number): void;
  /**
   * `spin()`, `setResult(target)`, then advance frames until the spin
   * completes. Resolves with the result. Throws if it takes longer than
   * `maxMs` of fake time.
   */
  spinAndLand(target: WheelTarget, landing?: LandingOptions, opts?: { ring?: string; maxMs?: number }): Promise<WheelSpinResult>;
  /** Advance until no ring is spinning (or `maxMs` fake ms pass). */
  runUntilIdle(maxMs?: number): void;
  destroy(): void;
}

/** Mulberry32: a small deterministic PRNG for tests. */
export function seededRng(seed = 1): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Build a headless wheel on a fake ticker: no renderer, no textures, no
 * DOM. The spin lifecycle, planner, pointer ticks and events all run for
 * real; only the pixels are missing.
 *
 * ```ts
 * const h = createTestWheel({ sections: 8 });
 * const result = await h.spinAndLand({ section: 's3' });
 * expect(result.section.id).toBe('s3');
 * expect(h.wheel.sectionUnderPointer().id).toBe('s3');
 * h.destroy();
 * ```
 */
export function createTestWheel(options: TestWheelOptions = {}): TestWheelHandle {
  const ticker = new FakeTicker();
  const sections =
    typeof options.sections === 'number' || options.sections === undefined
      ? Array.from({ length: options.sections ?? 8 }, (_, i) => ({ id: `s${i}`, label: `s${i}`, value: i }))
      : options.sections;
  const builder = new WheelBuilder()
    .radius(options.radius ?? 200, options.innerRadius ?? 0)
    .sections(sections)
    .skin(new HeadlessRingSkin())
    .speed('normal', options.profile ?? SpinPresets.NORMAL)
    .rng(options.rng ?? seededRng(7))
    .ticker(ticker as unknown as Ticker);
  if (options.direction) builder.direction(options.direction);
  if (options.startAngle !== undefined) builder.startAngle(options.startAngle);
  for (const p of options.pointers ?? [{ angle: -90 }]) builder.pointer({ ...p, skin: new HeadlessPointerSkin() });
  if (options.landing) builder.landing(options.landing);
  if (options.skip) builder.skip(options.skip);
  if (options.idle) builder.idle(options.idle);
  if (options.dynamic) builder.dynamic(options.dynamic);
  if (options.pegs !== undefined) builder.pegs(options.pegs);
  for (const r of options.rings ?? []) {
    builder.ring(r.id, (rb) => {
      rb.radius(r.outerRadius, r.innerRadius).sections(r.sections).skin(new HeadlessRingSkin());
      if (r.direction) rb.direction(r.direction);
      for (const p of r.pointers ?? [{ angle: -90 }]) rb.pointer({ ...p, skin: new HeadlessPointerSkin() });
    });
  }
  const wheel = builder.build();

  const runUntilIdle = (maxMs = 120_000): void => {
    let spent = 0;
    while (wheel.isSpinning && spent < maxMs) {
      ticker.tick(16);
      spent += 16;
    }
    if (wheel.isSpinning) {
      throw new Error(`Test wheel still spinning after ${maxMs} ms of fake time.\n${debugArc(wheel)}`);
    }
  };

  return {
    wheel,
    ticker,
    advance(ms, stepMs = 16) {
      ticker.tickFor(ms, stepMs);
    },
    async spinAndLand(target, landing, opts = {}) {
      const ring = opts.ring;
      const p = wheel.spin({ ring });
      wheel.setResult(target, { ...landing, ring });
      runUntilIdle(opts.maxMs);
      return p;
    },
    runUntilIdle,
    destroy() {
      wheel.destroy();
      ticker.destroy();
    },
  };
}

/** Throw unless the pointer of `ring` (default main) is on section `id`. */
export function expectPointerOn(wheel: Wheel, id: string, ring?: string): void {
  const r = ring ? wheel.ring(ring) : wheel.main;
  const actual = r.sectionUnderPointer().id;
  if (actual !== id) {
    throw new Error(`Expected pointer on "${id}" but it is on "${actual}".\n${debugArc(wheel, r.id)}`);
  }
}

export interface CapturedEvent {
  event: keyof WheelEvents;
  args: unknown[];
}

/** Record the named events in order. Returns the growing log. */
export function captureEvents(wheel: Wheel, names: Array<keyof WheelEvents>): CapturedEvent[] {
  const log: CapturedEvent[] = [];
  for (const name of names) {
    wheel.events.on(name, ((...args: unknown[]) => {
      log.push({ event: name, args });
    }) as never);
  }
  return log;
}
