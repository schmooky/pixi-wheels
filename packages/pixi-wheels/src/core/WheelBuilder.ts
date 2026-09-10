import type { Ticker } from 'pixi.js';
import type {
  DynamicSectionsConfig,
  IdleConfig,
  LandingOptions,
  PointerConfig,
  SkipConfig,
  SpinDirection,
  SpinProfile,
  WheelSectionConfig,
  PegConfig,
} from '../config/types.js';
import { DEFAULT_SKIP, DEFAULTS } from '../config/defaults.js';
import { SpinPresets } from '../config/SpinPresets.js';
import { EventEmitter } from '../events/EventEmitter.js';
import type { WheelEvents } from '../events/WheelEvents.js';
import { GraphicsPointerSkin } from '../pointer/GraphicsPointerSkin.js';
import { Pointer } from '../pointer/Pointer.js';
import type { PointerSkin } from '../pointer/PointerSkin.js';
import { GraphicsRingSkin } from '../skins/GraphicsRingSkin.js';
import type { AssetResolver, RingSkin } from '../skins/RingSkin.js';
import {
  createPointerSkin,
  createRingSkin,
  NO_ASSETS,
  type PointerSkinConfig,
  type RingSkinConfig,
} from '../skins/skinRegistry.js';
import { resolveEase } from '../utils/easing.js';
import { noticeWarn } from '../utils/notify.js';
import { Ring } from './Ring.js';
import { RingGeometry } from './RingGeometry.js';
import { Wheel } from './Wheel.js';
import { assertWheelConfig, WHEEL_CONFIG_VERSION, type PointerConfigEntry, type RingConfig, type WheelConfig } from './WheelConfig.js';
import { registerBuiltinSkins } from '../skins/builtins.js';

/** A pointer as the builder accepts it: placement plus a skin instance or config. */
export interface PointerSpec extends PointerConfig {
  skin?: PointerSkin | PointerSkinConfig;
}

/**
 * Configures one ring. Reached through `WheelBuilder.ring(id, (r) => ...)`;
 * the wheel builder's own section methods are this, for the main ring.
 */
export class RingBuilder {
  readonly id: string;
  private _outerRadius: number | undefined;
  private _innerRadius = 0;
  private _startAngle: number = DEFAULTS.startAngle;
  private _direction: SpinDirection | undefined;
  private _sections: WheelSectionConfig[] = [];
  private _pointers: PointerSpec[] = [];
  private _skin: RingSkin | RingSkinConfig | undefined;
  private _dynamic: DynamicSectionsConfig | undefined;
  private _pegs: PegConfig | false | undefined;
  private _palette: number[] | undefined;

  constructor(id: string) {
    if (!id) throw new Error('A ring needs a non-empty id.');
    this.id = id;
  }

  /** Outer radius in pixels, and the hub (inner) radius. */
  radius(outer: number, inner = 0): this {
    this._outerRadius = outer;
    this._innerRadius = inner;
    return this;
  }

  outerRadius(r: number): this {
    this._outerRadius = r;
    return this;
  }

  innerRadius(r: number): this {
    this._innerRadius = r;
    return this;
  }

  /** Replace the section list. */
  sections(list: readonly WheelSectionConfig[]): this {
    this._sections = list.map((s) => ({ ...s }));
    return this;
  }

  /** Append one section. */
  section(config: WheelSectionConfig): this {
    this._sections.push({ ...config });
    return this;
  }

  /** Where section 0 begins, wheel-local degrees. Default -90 (twelve o'clock). */
  startAngle(deg: number): this {
    this._startAngle = deg;
    return this;
  }

  /** Spin direction for this ring. Default the wheel's. */
  direction(dir: SpinDirection): this {
    this._direction = dir;
    return this;
  }

  /** Add a pointer. Repeatable. A ring with none gets one at twelve o'clock. */
  pointer(spec: PointerSpec = {}): this {
    this._pointers.push({ ...spec });
    return this;
  }

  /**
   * The pegs the tongues touch: one per divider by default, `size` 6 px,
   * `inset` 9 px inside the rim. Every ring has them unless you pass `false`,
   * which leaves flapping pointers at rest.
   */
  pegs(config: PegConfig | false = {}): this {
    this._pegs = config;
    return this;
  }

  /** The look: a skin instance, or a serialisable skin config. Default `GraphicsRingSkin`. */
  skin(skin: RingSkin | RingSkinConfig): this {
    this._skin = skin;
    return this;
  }

