import type { Ease } from '../utils/easing.js';

/**
 * Which way a ring turns. `'cw'` is the direction of increasing PixiJS
 * rotation, which reads as clockwise on screen because y points down.
 */
import type { Container } from 'pixi.js';
import type { FitMode, FitOptions, LabelSlot } from '../utils/fit.js';

export type SpinDirection = 'cw' | 'ccw';

/** How a label sits inside its section. */
/**
 * How a label sits in its wedge.
 *
 *   - `'radial'`: reads from the hub to the rim.
 *   - `'tangential'`: follows the arc, top of the content toward the rim. Reads upright at twelve o'clock.
 *   - `'tangential-in'`: follows the arc, top toward the hub. Reads upright at six o'clock, for wheels read from below.
 *   - `'upright'`: stays upright on screen as the disc turns.
 */
export type LabelOrientation = 'radial' | 'tangential' | 'tangential-in' | 'upright';

/**
 * Per-section look. Everything is optional: a section with no style gets the
 * skin's palette colour for its index and the skin's default label style.
 * Skins that draw from textures or Spine ignore the paint fields and only
 * read the label ones.
 */
export interface SectionStyle {
  /** Fill colour (0xRRGGBB). */
  fill?: number;
  /** Fill alpha, default 1. */
  alpha?: number;
  /** Divider / outline colour for this section only. */
  stroke?: number;
  /** Label colour (0xRRGGBB). */
  labelColor?: number;
  /** Label font size in px at the ring's authored radius. */
  labelSize?: number;
  /** CSS font family for the label. */
  labelFont?: string;
  /** Font weight for the label, e.g. `'700'`. */
  labelWeight?: string;
  /** `'radial'` (default) reads from the hub to the rim, `'tangential'` follows the arc. */
  labelOrientation?: LabelOrientation;
  /** Where along the radius the label sits, as a fraction of the outer radius (0..1). */
  labelRadius?: number;
  /** How the label (text or `content`) is fitted into the room it has. Default `'contain'`. */
  labelFit?: FitMode;
}

/** What a `content` factory receives: the section, its geometry and the room it has. */
export interface LabelContext {
  section: ResolvedSection;
  outerRadius: number;
  innerRadius: number;
  /** The fit box at the label radius, oriented like the label. */
  slot: LabelSlot;
  /** Scale `obj` into the slot (or a fraction of it via `padding`) and return the factor. */
  fit: (obj: Container, options?: FitOptions) => number;
}

/**
 * Anything a section shows instead of a text label: a `Text`, a `Sprite`, a
 * `BitmapText`, a Spine instance, a whole `Container` of them. Pass the
 * object, or a factory that builds it once from the section's context. The
 * label layer positions, rotates and fits it like a text label; it is
 * re-fitted whenever the geometry changes. Code only: `toConfig()` keeps
 * `label` and drops `content`.
 */
export type LabelContent = Container | ((ctx: LabelContext) => Container);

/** One section as the consumer authors it. */
export interface WheelSectionConfig {
  /** Unique id within the ring. What `setResult({ section })` and events name. */
  id: string;
  /** Text drawn by skins that draw labels. Defaults to the id. Pass `''` for none. */
  label?: string;
  /**
   * Rich label: any container, or a factory that builds one. Replaces the
   * text label on skins that draw labels. See `LabelContent`.
   */
  content?: LabelContent;
  /** Payload the section stands for (a multiplier, a prize code). Used by `setResult({ value })`. */
  value?: number | string;
  /**
   * Arc share, relative to the sum of all weights in the ring. Default 1.
   * Arcs need not be uniform: `{ weight: 0.5 }` is half the width of a
   * default section. Changing weights at run time is how dynamic sections work.
   */
  weight?: number;
  /** Look overrides for this section. */
  style?: SectionStyle;
  /** Free-form tag for consumers. Not read by the library. */
  tags?: string[];
}

