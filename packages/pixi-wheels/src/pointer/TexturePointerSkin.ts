import { Container, Sprite, type Texture } from 'pixi.js';
import type { PointerSkin } from './PointerSkin.js';

export interface TexturePointerSkinOptions {
  texture: Texture;
  /**
   * Which way the art points in the source image. Default `'up'` (tip at the
   * top edge), the way most pointer sprites are drawn.
   */
  artDirection?: 'up' | 'right' | 'down' | 'left';
  /**
   * The pin position in the texture as fractions of its size. Default
   * `{ x: 0.5, y: 0.85 }` for `'up'` art (near the base). Rotated along with
   * `artDirection` when left unset.
   */
  pin?: { x: number; y: number };
  /** Uniform scale applied to the sprite. Default 1. */
  scale?: number;
  /**
   * Pin-to-tip distance after scaling. Defaults to the distance from the pin
   * to the texture edge the tip is on.
   */
  length?: number;
}

/** A pointer that is a sprite. Bring the game's own stopper art. */
export class TexturePointerSkin implements PointerSkin {
  readonly view = new Container();
  readonly length: number;
  private readonly _pivot = new Container();
  private readonly _sprite: Sprite;
  private _isDestroyed = false;

  constructor(options: TexturePointerSkinOptions) {
    const dir = options.artDirection ?? 'up';
    const scale = options.scale ?? 1;
    const sprite = new Sprite(options.texture);
    this._sprite = sprite;
    const w = sprite.texture.width;
    const h = sprite.texture.height;
    const defaultPin = { up: { x: 0.5, y: 0.85 }, down: { x: 0.5, y: 0.15 }, right: { x: 0.15, y: 0.5 }, left: { x: 0.85, y: 0.5 } }[dir];
    const pin = options.pin ?? defaultPin;
    sprite.anchor.set(pin.x, pin.y);
    sprite.scale.set(scale);
    // Rotate the art so its tip points along local +x.
    const rot = { up: 90, right: 0, down: -90, left: 180 }[dir];
    sprite.rotation = (rot * Math.PI) / 180;
    const tipDistance = { up: pin.y * h, down: (1 - pin.y) * h, right: (1 - pin.x) * w, left: pin.x * w }[dir];
    this.length = options.length ?? tipDistance * scale;
    this._pivot.addChild(sprite);
    this.view.addChild(this._pivot);
  }

  get sprite(): Sprite {
    return this._sprite;
  }

  setDeflection(deg: number): void {
    this._pivot.rotation = (deg * Math.PI) / 180;
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
