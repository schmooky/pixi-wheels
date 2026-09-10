import type { SpinDirection } from '../config/types.js';

/** Degrees to radians. */
export const DEG_TO_RAD = Math.PI / 180;
/** Radians to degrees. */
export const RAD_TO_DEG = 180 / Math.PI;

/** Wrap an angle into `[0, 360)`. */
export function normalizeDeg(angle: number): number {
  const r = angle % 360;
  return (r < 0 ? r + 360 : r) + 0; // `+ 0` turns -0 into 0
}

/** Wrap an angle into `(-180, 180]`. */
export function signedDeg(angle: number): number {
  const n = normalizeDeg(angle);
  return n > 180 ? n - 360 : n;
}

/**
 * The positive angular distance travelled when rotating in `direction` from
 * `from` to `to`, in `[0, 360)`. Clockwise is the direction of increasing
 * PixiJS rotation (screen y points down).
 */
export function arcDelta(from: number, to: number, direction: SpinDirection): number {
  return direction === 'cw' ? normalizeDeg(to - from) : normalizeDeg(from - to);
}

/** `+1` for a clockwise spin (rotation increases), `-1` for counter-clockwise. */
export function directionSign(direction: SpinDirection): 1 | -1 {
  return direction === 'cw' ? 1 : -1;
}

/**
 * Whether `angle` lies inside the arc that starts at `start` and sweeps
 * clockwise (increasing) for `arc` degrees. The start edge is inclusive, the
 * end edge exclusive, so every angle belongs to exactly one section.
 */
export function isAngleInArc(angle: number, start: number, arc: number): boolean {
  if (arc >= 360) return true;
  return normalizeDeg(angle - start) < arc;
}

/** Clamp `value` into `[min, max]`. */
export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}