/** Every style field resolved, as a skin receives it. */
export interface ResolvedSectionStyle {
  fill: number;
  alpha: number;
  stroke: number | null;
  labelColor: number;
  labelSize: number;
  labelFont: string;
  labelWeight: string;
  labelOrientation: LabelOrientation;
  labelRadius: number;
  labelFit: FitMode;
}

/**
 * A section with its geometry resolved. Angles are wheel-local degrees:
 * they rotate with the disc. `startAngle` is where the section begins going
 * clockwise; `endAngle = startAngle + arc`. Both are kept unnormalised and
 * increasing across the ring so `endAngle` of section `i` equals
 * `startAngle` of section `i + 1`.
 */
export interface ResolvedSection {
  id: string;
  index: number;
  label: string;
  value: number | string | undefined;
  weight: number;
  /** Local start angle in degrees (clockwise edge first in layout order). */
  startAngle: number;
  /** Local end angle in degrees. */
  endAngle: number;
  /** Local centre angle in degrees. */
  midAngle: number;
  /** Angular size in degrees. */
  arc: number;
  style: ResolvedSectionStyle;
  tags: readonly string[];
  /** Rich label content, when the section has one. */
  content?: LabelContent;
}

/**
 * What the wheel does once the pointer has reached the landing angle.
 *
 *   - `'none'`: stays exactly where it landed.
 *   - `'center'`: after `delayMs`, glides to the middle of the section over
 *     `durationMs`. The "land anywhere, then present the prize centred" beat.
 *   - `'bounce'`: overshoots by `bounceDeg` and springs back to the landing
 *     angle. A mechanical-stop feel.
 */
export type SettleMode = 'none' | 'center' | 'bounce';

export interface SettleConfig {
  mode: SettleMode;
  /** Pause before the settle begins. Default 250. */
  delayMs?: number;
  /** Length of the settle move. Default 600. */
  durationMs?: number;
  /** Ease of the settle move. Default `'sine.inOut'`. */
  ease?: Ease;
  /** `'bounce'` only: how far past the landing angle the wheel travels. Default 4. */
  bounceDeg?: number;
}

/**
 * Where inside the target section the pointer ends up.
 *
 *   - `'center'` (default): the middle of the section.
 *   - `'random'`: a uniformly random position, kept `margin` (fraction of the
 *     arc, default 0.12) away from both edges so a land never looks
 *     ambiguous.
 *   - `'exact'`: the `offset` passed with the target (0 = clockwise start
 *     edge, 1 = end edge), or the absolute `angle`.
 */
export type LandingMode = 'center' | 'random' | 'exact';

export interface LandingOptions {
  mode?: LandingMode;
  /** `'random'` only: keep-away from the section edges as a fraction of its arc. Default 0.12. */
  margin?: number;
  /** What happens after the pointer reaches the landing angle. Default `{ mode: 'none' }`. */
  settle?: SettleConfig | SettleMode;
  /** Bait the player with another section before landing. Default none. */
  anticipation?: AnticipationOptions | null;
}

/**
 * The shape of a near-miss.
 *
 *   - `'creep'`: the wheel decelerates to a crawl exactly as the pointer
 *     enters the bait section, keeps slowing across it, and barely crosses
 *     into the target. The bait must sit right before the target in the
 *     direction of spin.
 *   - `'stutter'`: the wheel stops with the pointer inside the bait, a few
 *     degrees short of the target's edge, holds for `dwellMs`, then nudges
 *     over the line. Same geometry as `'creep'`.
 *   - `'overshoot'`: the wheel passes the target, stops with the pointer a
 *     few degrees into the bait, holds, and rolls back into the target. The
 *     bait must sit right after the target.
 *   - `'auto'` (default): `'creep'` when the bait precedes the target,
 *     `'overshoot'` when it follows, otherwise no anticipation and a warning.
 */
export type AnticipationStyle = 'creep' | 'stutter' | 'overshoot' | 'auto';

