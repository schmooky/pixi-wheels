import type {
  ResolvedSection,
  ResolvedSectionStyle,
  SpinDirection,
  WheelSectionConfig,
} from '../config/types.js';
import { DEFAULT_LABEL_STYLE, DEFAULT_PALETTE, DEFAULTS } from '../config/defaults.js';
import { normalizeDeg } from '../utils/angles.js';

export interface RingGeometryOptions {
  /** Where section 0 begins, wheel-local degrees. Default -90 (twelve o'clock). */
  startAngle?: number;
  /** Palette cycled for sections without a `style.fill`. */
  palette?: readonly number[];
}

/**
 * The sections of one ring, laid out around the circle.
 *
 * Pure data, no PixiJS. Section 0 begins at `startAngle` and sections
 * proceed clockwise (increasing angle); each arc is its weight's share of
 * 360. Weights can change at run time (`setWeights`) and the layout is
 * recomputed, which is all a dynamic section is.
 */
export class RingGeometry {
  readonly startAngle: number;
  private readonly _configs: WheelSectionConfig[];
  private readonly _palette: readonly number[];
  private _weights: Map<string, number>;
  private _sections: ResolvedSection[] = [];
  private _byId = new Map<string, ResolvedSection>();

  constructor(configs: readonly WheelSectionConfig[], options: RingGeometryOptions = {}) {
    if (configs.length < 2) {
      throw new Error(`A ring needs at least 2 sections, got ${configs.length}.`);
    }
    const ids = new Set<string>();
    for (const c of configs) {
      if (!c.id || typeof c.id !== 'string') {
        throw new Error('Every section needs a non-empty string id.');
      }
      if (ids.has(c.id)) throw new Error(`Duplicate section id "${c.id}".`);
      ids.add(c.id);
      const w = c.weight ?? DEFAULTS.weight;
      if (!(w > 0) || !Number.isFinite(w)) {
        throw new Error(`Section "${c.id}" has weight ${String(c.weight)}; weights must be finite and > 0.`);
      }
    }
    this.startAngle = options.startAngle ?? DEFAULTS.startAngle;
    this._palette = options.palette ?? DEFAULT_PALETTE;
    this._configs = configs.map((c) => ({ ...c }));
    this._weights = new Map(this._configs.map((c) => [c.id, c.weight ?? DEFAULTS.weight]));
    this._layout();
  }

  /** Sections in layout order, with current geometry. */
  get sections(): readonly ResolvedSection[] {
    return this._sections;
  }

  get count(): number {
    return this._sections.length;
  }

  /** Current weights by id. */
  weights(): Record<string, number> {
    return Object.fromEntries(this._weights);
  }

  /**
   * Replace weights for the named sections and re-lay the ring out. Sections
   * not named keep their weight. Throws on an unknown id or a non-positive
   * weight; a zero-width section would be unlandable.
   */
  setWeights(next: Readonly<Record<string, number>>): void {
    for (const [id, w] of Object.entries(next)) {
      if (!this._weights.has(id)) {
        throw new Error(`setWeights: unknown section "${id}". Known: ${[...this._weights.keys()].join(', ')}.`);
      }
      if (!(w > 0) || !Number.isFinite(w)) {
        throw new Error(`setWeights: section "${id}" weight ${String(w)} must be finite and > 0.`);
      }
    }
    for (const [id, w] of Object.entries(next)) this._weights.set(id, w);
    this._layout();
  }

  byId(id: string): ResolvedSection {
    const s = this._byId.get(id);
    if (!s) throw new Error(`Unknown section "${id}". Known: ${this._sections.map((x) => x.id).join(', ')}.`);
    return s;
  }

  has(id: string): boolean {
    return this._byId.has(id);
  }

  byIndex(index: number): ResolvedSection {
    const s = this._sections[index];
    if (!s) throw new Error(`Section index ${index} is out of range 0..${this._sections.length - 1}.`);
    return s;
  }

