import type {
  FlapConfig,
  LandingOptions,
  PointerConfig,
  ResolvedSectionStyle,
  SettleConfig,
  SkipConfig,
} from './types.js';

/**
 * A palette that reads on a dark casino background and keeps neighbouring
 * sections distinct even for eight or more wedges. Cycled by section index.
 */
export const DEFAULT_PALETTE: readonly number[] = [
  0xe84a5f, 0xf6b93b, 0x2ecc71, 0x3498db, 0x9b59b6, 0xff7f50, 0x1abc9c, 0xf1c40f,
];

export const DEFAULT_LABEL_STYLE: Omit<ResolvedSectionStyle, 'fill' | 'alpha' | 'stroke'> = {
  labelColor: 0xffffff,
  labelSize: 26,
  labelFont: 'Roboto Condensed, Arial Narrow, sans-serif',
  labelWeight: '700',
  labelOrientation: 'radial',
  labelRadius: 0.68,
  labelFit: 'contain',
};

export const DEFAULT_POINTER: Required<Omit<PointerConfig, 'flap'>> & { flap: FlapConfig } = {
  id: 'pointer',
  angle: -90,
  facing: 'inward',
  tipInset: 18,
  flap: {},
};

export const DEFAULT_FLAP: Required<FlapConfig> = {
  maxAngle: 45,
  stiffness: 420,
  damping: 14,
  elasticity: 1,
  friction: 0.35,
  tipWidth: 14,
  drag: 0,
  dragRelease: 24,
  invert: false,
};

/** Pegs when a ring asks for them without details. */
export const DEFAULT_PEGS = {
  size: 6,
  /**
   * How far a peg reaches past the tongue's tip, px. A ring with no `inset`
   * of its own derives one from the first pointer: `tipInset + size - bite`.
   * Out of the box a peg bites this much into the blade, which is a modest
   * swing to get by; pegs set further out sit past the tip, and the blade
   * then has to lift clear over its whole width to let one through.
   */
  bite: 2,
} as const;

export const DEFAULT_SETTLE: Required<SettleConfig> = {
  mode: 'none',
  delayMs: 250,
  durationMs: 600,
  ease: 'sine.inOut',
  bounceDeg: 4,
};

export const DEFAULT_LANDING: Required<Pick<LandingOptions, 'mode' | 'margin'>> = {
  mode: 'center',
  margin: 0.12,
};

/** Timing and rest of a near-miss when `AnticipationOptions` leaves them out. */
export const DEFAULT_ANTICIPATION = {
  creepSpeed: 40,
  hesitateSpeed: 2,
  dwellMs: 600,
  pushMs: 700,
  approachDeg: 45,
  /** Fraction of the target's arc between the shared divider and the resting pointer, per style. */
  rest: { creep: 0.22, stutter: 0.22, stall: 0.15 },
} as const;

export const DEFAULT_SKIP: Required<SkipConfig> = {
  allowed: true,
  minimumSpinTime: 0,
  protectAnticipation: false,
};

export const DEFAULTS = {
  /** Where section 0 begins, in wheel-local degrees. -90 puts its clockwise edge at twelve o'clock. */
  startAngle: -90,
  /** Weight of a section that declares none. */
  weight: 1,
  /** Transition length for dynamic-section weight changes, ms. */
  weightTransitionMs: 500,
  weightTransitionEase: 'sine.inOut',
  /** Idle ramp, ms. */
  idleRampMs: 600,
  /** Main ring id for single-ring wheels. */
  mainRing: 'main',
} as const;