export interface AnticipationOptions {
  /** The section to bait with: an id, or `{ index }`. */
  bait: string | { index: number };
  style?: AnticipationStyle;
  /** `'creep'`: speed (deg/s) at which the pointer enters the bait. Default 40. */
  creepSpeed?: number;
  /** `'stutter'` / `'overshoot'`: how long the wheel holds still. Default 700. */
  dwellMs?: number;
  /** `'stutter'`: length of the final nudge into the target. Default 900. */
  pushMs?: number;
  /** `'overshoot'`: how far into the bait the pointer goes. Default 6, capped to a quarter of the bait. */
  overshootDeg?: number;
  /** `'overshoot'`: length of the roll back into the target. Default 800. */
  returnMs?: number;
  /**
   * The furthest the bait's edge may be from the landing angle for the
   * tease to be planned, in degrees. Default 150. Beyond it the bait is not
   * "almost there" and the planner falls back to a plain stop with a warning.
   */
  maxDistanceDeg?: number;
  /**
   * Whether a skip press honours the tease. `false` (default): a skip lands
   * immediately. `true`: the first press fast-forwards to the bait and lets
   * the tease play; a second press lands.
   */
  protectSkip?: boolean;
}

/**
 * A spin's timing. Speeds are degrees per second; times are milliseconds.
 * `SpinPresets` ships a few; `builder.speed(name, profile)` registers your own.
 */
export interface SpinProfile {
  /** Cruise speed in deg/s. 540 is one and a half turns a second. */
  spinSpeed: number;
  /** Time to reach cruise speed from rest. */
  accelerationMs: number;
  /** Ease of the acceleration. Default `'power2.in'`. */
  accelerationEase?: Ease;
  /** The stop may not begin before this much time has passed since `spin()`. */
  minimumSpinTime: number;
  /** The stop may not begin before this much time at cruise speed. */
  minCruiseMs: number;
  /**
   * How long the deceleration should take. The planner picks the number of
   * extra turns that gets closest, then matches the ease's start to the
   * cruise speed, so the actual value differs a little.
   */
  stopDuration: number;
  /** Ease of the deceleration. Must be an ease-out. Default `'power3.out'`. */
  stopEase?: Ease;
  /** Fewest full turns the wheel makes while stopping. Default 2. */
  minTurns: number;
  /** Most full turns the wheel makes while stopping. Default 8. */
  maxTurns: number;
  /** Duration of the fast-forward when the player skips. Default 450. */
  skipDuration: number;
}

/** Slow rotation while nothing is happening, so a wheel parked beside the reels reads as live. */
export interface IdleConfig {
  /** Idle speed in deg/s. 12 is one turn every 30 seconds. */
  speed: number;
  /** Idle direction. Default the ring's spin direction. */
  direction?: SpinDirection;
  /** Start idling as soon as the wheel is built. Default false. */
  autoStart?: boolean;
  /** Ramp to / from the idle speed. Default 600. */
  rampMs?: number;
}

/** What a player's skip press is allowed to do. */
export interface SkipConfig {
  /** Whether `skip()` does anything at all. Default true. */
  allowed?: boolean;
  /** A press earlier than this many ms into the spin is ignored (not queued). Default 0. */
  minimumSpinTime?: number;
  /**
   * Default for `AnticipationOptions.protectSkip` when a tease is planned
   * without its own value. Default false.
   */
  protectAnticipation?: boolean;
}

/**
 * Where a spin should land, as the server or the game decides it.
 *
 *   - `{ section: 'grand' }`: by id.
 *   - `{ index: 3 }`: by position in the ring's section list.
 *   - `{ value: 8 }`: any section carrying that value; `pick` chooses among
 *     several (`'random'` by default, so a wheel with three `x2` wedges lands
 *     on a different one each time).
 *   - `{ angle: 123 }`: an absolute wheel-local angle in degrees.
 *   - `{ position: 0.34 }`: a fraction of the way around the ring from the
 *     layout start.
 *
 * `offset` (0..1 within the section, from its clockwise start edge) forces
 * the landing position for the id / index / value forms.
 */
