import { Spine, type Bone } from '@esotericsoftware/spine-pixi-v8';
import { Container } from 'pixi.js';
import type { ResolvedSection } from '../config/types.js';
import type { RingSkin, RingSkinContext } from '../skins/RingSkin.js';
import { SectionLabels } from '../skins/labels.js';
import { registerRingSkin } from '../skins/skinRegistry.js';
import { noticeWarnOnce } from '../utils/notify.js';

export interface SpineRingSkinAnimations {
  /** Loops while nothing happens. Default `'idle'`. */
  idle?: string;
  /** Loops from `spin:start` to `spin:stopping`. Default `'spin'`. */
  spin?: string;
  /** Loops while decelerating. Default none (keeps `spin`). */
  stopping?: string;
  /** One-shot on landing, then idle. Default `'win'`. */
  win?: string;
  /** Per-section landing animation, by section id. Overrides `win`. */
  winBySection?: Record<string, string>;
}

export interface SpineRingSkinOptions {
  /** Alias the skeleton was loaded under with `Assets`. */
  skeleton: string;
  /** Alias the atlas was loaded under. */
  atlas: string;
  /**
   * The bone that rotates with the wheel. When set, the skeleton stays fixed
   * (frame, bulbs, stopper keep still) and only this bone turns. When unset,
   * the whole skeleton rotates with the disc.
   */
  bone?: string;
  /** Spine skin to apply. */
  skin?: string;
  scale?: number;
  animations?: SpineRingSkinAnimations;
  /** Track the wheel animations play on. Default 0. Landing one-shots use track 1. */
  track?: number;
  /**
   * Also draw the sections' labels (text or `content`) on the disc, above the
   * skeleton. Default false: authored art usually carries its own. Turn it on
   * for values the skeleton cannot know, like server-driven multipliers.
   */
  labels?: boolean;
}

/**
 * A ring drawn by a Spine skeleton. The wheel disc is a bone the engine
 * rotates; the skeleton's own animations carry glow loops, bulb chases and
 * landing celebrations, wired to the spin events by name.
 *
 * Import from `pixi-wheels/spine`; the runtime is a peer dependency.
 */
export class SpineRingSkin implements RingSkin {
  readonly spine: Spine;
  private readonly _opts: SpineRingSkinOptions;
  private readonly _anims: Required<Omit<SpineRingSkinAnimations, 'stopping' | 'winBySection'>> & Pick<SpineRingSkinAnimations, 'stopping' | 'winBySection'>;
  private _bone: Bone | null = null;
  private _labels: SectionLabels | null = null;
  private readonly _labelLayer = new Container();
  private _rotation = 0;
  private _ctx: RingSkinContext | null = null;
  private _isDestroyed = false;

  constructor(options: SpineRingSkinOptions) {
    this._opts = options;
    this._anims = {
      idle: options.animations?.idle ?? 'idle',
      spin: options.animations?.spin ?? 'spin',
      win: options.animations?.win ?? 'win',
      stopping: options.animations?.stopping,
      winBySection: options.animations?.winBySection,
    };
    this.spine = Spine.from({ skeleton: options.skeleton, atlas: options.atlas, scale: options.scale ?? 1 });
    if (options.skin) this.spine.skeleton.setSkinByName(options.skin);
    if (options.bone) {
      const bone = this.spine.skeleton.findBone(options.bone);
      if (!bone) {
        throw new Error(
          `SpineRingSkin: bone "${options.bone}" not found in skeleton "${options.skeleton}". ` +
            `Bones: ${this.spine.skeleton.bones.map((b) => b.data.name).join(', ')}.`,
        );
      }
      this._bone = bone;
      // Apply the wheel rotation after the animation state, before world
      // transforms, so a keyed bone still follows the engine.
      this.spine.beforeUpdateWorldTransforms = () => {
        if (this._bone) this._bone.rotation = -this._rotation;
      };
    }
  }

  attach(ctx: RingSkinContext): void {
    this._ctx = ctx;
    if (this._bone) ctx.overlay.addChildAt(this.spine, 0);
    else ctx.disc.addChild(this.spine);
    if (this._opts.labels) {
      this._labelLayer.label = 'pixi-wheels:labels';
      // A bone-driven skeleton sits on the overlay, above the disc; the labels
      // go above it and are turned by hand so they stay on their plates.
      if (this._bone) ctx.overlay.addChild(this._labelLayer);
      else ctx.disc.addChild(this._labelLayer);
      this._labels = new SectionLabels(this._labelLayer);
      this.layout();
    }
    this._play(this._anims.idle, true);
  }

  layout(): void {
    // Spine art is authored; dynamic sections are not reflected in the skeleton, labels follow them.
    const ctx = this._ctx;
    if (ctx && this._labels) this._labels.layout(ctx.geometry.sections, ctx.outerRadius, ctx.innerRadius);
  }

  syncRotation(rotationDeg: number): void {
    this._rotation = rotationDeg;
    if (this._bone) this._labelLayer.angle = rotationDeg;
    this._labels?.syncRotation(rotationDeg);
  }

  /** The label layer, when `labels` is on. */
  get labels(): SectionLabels | null {
    return this._labels;
  }

  onSpinStart(): void {
    this._play(this._anims.spin, true);
  }

  onSpinStop(): void {
    if (this._anims.stopping) this._play(this._anims.stopping, true);
  }

  onLanded(section: ResolvedSection): void {
    const name = this._anims.winBySection?.[section.id] ?? this._anims.win;
    if (!this._has(name)) {
      this._play(this._anims.idle, true);
      return;
    }
    const track = (this._opts.track ?? 0) + 1;
    this.spine.state.setAnimation(track, name, false);
    this.spine.state.addEmptyAnimation(track, 0.2, 0);
    this._play(this._anims.idle, true);
  }

  /** Play any animation on the wheel track. Missing names are skipped with one warning. */
  play(name: string, loop = false): void {
    this._play(name, loop);
  }

  private _has(name: string): boolean {
    return this.spine.skeleton.data.animations.some((a) => a.name === name);
  }

  private _play(name: string, loop: boolean): void {
    if (!this._has(name)) {
      noticeWarnOnce(`spine-anim-${name}`, `SpineRingSkin: skeleton "${this._opts.skeleton}" has no animation "${name}"; skipped.`);
      return;
    }
    this.spine.state.setAnimation(this._opts.track ?? 0, name, loop);
  }

  get isDestroyed(): boolean {
    return this._isDestroyed;
  }

  destroy(): void {
    if (this._isDestroyed) return;
    this._isDestroyed = true;
    this._labels?.destroy();
    this._labelLayer.parent?.removeChild(this._labelLayer);
    this._labelLayer.destroy();
    this.spine.parent?.removeChild(this.spine);
    this.spine.destroy();
  }
}

registerRingSkin('spine', (config) => {
  const { type: _type, ...options } = config;
  return new SpineRingSkin(options as unknown as SpineRingSkinOptions);
});