  /** Dynamic sections: named weight steps the ring moves between. */
  dynamic(config: DynamicSectionsConfig): this {
    this._dynamic = { ...config, steps: config.steps.map((s) => ({ ...s })) };
    return this;
  }

  /** Colours cycled for sections without an explicit fill. */
  palette(colors: readonly number[]): this {
    this._palette = [...colors];
    return this;
  }

  /** @internal */
  _build(
    wheelDirection: SpinDirection,
    shared: {
      profiles: Map<string, SpinProfile>;
      initialSpeed: string;
      landing: LandingOptions;
      skip: Required<SkipConfig>;
      idle: IdleConfig | null;
      rng: () => number;
      events: EventEmitter<WheelEvents>;
      ticker: Ticker;
      assets: AssetResolver;
    },
  ): Ring {
    const outer = this._outerRadius;
    if (outer === undefined || !(outer > 0)) {
      throw new Error(`Ring "${this.id}": radius(outer) must be called with a positive number.`);
    }
    if (!(this._innerRadius >= 0) || this._innerRadius >= outer) {
      throw new Error(`Ring "${this.id}": inner radius ${this._innerRadius} must be >= 0 and smaller than the outer radius ${outer}.`);
    }
    if (this._sections.length < 2) {
      throw new Error(`Ring "${this.id}": needs at least 2 sections (sections([...]) or section({...})), got ${this._sections.length}.`);
    }
    if (this._dynamic) {
      const ids = new Set(this._sections.map((s) => s.id));
      this._dynamic.steps.forEach((step, i) => {
        for (const [id, w] of Object.entries(step)) {
          if (!ids.has(id)) throw new Error(`Ring "${this.id}": dynamic step ${i} names unknown section "${id}".`);
          if (!(w > 0)) throw new Error(`Ring "${this.id}": dynamic step ${i} gives "${id}" weight ${String(w)}; must be > 0.`);
        }
      });
      if (this._dynamic.ease !== undefined) resolveEase(this._dynamic.ease);
    }
    const geometry = new RingGeometry(this._sections, { startAngle: this._startAngle, palette: this._palette });
    const direction = this._direction ?? wheelDirection;

    const pointerSpecs = this._pointers.length > 0 ? this._pointers : [{}];
    const pointerIds = new Set<string>();
    const pointers = pointerSpecs.map((spec, i) => {
      const { skin: skinSpec, ...cfg } = spec;
      const id = cfg.id ?? (i === 0 ? 'pointer' : `pointer${i + 1}`);
      if (pointerIds.has(id)) throw new Error(`Ring "${this.id}": duplicate pointer id "${id}".`);
      pointerIds.add(id);
      if (cfg.angle !== undefined && !Number.isFinite(cfg.angle)) {
        throw new Error(`Ring "${this.id}": pointer "${id}" angle must be a finite number.`);
      }
      const skin: PointerSkin =
        skinSpec === undefined
          ? new GraphicsPointerSkin({ length: Math.max(40, outer * 0.26), width: Math.max(20, outer * 0.13) })
          : isPointerSkinConfig(skinSpec)
            ? createPointerSkin(skinSpec, shared.assets)
            : skinSpec;
      return new Pointer({ ...cfg, id }, skin);
    });

    const skin: RingSkin =
      this._skin === undefined
        ? new GraphicsRingSkin()
        : isRingSkinConfig(this._skin)
          ? createRingSkin(this._skin, shared.assets)
          : this._skin;

    return new Ring({
      id: this.id,
      outerRadius: outer,
      innerRadius: this._innerRadius,
      geometry,
      direction,
      pointers,
      skin,
      profiles: shared.profiles,
      initialSpeed: shared.initialSpeed,
      landing: shared.landing,
      skip: shared.skip,
      idle: shared.idle,
      dynamic: this._dynamic ?? null,
      pegs: this._pegs === false ? null : (this._pegs ?? {}),
      rng: shared.rng,
      events: shared.events,
      ticker: shared.ticker,
    });
  }

  /** @internal */
  _outer(): number | undefined {
    return this._outerRadius;
  }

  /** @internal */
  _inner(): number {
    return this._innerRadius;
  }

