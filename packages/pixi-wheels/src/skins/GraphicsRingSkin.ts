import { Container, Graphics } from 'pixi.js';
import type { ResolvedSection } from '../config/types.js';
import { DEG_TO_RAD } from '../utils/angles.js';
import { SectionLabels } from './labels.js';
import type { RingSkin, RingSkinContext } from './RingSkin.js';

export interface GraphicsRingSkinOptions {
  /** Divider lines between sections. `false` for none. */
  dividers?: { width?: number; color?: number; alpha?: number } | false;
  /** The outer rim ring. `false` for none. */
  rim?: { width?: number; color?: number; alpha?: number } | false;
  /** A hub cap over the centre. `false` for none. Default radius 0.14 of the outer radius, or the inner radius if larger. */
  hub?: { radius?: number; color?: number; ringColor?: number; ringWidth?: number } | false;
  /** Soft depth shading (a dark vignette at the rim, a highlight inside). Default true. */
  shading?: boolean;
  /** Draw labels. Default true. */
  labels?: boolean;
  /** Bulbs around the rim: `count` evenly spaced dots. Default none. */
  bulbs?: { count: number; radius?: number; color?: number; inset?: number } | false;
  /** Draw the ring's pegs, the studs the tongue touches, on every divider. Default false. */
  pegs?: boolean | { color?: number; rimColor?: number; alpha?: number };
  /** Highlight colour and alpha used by `highlight(id)`. */
  highlight?: { color?: number; alpha?: number };
}

/**
 * The default look: painted wedges, dividers, a rim, a hub and fitted labels.
 * Good enough to ship a prototype, and every colour comes from the section
 * styles so a config alone changes the palette.
 */
export class GraphicsRingSkin implements RingSkin {
  private readonly _opts: GraphicsRingSkinOptions;
  private _ctx: RingSkinContext | null = null;
  private readonly _wedges = new Graphics();
  private readonly _shade = new Graphics();
  private readonly _lines = new Graphics();
  private readonly _highlightG = new Graphics();
  private readonly _fixed = new Graphics();
  private readonly _labelLayer = new Container();
  private _labels: SectionLabels | null = null;
  private _highlighted: string | null = null;
  private _isDestroyed = false;

  constructor(options: GraphicsRingSkinOptions = {}) {
    this._opts = options;
  }

  attach(ctx: RingSkinContext): void {
    this._ctx = ctx;
    this._wedges.label = 'pixi-wheels:wedges';
    this._labelLayer.label = 'pixi-wheels:labels';
    ctx.disc.addChild(this._wedges, this._shade, this._highlightG, this._lines, this._labelLayer);
    ctx.overlay.addChild(this._fixed);
    if (this._opts.labels ?? true) this._labels = new SectionLabels(this._labelLayer);
    this._drawFixed();
    this.layout();
  }

  layout(): void {
    const ctx = this._ctx;
    if (!ctx) return;
    const { outerRadius: R, innerRadius: r } = ctx;
    const sections = ctx.geometry.sections;
    const g = this._wedges;
    g.clear();
    for (const s of sections) {
      wedgePath(g, s, R, r);
      g.fill({ color: s.style.fill, alpha: s.style.alpha });
      if (s.style.stroke !== null) g.stroke({ color: s.style.stroke, width: 2, alpha: 0.9 });
    }
    this._drawShade();
    this._drawLines(sections);
    this._drawHighlight();
    this._labels?.layout(sections, R, r);
  }

  syncRotation(rotationDeg: number): void {
    this._labels?.syncRotation(rotationDeg);
  }

  highlight(sectionId: string | null): void {
    this._highlighted = sectionId;
    this._drawHighlight();
  }

  private _drawShade(): void {
    const ctx = this._ctx!;
    const { outerRadius: R, innerRadius: r } = ctx;
    const g = this._shade;
    g.clear();
    if (this._opts.shading === false) return;
    // Dark vignette just inside the rim, a lighter band near the hub: a cheap
    // stand-in for a radial gradient that keeps the wedges' colours honest.
    const w = Math.max(6, R * 0.09);
    g.circle(0, 0, R - w / 2).stroke({ color: 0x000000, alpha: 0.22, width: w });
    g.circle(0, 0, R - w * 1.35).stroke({ color: 0x000000, alpha: 0.08, width: w * 0.8 });
    const innerBand = Math.max(r + 4, R * 0.2);
    g.circle(0, 0, innerBand).stroke({ color: 0xffffff, alpha: 0.07, width: Math.max(4, R * 0.06) });
  }

