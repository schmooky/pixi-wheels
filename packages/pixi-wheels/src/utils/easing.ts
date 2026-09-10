import { noticeWarnOnce } from './notify.js';

/** A normalised easing function: `f(0) = 0`, `f(1) = 1`. */
export type EaseFn = (t: number) => number;

/**
 * An ease, as the name of a built-in curve or a function.
 *
 * Names follow the GSAP vocabulary so a designer can hand you a string
 * (`'power3.out'`, `'sine.inOut'`, `'back.out(1.4)'`), but nothing here
 * depends on GSAP: every curve is a plain function, which is what lets the
 * engine run deterministically under a fake ticker in tests.
 */
export type Ease = string | EaseFn;

const linear: EaseFn = (t) => t;
const powIn = (n: number): EaseFn => (t) => t ** n;
const powOut = (n: number): EaseFn => (t) => 1 - (1 - t) ** n;
const powInOut = (n: number): EaseFn => (t) =>
  t < 0.5 ? (2 * t) ** n / 2 : 1 - (2 - 2 * t) ** n / 2;

const sineIn: EaseFn = (t) => 1 - Math.cos((t * Math.PI) / 2);
const sineOut: EaseFn = (t) => Math.sin((t * Math.PI) / 2);
const sineInOut: EaseFn = (t) => -(Math.cos(Math.PI * t) - 1) / 2;

const expoIn: EaseFn = (t) => (t === 0 ? 0 : 2 ** (10 * (t - 1)));
const expoOut: EaseFn = (t) => (t === 1 ? 1 : 1 - 2 ** (-10 * t));
const expoInOut: EaseFn = (t) =>
  t === 0 ? 0 : t === 1 ? 1 : t < 0.5 ? 2 ** (20 * t - 10) / 2 : (2 - 2 ** (-20 * t + 10)) / 2;

const circIn: EaseFn = (t) => 1 - Math.sqrt(1 - t * t);
const circOut: EaseFn = (t) => Math.sqrt(1 - (t - 1) * (t - 1));
const circInOut: EaseFn = (t) =>
  t < 0.5 ? (1 - Math.sqrt(1 - 4 * t * t)) / 2 : (Math.sqrt(1 - (-2 * t + 2) ** 2) + 1) / 2;

const backOut = (s = 1.70158): EaseFn => (t) => {
  const u = t - 1;
  return 1 + u * u * ((s + 1) * u + s);
};
const backIn = (s = 1.70158): EaseFn => (t) => t * t * ((s + 1) * t - s);

const FAMILIES: Record<string, Record<string, EaseFn>> = {
  power1: { in: powIn(2), out: powOut(2), inOut: powInOut(2) },
  power2: { in: powIn(3), out: powOut(3), inOut: powInOut(3) },
  power3: { in: powIn(4), out: powOut(4), inOut: powInOut(4) },
  power4: { in: powIn(5), out: powOut(5), inOut: powInOut(5) },
  quad: { in: powIn(2), out: powOut(2), inOut: powInOut(2) },
  cubic: { in: powIn(3), out: powOut(3), inOut: powInOut(3) },
  quart: { in: powIn(4), out: powOut(4), inOut: powInOut(4) },
  quint: { in: powIn(5), out: powOut(5), inOut: powInOut(5) },
  sine: { in: sineIn, out: sineOut, inOut: sineInOut },
  expo: { in: expoIn, out: expoOut, inOut: expoInOut },
  circ: { in: circIn, out: circOut, inOut: circInOut },
};

/** Every ease name {@link resolveEase} accepts, for error messages and pickers. */
export const EASE_NAMES: readonly string[] = [
  'none',
  'linear',
  ...Object.keys(FAMILIES).flatMap((f) => [`${f}.in`, `${f}.out`, `${f}.inOut`]),
  'back.in',
  'back.out',
];

/**
 * Turn an {@link Ease} into a function. Throws on an unknown name, naming
 * the curves that exist, so a typo in a config fails at build time rather
 * than producing a wheel that never stops.
 */
export function resolveEase(ease: Ease): EaseFn {
  if (typeof ease === 'function') return ease;
  const trimmed = ease.trim();
  if (trimmed === 'none' || trimmed === 'linear') return linear;
  const m = /^([a-z0-9]+)\.(in|out|inOut)(?:\(([^)]*)\))?$/.exec(trimmed);
  if (m) {
    const [, family, kind, arg] = m;
    if (family === 'back') {
      const s = arg !== undefined && arg !== '' ? Number(arg) : undefined;
      if (kind === 'out') return backOut(s);
      if (kind === 'in') return backIn(s);
    } else {
      const fam = FAMILIES[family];
      if (fam) return fam[kind];
    }
  }
  throw new Error(
    `Unknown ease "${ease}". Pass a function, or one of: ${EASE_NAMES.join(', ')}.`,
  );
}

/**
 * Numeric slope of an ease at `t = 0`, as a multiple of the average slope
 * (which is 1 for a normalised curve). The stop planner divides by this to
 * match the wheel's cruise speed at the start of the deceleration, so the
 * hand-off from cruise to stop has no velocity step.
 */
export function initialSlope(fn: EaseFn): number {
  const h = 1e-4;
  return (fn(h) - fn(0)) / h;
}

/**
 * The initial slope the planner may actually use. An `inOut` curve starts at
 * zero speed (its slope is 0), which would need an infinitely long stop to be
 * velocity-matched; `circ.out` starts vertical. Both are clamped into a sane
 * band and reported once, rather than silently producing a 40 second stop.
 */
export function plannerSlope(fn: EaseFn, label: string): number {
  const s = initialSlope(fn);
  if (!Number.isFinite(s) || s < 0.75 || s > 12) {
    const clamped = !Number.isFinite(s) || s > 12 ? 12 : 0.75;
    noticeWarnOnce(
      'ease-slope',
      `stop ease "${label}" starts with slope ${Number.isFinite(s) ? s.toFixed(2) : 'inf'}; ` +
        `an ease-out with a finite, non-zero start (power2.out, power3.out, expo.out) keeps the ` +
        `cruise-to-stop hand-off smooth. Using ${clamped} instead.`,
    );
    return clamped;
  }
  return s;
}

/**
 * The position curve of a constant-acceleration leg between two speeds.
 * Normalised so `f(0) = 0`, `f(1) = 1`; the duration that makes this leg
 * physically consistent is `2 * distance / (v0 + v1)`.
 *
 * With `v1 = 0` this is exactly `power1.out`; with `v0 = 0` it is `power1.in`.
 */
export function constantAccelEase(v0: number, v1: number): EaseFn {
  const sum = v0 + v1;
  if (sum <= 0) return linear;
  const a = (2 * v0) / sum;
  const b = (2 * v1) / sum;
  return (t) => a * t + ((b - a) / 2) * t * t;
}

/**
 * A stop curve that begins already moving: position goes 0 to 1 with initial
 * slope `startSlope` (normalised: speed * duration / distance) and zero slope
 * at the end. Monotonic for slopes in 0..3. Lets a leg take over from a slow
 * crawl without a velocity step.
 */
export function hermiteStopEase(startSlope: number): EaseFn {
  const s = Math.min(3, Math.max(0, startSlope));
  return (t) => s * t + (3 - 2 * s) * t * t + (s - 2) * t * t * t;
}