  /** @internal */
  _toConfig(): RingConfig {
    if (this._skin !== undefined && !isRingSkinConfig(this._skin)) {
      noticeWarn('config-skin-instance', `Ring "${this.id}": skin is an instance, not a config; toConfig() records { type: 'custom' }.`);
    }
    const pointers: PointerConfigEntry[] = this._pointers.map((p) => {
      const { skin, ...cfg } = p;
      const out: PointerConfigEntry = { ...cfg };
      if (skin !== undefined) {
        if (isPointerSkinConfig(skin)) out.skin = skin;
        else {
          noticeWarn('config-skin-instance', `Ring "${this.id}": pointer skin is an instance; toConfig() records { type: 'custom' }.`);
          out.skin = { type: 'custom' };
        }
      }
      return out;
    });
    const cfg: RingConfig = {
      id: this.id,
      outerRadius: this._outerRadius ?? 0,
      innerRadius: this._innerRadius,
      startAngle: this._startAngle,
      sections: this._sections.map(({ content, ...s }) => {
        if (content !== undefined) {
          noticeWarn('config-label-content', `Ring "${this.id}": section "${s.id}" has rich label content; toConfig() keeps its text label only.`);
        }
        return { ...s };
      }),
    };
    if (this._direction) cfg.direction = this._direction;
    if (pointers.length > 0) cfg.pointers = pointers;
    if (this._skin !== undefined) cfg.skin = isRingSkinConfig(this._skin) ? this._skin : { type: 'custom' };
    if (this._dynamic) cfg.dynamic = this._dynamic;
    if (this._pegs !== undefined) cfg.pegs = this._pegs;
    if (this._palette) cfg.palette = this._palette;
    return cfg;
  }

  /** @internal */
  static _fromConfig(cfg: RingConfig): RingBuilder {
    const b = new RingBuilder(cfg.id);
    b.radius(cfg.outerRadius, cfg.innerRadius ?? 0);
    if (cfg.startAngle !== undefined) b.startAngle(cfg.startAngle);
    if (cfg.direction) b.direction(cfg.direction);
    b.sections(cfg.sections);
    for (const p of cfg.pointers ?? []) b.pointer(p);
    if (cfg.skin) b.skin(cfg.skin);
    if (cfg.dynamic) b.dynamic(cfg.dynamic);
    if (cfg.pegs !== undefined) b.pegs(cfg.pegs);
    if (cfg.palette) b.palette(cfg.palette);
    return b;
  }
}

function isRingSkinConfig(x: RingSkin | RingSkinConfig): x is RingSkinConfig {
  return typeof (x as RingSkinConfig).type === 'string' && typeof (x as RingSkin).attach !== 'function';
}

function isPointerSkinConfig(x: PointerSkin | PointerSkinConfig): x is PointerSkinConfig {
  return typeof (x as PointerSkinConfig).type === 'string' && (x as PointerSkin).view === undefined;
}

/**
 * Fluent construction of a {@link Wheel}. Validates on `build()` and throws
 * a message that names the missing or conflicting call.
 *
 * ```ts
 * const wheel = new WheelBuilder()
 *   .radius(260)
 *   .sections([
 *     { id: 'x2', label: 'x2', value: 2, weight: 3 },
 *     { id: 'x5', label: 'x5', value: 5, weight: 2 },
 *     { id: 'x10', label: 'x10', value: 10, weight: 1 },
 *   ])
 *   .speed('normal', SpinPresets.NORMAL)
 *   .ticker(app.ticker)
 *   .build();
 * ```
 *
 * The section, radius, pointer and skin methods configure the main ring;
 * `ring(id, ...)` adds further rings around the same centre.
 */
export class WheelBuilder {
  private readonly _main = new RingBuilder(DEFAULTS.mainRing);
  private readonly _rings: RingBuilder[] = [];
  private _direction: SpinDirection = 'cw';
  private readonly _speeds = new Map<string, SpinProfile>();
  private _initialSpeed: string | undefined;
  private _landing: LandingOptions = {};
  private _skip: SkipConfig = {};
  private _idle: IdleConfig | undefined;
  private _rng: () => number = Math.random;
  private _ticker: Ticker | undefined;
  private _assets: AssetResolver = NO_ASSETS;
  private _name: string | undefined;
  private _adapter: WheelConfig['adapter'];

  // ── Main ring sugar ─────────────────────────────────────────────────────

  radius(outer: number, inner = 0): this {
    this._main.radius(outer, inner);
    return this;
  }

  sections(list: readonly WheelSectionConfig[]): this {
    this._main.sections(list);
    return this;
  }

  section(config: WheelSectionConfig): this {
    this._main.section(config);
    return this;
  }

  startAngle(deg: number): this {
    this._main.startAngle(deg);
    return this;
  }

  pointer(spec: PointerSpec = {}): this {
    this._main.pointer(spec);
    return this;
  }