  private _drawLines(sections: readonly ResolvedSection[]): void {
    const ctx = this._ctx!;
    const { outerRadius: R, innerRadius: r } = ctx;
    const g = this._lines;
    g.clear();
    const dividers = this._opts.dividers === false ? null : { width: 3, color: 0xffffff, alpha: 0.85, ...(this._opts.dividers ?? {}) };
    if (dividers) {
      for (const s of sections) {
        const a = s.startAngle * DEG_TO_RAD;
        g.moveTo(Math.cos(a) * r, Math.sin(a) * r).lineTo(Math.cos(a) * R, Math.sin(a) * R);
      }
      g.stroke({ color: dividers.color, width: dividers.width, alpha: dividers.alpha });
    }
    const pegOpt = this._opts.pegs;
    const pegs = ctx.pegs;
    if (pegOpt && pegs) {
      const o = typeof pegOpt === 'object' ? pegOpt : {};
      for (const a of pegs.angles) {
        const rad = a * DEG_TO_RAD;
        g.circle(Math.cos(rad) * pegs.radius, Math.sin(rad) * pegs.radius, pegs.size);
      }
      g.fill({ color: o.color ?? 0xf4f4f4, alpha: o.alpha ?? 1 });
      g.stroke({ color: o.rimColor ?? 0x2a2a2a, width: Math.max(1, pegs.size * 0.25), alpha: 0.7 });
    }
  }

  private _drawHighlight(): void {
    const ctx = this._ctx;
    if (!ctx) return;
    const g = this._highlightG;
    g.clear();
    if (!this._highlighted || !ctx.geometry.has(this._highlighted)) return;
    const s = ctx.geometry.byId(this._highlighted);
    const color = this._opts.highlight?.color ?? 0xffffff;
    const alpha = this._opts.highlight?.alpha ?? 0.35;
    wedgePath(g, s, ctx.outerRadius, ctx.innerRadius);
    g.fill({ color, alpha });
  }

  private _drawFixed(): void {
    const ctx = this._ctx!;
    const { outerRadius: R, innerRadius: r } = ctx;
    const g = this._fixed;
    g.clear();
    const rim = this._opts.rim === false ? null : { width: Math.max(6, R * 0.05), color: 0xffffff, alpha: 1, ...(this._opts.rim ?? {}) };
    if (rim) {
      g.circle(0, 0, R).stroke({ color: rim.color, width: rim.width, alpha: rim.alpha });
      g.circle(0, 0, R + rim.width / 2).stroke({ color: 0x000000, width: 2, alpha: 0.35 });
    }
    const bulbs = this._opts.bulbs;
    if (bulbs && bulbs.count > 0) {
      const br = bulbs.radius ?? Math.max(3, R * 0.018);
      const at = R - (bulbs.inset ?? 0);
      for (let i = 0; i < bulbs.count; i++) {
        const a = (i / bulbs.count) * Math.PI * 2;
        g.circle(Math.cos(a) * at, Math.sin(a) * at, br).fill({ color: bulbs.color ?? 0xfff2b0 });
      }
    }
    const hub = this._opts.hub === false ? null : { ...(this._opts.hub ?? {}) };
    if (hub) {
      const hr = hub.radius ?? Math.max(r, R * 0.14);
      if (hr > 0) {
        g.circle(0, 0, hr).fill({ color: hub.color ?? 0x1c1c22 });
        g.circle(0, 0, hr).stroke({ color: hub.ringColor ?? 0xffffff, width: hub.ringWidth ?? Math.max(3, hr * 0.14) });
        g.circle(0, 0, hr * 0.55).stroke({ color: 0xffffff, width: 1.5, alpha: 0.25 });
      }
    }
  }

  get isDestroyed(): boolean {
    return this._isDestroyed;
  }

  destroy(): void {
    if (this._isDestroyed) return;
    this._isDestroyed = true;
    this._labels?.destroy();
    for (const g of [this._wedges, this._shade, this._lines, this._highlightG, this._fixed, this._labelLayer]) {
      g.parent?.removeChild(g);
      g.destroy({ children: true });
    }
  }
}

/** Trace an annular sector (or a wedge when `innerRadius` is 0). */
export function wedgePath(g: Graphics, s: ResolvedSection, outerRadius: number, innerRadius: number): void {
  const a0 = s.startAngle * DEG_TO_RAD;
  const a1 = s.endAngle * DEG_TO_RAD;
  if (innerRadius <= 0) {
    g.moveTo(0, 0);
    g.arc(0, 0, outerRadius, a0, a1);
    g.lineTo(0, 0);
    g.closePath();
    return;
  }
  g.moveTo(Math.cos(a0) * innerRadius, Math.sin(a0) * innerRadius);
  g.arc(0, 0, outerRadius, a0, a1);
  g.lineTo(Math.cos(a1) * innerRadius, Math.sin(a1) * innerRadius);
  g.arc(0, 0, innerRadius, a1, a0, true);
  g.closePath();
}

