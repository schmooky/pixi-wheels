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
};

export const DEFAULT_POINTER: Required<Omit<PointerConfig, 'flap'>> & { flap: FlapConfig } = {
  id: 'pointer',
  angle: -90,
  facing: 'inward',
  tipInset: 18,
  flap: {},
};

export const DEFAULT_FLAP: Required<FlapConfig> = {
  maxAngle: 22,
  stiffness: 420,
  damping: 16,
  kick: 900,
  referenceSpeed: 540,
  invert: false,
};

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
