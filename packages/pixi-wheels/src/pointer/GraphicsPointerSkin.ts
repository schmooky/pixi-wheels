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
  /**
   * Radius of the pin the flapper is hung on, px. The boss - the round heel
   * the pin sits in - is sized to clear it, so a fat pin gives a heavier
   * looking hinge. Default a little under a quarter of `width`.
   */
  pinRadius?: number;
}

/**
 * Outline the convex hull of two circles: the boss around the pin at the
 * origin, and the tip `L` away. Every shape here is that hull, which is what
 * a flapper hung on a pin actually looks like - a round heel the pin turns
 * in, tapering to whatever the tip is. The far edge of the tip circle lands
 * exactly on `L`, so the pin-to-tip length the ring seats the pointer by is
 * the length you can measure on screen.
 */
function hingedBody(g: Graphics, L: number, boss: number, tip: number): void {
  const centre = Math.max(1, L - tip);
  if (centre <= Math.abs(boss - tip)) {
    // Degenerate: the tip circle is swallowed by the boss. Draw the boss alone.
    g.circle(0, 0, Math.max(boss, tip));
    return;
  }
  const a = Math.asin((boss - tip) / centre);
  const sin = Math.sin(a);
  const cos = Math.cos(a);
  const near = Math.atan2(-cos, -sin); // where the upper tangent leaves a circle
  const far = Math.atan2(cos, -sin); //  and where the lower one does
  g.moveTo(-boss * sin, -boss * cos);
  g.lineTo(centre - tip * sin, -tip * cos);
  g.arc(centre, 0, tip, near, far, false); // round the tip, front first
  g.arc(0, 0, boss, far, near, false); //    round the heel, behind the pin
  g.closePath();
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
    const pinRadius = Math.max(2.5, options.pinRadius ?? width * 0.22);
    // The boss has to hold the pin: never thinner than the pin plus a wall.
    const boss = Math.max(pinRadius * 1.55, shape === 'needle' ? w * 0.5 : w);
    const tip = shape === 'tongue' ? w * 0.2 : Math.max(1.2, w * 0.07);
    hingedBody(g, L, boss, tip);
    g.fill({ color });
    if (outline !== null) g.stroke({ color: outline, width: outlineWidth, join: 'round' });
    if (options.pin ?? true) {
      // A pin, not a dot: a cap with a hole, centred on the axis it turns about.
      g.circle(0, 0, pinRadius).fill({ color: outline ?? 0x000000, alpha: 0.85 });
      g.circle(0, 0, pinRadius * 0.45).fill({ color, alpha: 0.95 });
      if (outline !== null) g.circle(0, 0, pinRadius).stroke({ color: outline, width: Math.max(1, outlineWidth * 0.5) });
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