  skin(skin: RingSkin | RingSkinConfig): this {
    this._main.skin(skin);
    return this;
  }

  dynamic(config: DynamicSectionsConfig): this {
    this._main.dynamic(config);
    return this;
  }

  /** Pegs of the main ring. See `RingBuilder.pegs()`. */
  pegs(config: PegConfig | false = {}): this {
    this._main.pegs(config);
    return this;
  }

  palette(colors: readonly number[]): this {
    this._main.palette(colors);
    return this;
  }

  // ── Wheel-level ─────────────────────────────────────────────────────────

  /** Spin direction for every ring that does not set its own. Default `'cw'`. */
  direction(dir: SpinDirection): this {
    this._direction = dir;
    return this;
  }

  /** Add a ring around the same centre. The callback configures it. */
  ring(id: string, configure: (ring: RingBuilder) => void): this {
    if (id === DEFAULTS.mainRing) throw new Error(`"${DEFAULTS.mainRing}" is the main ring; configure it with the builder's own methods.`);
    if (this._rings.some((r) => r.id === id)) throw new Error(`Ring "${id}" was already added.`);
    const rb = new RingBuilder(id);
    configure(rb);
    this._rings.push(rb);
    return this;
  }

  /** Register a spin profile under a name. The first registered is the initial speed unless `initialSpeed()` says otherwise. */
  speed(name: string, profile: SpinProfile): this {
    this._speeds.set(name, { ...profile });
    return this;
  }

  initialSpeed(name: string): this {
    this._initialSpeed = name;
    return this;
  }

  /** Defaults for every `setResult()`: landing mode, settle, anticipation. */
  landing(options: LandingOptions): this {
    this._landing = { ...options };
    return this;
  }

  skip(options: SkipConfig): this {
    this._skip = { ...options };
    return this;
  }

  /** Idle rotation config. `autoStart: true` begins idling on build. */
  idle(config: IdleConfig): this {
    this._idle = { ...config };
    return this;
  }

  /** Random source for `'random'` landings and `pick: 'random'`. Default `Math.random`. Seed it in tests. */
  rng(fn: () => number): this {
    this._rng = fn;
    return this;
  }

  ticker(ticker: Ticker): this {
    this._ticker = ticker;
    return this;
  }

  /** Where skin configs find their textures. Only needed for config-driven skins. */
  assets(resolver: AssetResolver): this {
    this._assets = resolver;
    return this;
  }

  /** Human name, kept in `toConfig()`. */
  name(name: string): this {
    this._name = name;
    return this;
  }

  /** Record how a server response maps to a target. Informational; kept in `toConfig()`. */
  adapter(config: WheelConfig['adapter']): this {
    this._adapter = config;
    return this;
  }

  // ── Build ───────────────────────────────────────────────────────────────

  build(): Wheel {
    registerBuiltinSkins();
    if (!this._ticker) {
      throw new Error('WheelBuilder: ticker(app.ticker) must be called. The wheel advances on the PixiJS ticker.');
    }
    if (this._speeds.size === 0) this._speeds.set('normal', { ...SpinPresets.NORMAL });
    for (const [name, p] of this._speeds) validateProfile(name, p);
    const initialSpeed = this._initialSpeed ?? this._speeds.keys().next().value!;
    if (!this._speeds.has(initialSpeed)) {
      throw new Error(`WheelBuilder: initialSpeed("${initialSpeed}") is not a registered speed. Registered: ${[...this._speeds.keys()].join(', ')}.`);
    }
    if (this._idle && !(this._idle.speed > 0)) {
      throw new Error(`WheelBuilder: idle speed must be > 0, got ${String(this._idle.speed)}.`);
    }
    if (this._landing.settle && typeof this._landing.settle === 'object' && this._landing.settle.ease !== undefined) {
      resolveEase(this._landing.settle.ease);
    }
    const skip: Required<SkipConfig> = { ...DEFAULT_SKIP, ...this._skip };
    const events = new EventEmitter<WheelEvents>();

    const all = [this._main, ...this._rings];
    // Rings may touch but not overlap.
    const sorted = [...all].sort((a, b) => (b._outer() ?? 0) - (a._outer() ?? 0));
    for (let i = 0; i + 1 < sorted.length; i++) {
      const bigger = sorted[i];
      const smaller = sorted[i + 1];
      const smallerOuter = smaller._outer() ?? 0;
      if (bigger._inner() < smallerOuter - 1e-6) {
        throw new Error(
          `Rings "${bigger.id}" (inner ${bigger._inner()}) and "${smaller.id}" (outer ${smallerOuter}) overlap. ` +
            `Give the outer ring an innerRadius of at least ${smallerOuter}.`,
        );
      }
    }

    const shared = {
      profiles: this._speeds,
      initialSpeed,
      landing: this._landing,
      skip,
      idle: this._idle ?? null,
      rng: this._rng,
      events,
      ticker: this._ticker,
      assets: this._assets,
    };
    const rings = all.map((rb) => rb._build(this._direction, shared));
    return new Wheel({ rings, events });
  }

