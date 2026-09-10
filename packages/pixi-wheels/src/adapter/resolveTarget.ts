import type { LandingMode, ResolvedSection, ResolvedTarget, WheelTarget } from '../config/types.js';
import type { RingGeometry } from '../core/RingGeometry.js';
import { normalizeDeg } from '../utils/angles.js';

export interface ResolveTargetOptions {
  mode: LandingMode;
  /** `'random'` keep-away from the edges, fraction of the arc. */
  margin: number;
  rng: () => number;
}

/**
 * Turn a {@link WheelTarget} into a section and a wheel-local landing angle.
 *
 * Pure: the same geometry, target and rng always give the same answer, so a
 * game can pre-compute where a result lands before the wheel does.
 */
export function resolveTarget(
  geometry: RingGeometry,
  target: WheelTarget,
  options: ResolveTargetOptions,
): ResolvedTarget {
  if ('angle' in target) {
    if (!Number.isFinite(target.angle)) throw new Error(`Target angle must be finite, got ${String(target.angle)}.`);
    const angle = normalizeDeg(target.angle);
    const section = geometry.sectionAt(angle);
    return { section, landingAngle: angle, offset: offsetWithin(section, angle), source: target };
  }
  if ('position' in target) {
    if (!(target.position >= 0 && target.position <= 1)) {
      throw new Error(`Target position must be within 0..1, got ${String(target.position)}.`);
    }
    const angle = normalizeDeg(geometry.startAngle + target.position * 360);
    const section = geometry.sectionAt(angle);
    return { section, landingAngle: angle, offset: offsetWithin(section, angle), source: target };
  }

  let section: ResolvedSection;
  if ('section' in target) {
    section = geometry.byId(target.section);
  } else if ('index' in target) {
    section = geometry.byIndex(target.index);
  } else {
    const matches = geometry.byValue(target.value);
    if (matches.length === 0) {
      const values = [...new Set(geometry.sections.map((s) => String(s.value)))].join(', ');
      throw new Error(`No section carries value ${JSON.stringify(target.value)}. Values on this ring: ${values}.`);
    }
    const pick = target.pick ?? 'random';
    section =
      pick === 'first'
        ? matches[0]
        : pick === 'last'
          ? matches[matches.length - 1]
          : matches[Math.min(matches.length - 1, Math.floor(options.rng() * matches.length))];
  }

  let offset: number;
  const explicit = 'offset' in target ? target.offset : undefined;
  if (explicit !== undefined) {
    if (!(explicit >= 0 && explicit <= 1)) throw new Error(`Target offset must be within 0..1, got ${String(explicit)}.`);
    offset = explicit;
  } else if (options.mode === 'random') {
    const m = Math.min(0.49, Math.max(0, options.margin));
    offset = m + options.rng() * (1 - 2 * m);
  } else {
    offset = 0.5;
  }
  const landingAngle = normalizeDeg(section.startAngle + offset * section.arc);
  return { section, landingAngle, offset, source: target };
}

function offsetWithin(section: ResolvedSection, angle: number): number {
  const rel = normalizeDeg(angle - section.startAngle);
  return section.arc > 0 ? Math.min(1, rel / section.arc) : 0;
}
