import type { Container, Text } from 'pixi.js';
import type { LabelOrientation } from '../config/types.js';
import { DEG_TO_RAD } from './angles.js';

/**
 * How content meets the box it is fitted into.
 *
 *   - `'contain'`: the whole content stays inside the box (default).
 *   - `'cover'`: the content fills the box, overflowing on one axis.
 *   - `'width'` / `'height'`: match one axis only.
 *   - `'none'`: leave the content at scale 1.
 */
export type FitMode = 'contain' | 'cover' | 'width' | 'height' | 'none';

export interface Size {
  width: number;
  height: number;
}

export interface FitOptions {
  /** How the content meets the box. Default `'contain'`. */
  mode?: FitMode;
  /**
   * Upper bound for the scale. Default 1: content shrinks to fit and is never
   * enlarged, so a label authored at the right size stays crisp. Pass
   * `Infinity` to also grow small content into the room it has.
   */
  max?: number;
  /** Fraction of the box kept free on each side, 0 to 0.49. Default 0. */
  padding?: number;
}

/** The scale factor that fits `size` into `box` under `options`. Pure; no PixiJS objects. */
export function scaleToFit(size: Size, box: Size, options: FitOptions = {}): number {
  const mode = options.mode ?? 'contain';
  if (mode === 'none') return 1;
  const inset = 1 - 2 * Math.min(0.49, Math.max(0, options.padding ?? 0));
  const bw = Math.max(0, box.width * inset);
  const bh = Math.max(0, box.height * inset);
  const w = Math.max(1e-6, size.width);
  const h = Math.max(1e-6, size.height);
  const sx = bw / w;
  const sy = bh / h;
  const raw = mode === 'contain' ? Math.min(sx, sy) : mode === 'cover' ? Math.max(sx, sy) : mode === 'width' ? sx : sy;
  const s = Number.isFinite(raw) && raw > 0 ? raw : 0;
  return Math.min(options.max ?? 1, s);
}

/**
 * Scale any container (a Text, a Sprite, a Spine, a group) so its local
 * bounds fit `box`. Sets `obj.scale` uniformly and returns the factor. Measure
 * happens on the unscaled local bounds, so calling it again is idempotent.
 */
export function fitContainer(obj: Container, box: Size, options: FitOptions = {}): number {
  const b = obj.getLocalBounds();
  const s = scaleToFit({ width: b.width, height: b.height }, box, options);
  obj.scale.set(s);
  return s;
}

/**
 * Fit a `Text` by lowering its font size instead of scaling its transform, so
 * glyphs stay sharp. Leaves the scale at 1. Returns the font size it settled
 * on. Up to four measure passes; `minFontSize` (default 6) is the floor.
 */
export function fitText(text: Text, box: Size, options: FitOptions & { minFontSize?: number } = {}): number {
  const min = options.minFontSize ?? 6;
  let size = Number(text.style.fontSize) || 24;
  text.scale.set(1);
  for (let i = 0; i < 4; i++) {
    text.style.fontSize = size;
    const s = scaleToFit({ width: text.width, height: text.height }, box, { ...options, max: 1 });
    if (s >= 0.999) break;
    const next = Math.max(min, Math.floor(size * s));
    if (next === size) break;
    size = next;
  }
  text.style.fontSize = size;
  return size;
}

/** Straight-line width across an arc of `arcDeg` degrees at `radius`. */
export function chordAt(radius: number, arcDeg: number): number {
  return 2 * radius * Math.sin(Math.min(Math.PI, (arcDeg * DEG_TO_RAD) / 2));
}

/** The room a label has inside its wedge. `width`/`height` are the fit box, oriented like the label. */
export interface LabelSlot {
  /** Distance from the hub to the label's centre, px. */
  radius: number;
  /** Straight-line room across the wedge at `radius`, minus the margin. */
  chord: number;
  /** Room along the radius, centred on `radius`, inside the ring band. */
  radial: number;
  /** Fit box width in the label's own orientation: along the radius for `'radial'`, along the chord otherwise. */
  width: number;
  /** Fit box height, the other axis. */
  height: number;
}

export interface LabelSlotOptions {
  /** Where the label centre sits, as a fraction of the outer radius. Default 0.68. */
  radius?: number;
  /** Orientation the box is expressed in. Default `'radial'`. */
  orientation?: LabelOrientation;
  /** Fraction of the chord kept free at both dividers. Default 0.08. */
  margin?: number;
}

/**
 * Compute the box a section offers a label at a given radius: the chord across
 * the wedge there, and the radial room between hub and rim around that point.
 * `SectionLabels` uses it for every label; use it yourself to size custom
 * content in a `content` factory or a skin.
 */
export function labelSlot(section: { arc: number }, outerRadius: number, innerRadius: number, options: LabelSlotOptions = {}): LabelSlot {
  const frac = options.radius ?? 0.68;
  const radius = outerRadius * frac;
  const margin = Math.min(0.49, Math.max(0, options.margin ?? 0.08));
  const chord = chordAt(radius, section.arc) * (1 - 2 * margin);
  const inner = Math.max(0, innerRadius);
  const radial = Math.max(4, 2 * Math.min(radius - inner, outerRadius - radius) * 0.96);
  const orientation = options.orientation ?? 'radial';
  const radialFirst = orientation === 'radial';
  return {
    radius,
    chord,
    radial,
    width: radialFirst ? radial : chord,
    height: radialFirst ? chord : radial,
  };
}
