import type { SpinProfile } from './types.js';

/**
 * Ready-made spin feels. Register them by name and switch at run time:
 *
 * ```ts
 * new WheelBuilder()
 *   .speed('normal', SpinPresets.NORMAL)
 *   .speed('turbo', SpinPresets.TURBO)
 * // ...
 * wheel.setSpeed('turbo');
 * ```
 */
export const SpinPresets = {
  /** The default bonus-wheel feel: a second of wind-up, a four-second stop. */
  NORMAL: {
    spinSpeed: 540,
    accelerationMs: 900,
    accelerationEase: 'power2.in',
    minimumSpinTime: 1400,
    minCruiseMs: 400,
    stopDuration: 4200,
    stopEase: 'power3.out',
    minTurns: 2,
    maxTurns: 8,
    skipDuration: 450,
  },
  /** Everything shorter. The player has seen this wheel a hundred times. */
  TURBO: {
    spinSpeed: 720,
    accelerationMs: 400,
    accelerationEase: 'power2.in',
    minimumSpinTime: 600,
    minCruiseMs: 150,
    stopDuration: 1800,
    stopEase: 'power3.out',
    minTurns: 1,
    maxTurns: 4,
    skipDuration: 300,
  },
  /** Long, heavy, for a jackpot wheel that is the whole screen. */
  CINEMATIC: {
    spinSpeed: 450,
    accelerationMs: 1400,
    accelerationEase: 'power2.in',
    minimumSpinTime: 2200,
    minCruiseMs: 800,
    stopDuration: 6500,
    stopEase: 'power4.out',
    minTurns: 3,
    maxTurns: 10,
    skipDuration: 600,
  },
  /** For a gamble wheel that is spun over and over: quick in, quick out. */
  QUICK: {
    spinSpeed: 900,
    accelerationMs: 250,
    accelerationEase: 'power1.in',
    minimumSpinTime: 400,
    minCruiseMs: 100,
    stopDuration: 1300,
    stopEase: 'power2.out',
    minTurns: 1,
    maxTurns: 3,
    skipDuration: 250,
  },
} as const satisfies Record<string, SpinProfile>;
