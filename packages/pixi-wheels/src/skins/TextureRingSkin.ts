import { Container, Sprite, type Texture } from 'pixi.js';
import { DEG_TO_RAD } from '../utils/angles.js';
import { SectionLabels } from './labels.js';
import type { RingSkin, RingSkinContext } from './RingSkin.js';
import { registerRingSkin } from './skinRegistry.js';

export interface TextureRingDecoration {
  /** Section id this decoration belongs to. It follows the section when weights change. */
  section: string;
  texture: Texture;
  /** Where along the radius, 0..1 of the outer radius. Default 0.7. */
  radius?: number;
  /** `'radial'` (default) rotates with the section angle, `'none'` keeps the texture's own orientation. */
  orientation?: 'radial' | 'none';
  /** Extra rotation in degrees. */
  rotationOffset?: number;
  scale?: number;
}

export interface TextureRingSkinOptions {
  /** The painted disc. Centred and rotated with the wheel. */
  face: Texture;
  /** Rotate the face so its section 0 lines up with the ring's `startAngle`. Degrees. Default 0. */
  faceRotation?: number;
  /** Scale the face so its width equals twice the outer radius. Default true. */
  fitToRadius?: boolean;
  /** A texture that does not rotate: a frame, bulbs, a bezel. Centred on the ring. */
  frame?: Texture;
  frameScale?: number;
  /** Per-section sprites positioned by geometry (value plates, icons). */
  decorations?: TextureRingDecoration[];
  /** Also draw text labels from the section configs. Default false: the face usually carries them. */
  labels?: boolean;
}

/**
 * A skin for a pre-rendered wheel: the game's own painted disc as one
 * texture, an optional static frame, and optional per-section sprites that
 * the geometry keeps centred. Sections stay logical (weights, ids, values):
 * the engine still knows where each one is, it just does not paint them.
 */
export class TextureRingSkin implements RingSkin {
  private readonly _opts: TextureRingSkinOptions;
  private _ctx: RingSkinContext | null = null;
  private readonly _face: Sprite;
  private _frame: Sprite | null = null;
  private readonly _decoLayer = new Container();
  private readonly _labelLayer = new Container();
  private _decos: Array<{ cfg: TextureRingDecoration; sprite: Sprite }> = [];
  private _labels: SectionLabels | null = null;
  private _isDestroyed = false;

  constructor(options: TextureRingSkinOptions) {
    this._opts = options;
    this._face = new Sprite(options.face);
    this._face.anchor.set(0.5);
  }

  attach(ctx: RingSkinContext): void {
    this._ctx = ctx;
    const R = ctx.outerRadius;
    if (this._opts.fitToRadius ?? true) {
      const w = this._face.texture.width || 1;
      this._face.scale.set((2 * R) / w);
    }
    this._face.rotation = (this._opts.faceRotation ?? 0) * DEG_TO_RAD;
    ctx.disc.addChild(this._face, this._decoLayer, this._labelLayer);
    if (this._opts.frame) {
      this._frame = new Sprite(this._opts.frame);
      this._frame.anchor.set(0.5);
      this._frame.scale.set(this._opts.frameScale ?? 1);
      ctx.overlay.addChild(this._frame);
    }
    for (const cfg of this._opts.decorations ?? []) {
      const sprite = new Sprite(cfg.texture);
      sprite.anchor.set(0.5);
      sprite.scale.set(cfg.scale ?? 1);
      this._decoLayer.addChild(sprite);
      this._decos.push({ cfg, sprite });
    }
    if (this._opts.labels) this._labels = new SectionLabels(this._labelLayer);
    this.layout();
  }

  layout(): void {
    const ctx = this._ctx;
    if (!ctx) return;
    const R = ctx.outerRadius;
    for (const { cfg, sprite } of this._decos) {
      if (!ctx.geometry.has(cfg.section)) {
        sprite.visible = false;
        continue;
      }
      sprite.visible = true;
      const s = ctx.geometry.byId(cfg.section);
      const mid = s.midAngle * DEG_TO_RAD;
      const radius = R * (cfg.radius ?? 0.7);
      sprite.position.set(Math.cos(mid) * radius, Math.sin(mid) * radius);
      const base = (cfg.orientation ?? 'radial') === 'radial' ? mid + Math.PI / 2 : 0;
      sprite.rotation = base + (cfg.rotationOffset ?? 0) * DEG_TO_RAD;
    }
    this._labels?.layout(ctx.geometry.sections, R, ctx.innerRadius);
  }

  syncRotation(rotationDeg: number): void {
    this._labels?.syncRotation(rotationDeg);
  }

  /** The face sprite, for tinting or swapping the texture at run time. */
  get face(): Sprite {
    return this._face;
  }

  get frame(): Sprite | null {
    return this._frame;
  }

  get isDestroyed(): boolean {
    return this._isDestroyed;
  }

  destroy(): void {
    if (this._isDestroyed) return;
    this._isDestroyed = true;
    this._labels?.destroy();
    for (const c of [this._face, this._decoLayer, this._labelLayer, this._frame]) {
      if (!c) continue;
      c.parent?.removeChild(c);
      c.destroy({ children: true });
    }
  }
}

registerRingSkin('texture', (config, assets) => {
  const { type: _type, face, frame, decorations, ...rest } = config as unknown as RingSkinConfigTexture;
  return new TextureRingSkin({
    ...rest,
    face: assets.texture(face),
    frame: frame ? assets.texture(frame) : undefined,
    decorations: (decorations ?? []).map((d) => ({ ...d, texture: assets.texture(d.texture) })),
  });
});

/** The serialised form of {@link TextureRingSkinOptions}: textures by asset key. */
export interface RingSkinConfigTexture {
  type: 'texture';
  face: string;
  faceRotation?: number;
  fitToRadius?: boolean;
  frame?: string;
  frameScale?: number;
  decorations?: Array<Omit<TextureRingDecoration, 'texture'> & { texture: string }>;
  labels?: boolean;
}
