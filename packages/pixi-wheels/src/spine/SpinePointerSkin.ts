import { Spine } from '@esotericsoftware/spine-pixi-v8';
import { Container } from 'pixi.js';
import type { PointerSkin } from '../pointer/PointerSkin.js';
import { registerPointerSkin } from '../skins/skinRegistry.js';
import { noticeWarnOnce } from '../utils/notify.js';

export interface SpinePointerSkinOptions {
  skeleton: string;
  atlas: string;
  /** Pin-to-tip distance in pixels after scaling. Required: a skeleton has no obvious "tip". */
  length: number;
  scale?: number;
  skin?: string;
  /** Loops at rest. Default `'idle'`. */
  idleAnimation?: string;
  /** One-shot per divider crossing. Default `'tick'`. */
  tickAnimation?: string;
  /**
   * Which way the art points in the skeleton's setup pose. Default `'up'`
   * (tip toward -y), the way stoppers are usually rigged.
   */
  artDirection?: 'up' | 'right' | 'down' | 'left';
  /** Let the flap spring rotate the skeleton. Default true; set false when the tick animation swings it. */
  flapRotates?: boolean;
}

/**
 * A pointer that is a Spine skeleton: the studio's own stopper, with its
 * tick animation played on every divider crossing.
 */
export class SpinePointerSkin implements PointerSkin {
  readonly view = new Container();
  readonly length: number;
  readonly spine: Spine;
  private readonly _pivot = new Container();
  private readonly _opts: SpinePointerSkinOptions;
  private _isDestroyed = false;

  constructor(options: SpinePointerSkinOptions) {
    this._opts = options;
    this.length = options.length;
    this.spine = Spine.from({ skeleton: options.skeleton, atlas: options.atlas, scale: options.scale ?? 1 });
    if (options.skin) this.spine.skeleton.setSkinByName(options.skin);
    const rot = { up: 90, right: 0, down: -90, left: 180 }[options.artDirection ?? 'up'];
    this.spine.rotation = (rot * Math.PI) / 180;
    this._pivot.addChild(this.spine);
    this.view.addChild(this._pivot);
    const idle = options.idleAnimation ?? 'idle';
    if (this._has(idle)) this.spine.state.setAnimation(0, idle, true);
  }

  setDeflection(deg: number): void {
    if (this._opts.flapRotates ?? true) this._pivot.rotation = (deg * Math.PI) / 180;
  }

  tick(): void {
    const name = this._opts.tickAnimation ?? 'tick';
    if (!this._has(name)) {
      noticeWarnOnce(`spine-pointer-${name}`, `SpinePointerSkin: no animation "${name}" in "${this._opts.skeleton}"; ticks are silent.`);
      return;
    }
    const entry = this.spine.state.setAnimation(1, name, false);
    entry.mixDuration = 0;
    this.spine.state.addEmptyAnimation(1, 0.1, 0);
  }

  private _has(name: string): boolean {
    return this.spine.skeleton.data.animations.some((a) => a.name === name);
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

registerPointerSkin('spine', (config) => {
  const { type: _type, ...options } = config;
  return new SpinePointerSkin(options as unknown as SpinePointerSkinOptions);
});
