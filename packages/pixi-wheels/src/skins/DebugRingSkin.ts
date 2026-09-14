import { Container, Graphics, Text } from 'pixi.js';
import { DEG_TO_RAD } from '../utils/angles.js';
import { wedgePath } from './GraphicsRingSkin.js';
import type { RingSkin, RingSkinContext } from './RingSkin.js';

/**
 * The plain skin: flat alternating fills, section index and id, the start
 * angle of every section, degree marks on the disc and a line at every
 * pointer. Nothing pretty, everything legible. Use it while wiring a wheel,
 * or as the base of a headless-looking recipe.
 */
export class DebugRingSkin implements RingSkin {
  private _ctx: RingSkinContext | null = null;
  private readonly _g = new Graphics();
  private readonly _hl = new Graphics();
  private readonly _fixed = new Graphics();
  private readonly _labels = new Container();
  private _texts: Text[] = [];
  private _highlighted: string | null = null;
  private _isDestroyed = false;

  attach(ctx: RingSkinContext): void {
    this._ctx = ctx;
    ctx.disc.addChild(this._g, this._hl, this._labels);
    ctx.overlay.addChild(this._fixed);
    const R = ctx.outerRadius;
    const f = this._fixed;
    f.circle(0, 0, R).stroke({ color: 0xffffff, width: 2, alpha: 0.6 });
    for (const p of ctx.pointerAngles) {
      const a = p * DEG_TO_RAD;
      f.moveTo(Math.cos(a) * (R + 14), Math.sin(a) * (R + 14)).lineTo(Math.cos(a) * (R - 30), Math.sin(a) * (R - 30));
      f.stroke({ color: 0xff3b30, width: 3 });
    }
    this.layout();
  }

  layout(): void {
    const ctx = this._ctx;
    if (!ctx) return;
    const { outerRadius: R, innerRadius: r } = ctx;
    const g = this._g;
    g.clear();
    const sections = ctx.geometry.sections;
    // One Text per section, kept between layouts: a dynamic transition lays out every frame.
    while (this._texts.length > sections.length) this._texts.pop()!.destroy();
    while (this._texts.length < sections.length) {
      const t = new Text({
        text: '',
        style: { fontFamily: 'ui-monospace, Menlo, monospace', fontSize: Math.max(9, R * 0.045), fill: 0xe6edf3, align: 'center' },
      });
      t.anchor.set(0.5);
      this._labels.addChild(t);
      this._texts.push(t);
    }
    sections.forEach((s, i) => {
      wedgePath(g, s, R, r);
      g.fill({ color: i % 2 === 0 ? 0x3b4252 : 0x2a2f3a, alpha: 1 });
      g.stroke({ color: 0x9aa3b2, width: 1.5, alpha: 0.9 });
      const mid = s.midAngle * DEG_TO_RAD;
      const lr = r + (R - r) * 0.62;
      const t = this._texts[i];
      t.scale.set(1);
      t.text = `${i} ${s.id}\n${Math.round(s.startAngle)}..${Math.round(s.endAngle)}`;
      t.position.set(Math.cos(mid) * lr, Math.sin(mid) * lr);
      t.rotation = mid + Math.PI / 2;
      const chord = 2 * lr * Math.sin((s.arc * DEG_TO_RAD) / 2);
      if (t.width > chord * 0.95) t.scale.set((chord * 0.95) / t.width);
    });
    // Degree marks every 30 on the disc.
    for (let d = 0; d < 360; d += 30) {
      const a = d * DEG_TO_RAD;
      g.moveTo(Math.cos(a) * (R - 6), Math.sin(a) * (R - 6)).lineTo(Math.cos(a) * R, Math.sin(a) * R);
      g.stroke({ color: 0xffffff, width: 2, alpha: 0.5 });
    }
    this._drawHighlight();
  }

  highlight(sectionId: string | null): void {
    this._highlighted = sectionId;
    this._drawHighlight();
  }

  private _drawHighlight(): void {
    const ctx = this._ctx;
    if (!ctx) return;
    this._hl.clear();
    if (!this._highlighted || !ctx.geometry.has(this._highlighted)) return;
    wedgePath(this._hl, ctx.geometry.byId(this._highlighted), ctx.outerRadius, ctx.innerRadius);
    this._hl.fill({ color: 0x30d158, alpha: 0.35 });
  }

  get isDestroyed(): boolean {
    return this._isDestroyed;
  }

  destroy(): void {
    if (this._isDestroyed) return;
    this._isDestroyed = true;
    for (const t of this._texts) t.destroy();
    for (const c of [this._g, this._hl, this._fixed, this._labels]) {
      c.parent?.removeChild(c);
      c.destroy({ children: true });
    }
  }
}

