import type { ResolvedSpinProfile, SpinProfile } from './types.js';
import { DEFAULT_PROFILE } from './defaults.js';
import { resolveEase } from '../utils/easing.js';

/**
 * Fill a profile's gaps from `DEFAULT_PROFILE` and check every field.
 * Throws a message that names the profile and the field, so a typo in a
 * config fails at registration rather than as a wheel that never stops.
 */
export function resolveProfile(name: string, profile: SpinProfile): ResolvedSpinProfile {
  const p: ResolvedSpinProfile = { ...DEFAULT_PROFILE, ...profile };
  const num = (field: keyof ResolvedSpinProfile, min: number): void => {
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
  resolveEase(p.accelerationEase);
  resolveEase(p.stopEase);
  return p;
}