  /** The builder's state as JSON. Skins given as instances are recorded as `{ type: 'custom' }`. */
  toConfig(): WheelConfig {
    const cfg: WheelConfig = {
      version: WHEEL_CONFIG_VERSION,
      direction: this._direction,
      rings: [this._main, ...this._rings].map((r) => r._toConfig()),
    };
    if (this._name) cfg.name = this._name;
    if (this._speeds.size > 0) cfg.speeds = Object.fromEntries(this._speeds);
    if (this._initialSpeed) cfg.initialSpeed = this._initialSpeed;
    if (Object.keys(this._landing).length > 0) cfg.landing = this._landing;
    if (Object.keys(this._skip).length > 0) cfg.skip = this._skip;
    if (this._idle) cfg.idle = this._idle;
    if (this._adapter) cfg.adapter = this._adapter;
    return cfg;
  }

  /**
   * A builder pre-filled from a config. Add the ticker (and assets, for
   * texture or Spine skins), then `build()`.
   *
   * ```ts
   * const wheel = WheelBuilder.fromConfig(cfg, { assets }).ticker(app.ticker).build();
   * ```
   */
  static fromConfig(config: WheelConfig, options: { assets?: AssetResolver; ticker?: Ticker } = {}): WheelBuilder {
    assertWheelConfig(config);
    const b = new WheelBuilder();
    if (config.name) b.name(config.name);
    if (config.direction) b.direction(config.direction);
    for (const [name, profile] of Object.entries(config.speeds ?? {})) b.speed(name, profile);
    if (config.initialSpeed) b.initialSpeed(config.initialSpeed);
    if (config.landing) b.landing(config.landing);
    if (config.skip) b.skip(config.skip);
    if (config.idle) b.idle(config.idle);
    if (config.adapter) b.adapter(config.adapter);
    const mainCfg = config.rings.find((r) => r.id === DEFAULTS.mainRing) ?? config.rings[0];
    applyRingConfig(b._main, mainCfg);
    for (const r of config.rings) {
      if (r === mainCfg) continue;
      b.ring(r.id, (rb) => applyRingConfig(rb, r));
    }
    if (options.assets) b.assets(options.assets);
    if (options.ticker) b.ticker(options.ticker);
    return b;
  }
}

function applyRingConfig(rb: RingBuilder, cfg: RingConfig): void {
  const src = RingBuilder._fromConfig(cfg);
  rb.radius(cfg.outerRadius, cfg.innerRadius ?? 0);
  if (cfg.startAngle !== undefined) rb.startAngle(cfg.startAngle);
  if (cfg.direction) rb.direction(cfg.direction);
  rb.sections(cfg.sections);
  for (const p of cfg.pointers ?? []) rb.pointer(p);
  if (cfg.skin) rb.skin(cfg.skin);
  if (cfg.dynamic) rb.dynamic(cfg.dynamic);
  if (cfg.pegs !== undefined) rb.pegs(cfg.pegs);
  if (cfg.palette) rb.palette(cfg.palette);
  void src;
}

function validateProfile(name: string, p: SpinProfile): void {
  const num = (field: keyof SpinProfile, min: number): void => {
    const v = p[field];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < min) {
      throw new Error(`Speed "${name}": ${field} must be a number >= ${min}, got ${String(v)}.`);
    }
  };
  num('spinSpeed', 1);
  num('accelerationMs', 0);
  num('minimumSpinTime', 0);
  num('minCruiseMs', 0);
  num('stopDuration', 1);
  num('minTurns', 0);
  num('maxTurns', 0);
  num('skipDuration', 1);
  if (p.maxTurns < p.minTurns) throw new Error(`Speed "${name}": maxTurns (${p.maxTurns}) is below minTurns (${p.minTurns}).`);
  if (p.accelerationEase !== undefined) resolveEase(p.accelerationEase);
  if (p.stopEase !== undefined) resolveEase(p.stopEase);
}