  byValue(value: number | string): ResolvedSection[] {
    return this._sections.filter((s) => s.value === value);
  }

  /** The section that contains a wheel-local angle. */
  sectionAt(localAngle: number): ResolvedSection {
    const rel = normalizeDeg(localAngle - this.startAngle);
    // Sections are contiguous from 0..360 in `rel` space; walk until we pass it.
    for (const s of this._sections) {
      const start = s.startAngle - this.startAngle;
      if (rel >= start && rel < start + s.arc) return s;
    }
    // Floating point can leave rel === 360 - epsilon just past the last end.
    return this._sections[this._sections.length - 1];
  }

  /**
   * The boundary of a section that a pointer meets first when the ring
   * turns in `direction`. A clockwise-turning ring sweeps decreasing local
   * angles under a fixed pointer, so the pointer enters at the section's end.
   */
  entryAngle(section: ResolvedSection, direction: SpinDirection): number {
    return direction === 'cw' ? section.endAngle : section.startAngle;
  }

  /** The boundary a pointer leaves a section through. */
  exitAngle(section: ResolvedSection, direction: SpinDirection): number {
    return direction === 'cw' ? section.startAngle : section.endAngle;
  }

  /** Every divider angle (normalised), one per section start. */
  boundaries(): number[] {
    return this._sections.map((s) => normalizeDeg(s.startAngle));
  }

  private _layout(): void {
    const total = [...this._weights.values()].reduce((a, b) => a + b, 0);
    let cursor = this.startAngle;
    const out: ResolvedSection[] = [];
    this._configs.forEach((c, index) => {
      const weight = this._weights.get(c.id)!;
      const arc = (360 * weight) / total;
      const start = cursor;
      const end = cursor + arc;
      cursor = end;
      out.push({
        id: c.id,
        index,
        label: c.label ?? c.id,
        value: c.value,
        weight,
        startAngle: start,
        endAngle: end,
        midAngle: (start + end) / 2,
        arc,
        style: this._resolveStyle(c, index),
        tags: c.tags ?? [],
      });
    });
    // Close the ring exactly: rounding may leave the last end a hair off.
    const last = out[out.length - 1];
    last.endAngle = this.startAngle + 360;
    last.arc = last.endAngle - last.startAngle;
    last.midAngle = (last.startAngle + last.endAngle) / 2;
    this._sections = out;
    this._byId = new Map(out.map((s) => [s.id, s]));
  }

  private _resolveStyle(c: WheelSectionConfig, index: number): ResolvedSectionStyle {
    const s = c.style ?? {};
    return {
      fill: s.fill ?? this._palette[index % this._palette.length],
      alpha: s.alpha ?? 1,
      stroke: s.stroke ?? null,
      labelColor: s.labelColor ?? DEFAULT_LABEL_STYLE.labelColor,
      labelSize: s.labelSize ?? DEFAULT_LABEL_STYLE.labelSize,
      labelFont: s.labelFont ?? DEFAULT_LABEL_STYLE.labelFont,
      labelWeight: s.labelWeight ?? DEFAULT_LABEL_STYLE.labelWeight,
      labelOrientation: s.labelOrientation ?? DEFAULT_LABEL_STYLE.labelOrientation,
      labelRadius: s.labelRadius ?? DEFAULT_LABEL_STYLE.labelRadius,
    };
  }
}

/**
 * The wheel-local angle under a pointer, given the disc rotation. A point on
 * the disc at local angle `a` appears on screen at `a + rotation`, so the
 * screen angle `pointer` is over local `pointer - rotation`.
 */
export function localAngleUnderPointer(rotationDeg: number, pointerAngle: number): number {
  return normalizeDeg(pointerAngle - rotationDeg);
}

/** The disc rotation (normalised) that puts local angle `local` under the pointer. */
export function rotationForLocalAngle(local: number, pointerAngle: number): number {
  return normalizeDeg(pointerAngle - local);
}
