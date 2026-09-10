import { Container, Graphics } from 'pixi.js';
import type { PointerSkin } from './PointerSkin.js';

export interface GraphicsPointerSkinOptions {
  /** Pin-to-tip distance. Default 72. */
  length?: number;
  /** Widest part. Default 36. */
  width?: number;
  /** Fill colour. Default 0xffffff. */
  color?: number;
  /** Outline colour, or `null` for none. Default 0x1a1a1a. */
  outline?: number | null;
  outlineWidth?: number;
  /**
   * `'tongue'` (default) is a rounded flapper, `'triangle'` a plain arrow,
   * `'needle'` a thin indicator with a round pin.
   */
  shape?: 'tongue' | 'triangle' | 'needle';
  /** Draw the pin cap at the base. Default true. */
  pin?: boolean;
}

/** A pointer drawn with `Graphics`. The out-of-the-box tongue. */
export class GraphicsPointerSkin implements PointerSkin {
  readonly view = new Container();
  readonly length: number;
  private readonly _body = new Graphics();
  private _isDestroyed = false;

  constructor(options: GraphicsPointerSkinOptions = {}) {
    this.length = options.length ?? 72;
    const width = options.width ?? 36;
    const color = options.color ?? 0xffffff;
    const outline = options.outline === undefined ? 0x1a1a1a : options.outline;
    const outlineWidth = options.outlineWidth ?? 3;
    const shape = options.shape ?? 'tongue';
    const g = this._body;
    const L = this.length;
    const w = width / 2;
    if (shape === 'triangle') {
      g.moveTo(-w * 0.4, -w).lineTo(L, 0).lineTo(-w * 0.4, w).closePath();
    } else if (shape === 'needle') {
      g.moveTo(0, -w * 0.25).lineTo(L, 0).lineTo(0, w * 0.25).closePath();
    } else {
      // Tongue: a rounded base tapering to a soft point.
      g.moveTo(-w * 0.9, 0);
      g.bezierCurveTo(-w * 0.9, -w, 0, -w, w * 0.6, -w * 0.85);
      g.bezierCurveTo(L * 0.55, -w * 0.55, L * 0.85, -w * 0.2, L, 0);
      g.bezierCurveTo(L * 0.85, w * 0.2, L * 0.55, w * 0.55, w * 0.6, w * 0.85);
      g.bezierCurveTo(0, w, -w * 0.9, w, -w * 0.9, 0);
      g.closePath();
    }
    g.fill({ color });
    if (outline !== null) g.stroke({ color: outline, width: outlineWidth, join: 'round' });
    if (options.pin ?? true) {
      g.circle(0, 0, Math.max(3, w * 0.32)).fill({ color: outline ?? 0x000000, alpha: 0.85 });
      g.circle(0, 0, Math.max(1.5, w * 0.16)).fill({ color, alpha: 0.9 });
    }
    this.view.addChild(g);
  }

  setDeflection(deg: number): void {
    this._body.rotation = (deg * Math.PI) / 180;
  }

  get isDestroyed(): boolean {
    return this._isDestroyed;
  }

  destroy(): void {
    if (this._isDestroyed) return;
    this._isDestroyed = true;
    this.view.destroy({ children: true });
  }
}
