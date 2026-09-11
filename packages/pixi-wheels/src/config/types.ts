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
 * The shape of a near-miss. The wheel decelerates once and comes to rest
 * once, on the result: no style stops somewhere else and moves on. The
 * pointer rests just inside the target, next to the divider it shares with
 * the bait (`rest`), so the miss reads as "by a hair".
 *
 *   - `'creep'`: the wheel slows to a crawl exactly as the pointer enters the
 *     bait, keeps slowing across it, and barely crosses the line into the
 *     target. The bait must sit right before the target in the spin direction.
 *   - `'stutter'`: like `'creep'`, but the crawl all but stalls a hair short
 *     of the line (`hesitateSpeed` for `dwellMs`) before slipping over it.
 *     Same geometry as `'creep'`.
 *   - `'stall'`: the pointer enters the target and crawls toward the bait's
 *     line as if it will cross, and dies just short of it. The bait must sit
 *     right after the target. The "it was going to be the jackpot" miss.
 *   - `'auto'` (default): `'creep'` when the bait precedes the target,
 *     `'stall'` when it follows, otherwise no anticipation and a warning.
 */
export type AnticipationStyle = 'creep' | 'stutter' | 'stall' | 'auto';

export interface AnticipationOptions {
  /** The section to bait with: an id, or `{ index }`. */
  bait: string | { index: number };
  style?: AnticipationStyle;
  /**
   * Speed (deg/s) at which the crawl begins: entering the bait (`'creep'`,
   * `'stutter'`) or starting the approach (`'stall'`). Default 40.
   */
  creepSpeed?: number;
  /** `'stutter'`: the near-stall speed a hair short of the line, deg/s. Default 2: still moving, barely. */
  hesitateSpeed?: number;
  /** `'stutter'`: how long the near-stall lasts, ms. Default 600. */
  dwellMs?: number;
  /** `'stutter'`: length of the slip over the line, ms. Default 700. */
  pushMs?: number;
  /**
   * `'stall'`: how far before the rest the crawl begins, in degrees. Default
   * the target's arc (the crawl starts as the pointer enters the result), at
   * most 45.
   */
  approachDeg?: number;
  /**
   * Where the pointer rests after the tease, as a fraction of the target's
   * arc measured from the divider it shares with the bait. Default 0.22 for
   * `'creep'` and `'stutter'` (just over the line), 0.15 for `'stall'` (died
   * just short of it). `'keep'` leaves the landing angle to the landing
   * mode. Ignored when the target carries its own `offset`, is an `angle` /
   * `position`, or the landing mode is `'exact'`. Add `settle: 'center'` to
   * glide to the middle afterwards.
   */
  rest?: number | 'keep';
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

/**
 * The pegs a tongue touches: small circles on the disc, one per divider by
 * default. They give the pointer flap its physics and the debug overlay
 * draws them; a skin may draw them too (`GraphicsRingSkin` `pegs`).
 */
export interface PegConfig {
  /** Peg radius, px. Default 6. */
  size?: number;
  /**
   * How far inside the rim the peg centres sit, px. Defaults to
   * `pointer.tipInset + size - 2`, which puts the peg ring just inside the
   * first tongue's tip so a peg bites 2 px into the blade. Pegs set further
   * out sit past the tip, and the blade then has to swing clear over its
   * whole width to let one through.
   */
  inset?: number;
  /** Local angles of the pegs, degrees. Default every divider, so dynamic sections keep their pegs on the lines. */
  angles?: number[];
}

/** The pegs with their geometry resolved against the ring. */
export interface ResolvedPegs {
  size: number;
  /** Distance from the hub to the peg centres, px. */
  radius: number;
  /** Local angles, degrees, normalised. */
  angles: readonly number[];
}

/**
 * The pointer flap: how the tongue behaves against the pegs.
 *
 * The tongue tip is a point `tipWidth` wide at the peg ring. A peg coming
 * toward it pushes it aside along the peg's rim (the geometric push, scaled
 * by `elasticity`), carries it on its crown until the peg is through plus
 * `friction` of the contact width, then lets go; a spring (`stiffness`, `damping`) brings it back.
 * At speed a peg passes within one frame and the tongue is flicked to the
 * crown deflection instead, so a fast wheel keeps it pinned and jittering
 * and a crawling one bends it slowly over every peg.
 */
export interface FlapConfig {
  /**
   * Largest deflection, degrees. Default 45: a blade that dips past the peg
   * ring has to swing a long way before a peg can get by it, and a cap below
   * what the geometry needs makes the tongue ride through the pegs instead.
   */
  maxAngle?: number;
  /** Spring stiffness pulling the tongue back to rest (1/s^2). Default 420. */
  stiffness?: number;
  /** Spring damping (1/s). Default 14; lower rings longer after a release. */
  damping?: number;
  /**
   * How far the tongue yields, as a multiple of the swing that just clears
   * the peg. Default 1: exactly enough, never less - a value under 1 is
   * clamped, because a tongue that yields less than the geometry demands is
   * a tongue drawn through a peg. Over 1 throws it further than it needs.
   */
  elasticity?: number;
  /** Extra carry after a peg has passed under the tip, as a fraction of the contact width. Default 0.35; 0 lets go as soon as the peg is through, 1 drags a whole width more. */
  friction?: number;
  /**
   * Width of the blade where the pegs cross it, px. Default 14. The contact
   * model is that blade: a triangle from the pin, `tipWidth` across at the
   * peg ring, tapering to a point at the tip.
   */
  tipWidth?: number;
  /**
   * How hard the tongue holds the ring back while a peg climbs it, 0..1.
   * Default 0 (the tongue is weightless). At 1 the ring is held for a whole
   * contact width of arc and springs forward when the peg slips over the
   * crown: a crawling wheel visibly catches on every peg. Purely visual -
   * the hold always relaxes to zero, so the planned landing is unchanged.
   */
  drag?: number;
  /** How fast the ring catches up after a drag hold, 1/s. Default 24. */
  dragRelease?: number;
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
  /** Flap physics against the ring's pegs, or `false` to keep the pointer rigid. */
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