export type WheelTarget =
  | { section: string; offset?: number }
  | { index: number; offset?: number }
  | { value: number | string; pick?: 'random' | 'first' | 'last'; offset?: number }
  | { angle: number }
  | { position: number };

/** A target after the ring's geometry has been consulted. */
export interface ResolvedTarget {
  section: ResolvedSection;
  /** Wheel-local angle (deg) that ends under the pointer. */
  landingAngle: number;
  /** Position within the section, 0 = clockwise start edge, 1 = end edge. */
  offset: number;
  /** The target as it was passed in. */
  source: WheelTarget;
}

/** What `spin()` resolves with. */
export interface WheelSpinResult {
  /** The ring that spun. `'main'` for a single-ring wheel. */
  ring: string;
  section: ResolvedSection;
  /** Wheel-local angle (deg) under the pointer when the spin completed. */
  landingAngle: number;
  /** Position within the section, 0..1. */
  offset: number;
  /** True when a skip or slam ended the spin early. */
  wasSkipped: boolean;
  /** Milliseconds from `spin()` to `spin:complete`. */
  duration: number;
  /** Full turns the wheel made from `spin()` to landing, rounded down. */
  turns: number;
}

/** Options for a single `spin()` call. */
export interface SpinOptions {
  /** Override the ring's spin direction for this spin only. */
  direction?: SpinDirection;
  /**
   * Reject the spin promise if no result arrives within this many ms of the
   * cruise beginning. Off by default: a wheel waits for its server.
   */
  resultTimeoutMs?: number;
}

/** Which way a pointer's tip faces. */
export type PointerFacing = 'inward' | 'outward';

/** The pointer flap: how the tongue deflects when a divider passes under it. */
export interface FlapConfig {
  /** Largest deflection, degrees. Default 22. */
  maxAngle?: number;
  /** Spring stiffness (1/s^2). Default 420. */
  stiffness?: number;
  /** Spring damping (1/s). Default 16. */
  damping?: number;
  /** Angular velocity added per divider crossing at reference speed, deg/s. Default 900. */
  kick?: number;
  /** Speed (deg/s) at which a crossing kicks with the full `kick`. Default 540. */
  referenceSpeed?: number;
  /** Flip the deflection direction if your art is mirrored. Default false. */
  invert?: boolean;
}

/**
 * A pointer ("tongue", "flapper", "stopper"): the fixed mark the wheel is read
 * against. A ring may have several, at different angles.
 */
export interface PointerConfig {
  /** Unique id within the ring. Default `'pointer'` for the first one. */
  id?: string;
  /** Screen angle in degrees. -90 is twelve o'clock (the default), 0 is three o'clock. */
  angle?: number;
  /** `'inward'` (default) sits on the rim with the tip pointing at the hub; `'outward'` sits at the hub pointing out. */
  facing?: PointerFacing;
  /** How far the tip reaches past the rim into the sections (or past the hub). Default 18. */
  tipInset?: number;
  /** Flap physics, or `false` to keep the pointer rigid. */
  flap?: FlapConfig | false;
}

/**
 * A step in a dynamic-section sequence: the weights every named section
 * takes when the wheel moves to that step. Sections not named keep their
 * current weight.
 */
export type DynamicStep = Record<string, number>;

/** A named set of dynamic steps plus how the wheel moves between them. */
export interface DynamicSectionsConfig {
  steps: DynamicStep[];
  /** Transition length between steps. Default 500. */
  durationMs?: number;
  /** Transition ease. Default `'sine.inOut'`. */
  ease?: Ease;
  /** Step the wheel starts on. Default 0. */
  initialStep?: number;
}

/** Options for an animated weight change. */
export interface WeightTransitionOptions {
  /** Transition length. Default from `dynamic.durationMs`, else 500. `0` snaps. */
  durationMs?: number;
  ease?: Ease;
}
