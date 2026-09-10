import { Spine } from '@esotericsoftware/spine-pixi-v8';
import { Assets, BitmapText, Container, FillGradient, Sprite, Text, type Texture } from 'pixi.js';
import { DEG_TO_RAD, type LabelContext, type ResolvedSection, type RingSkin, type RingSkinContext, SectionLabels } from 'pixi-wheels';

/**
 * Pragmatic Play's "Wheel of Happiness" (used with permission), as the game
 * draws it: twelve gold-framed plates fanned round the golden dragon hub, red
 * for WILD WINS and green for FREE SPINS, dim variants for the plates that did
 * not win, the gem-tipped pointer reading from six o'clock, and the game's
 * own `whh_wheel_fx` Spine skeleton for the ring flare on activation and the
 * selection frames that pulse on the landed plate. Served from
 * `public/pragmatic-wheel/`.
 */
export interface PragmaticWheelArt {
  hub: Texture;
  pointer: Texture;
  logo: Texture;
  plates: { red: Texture; green: Texture; redDim: Texture; greenDim: Texture };
  /** Asset aliases of the selection-effects skeleton and its atlas. */
  fx: { skeleton: string; atlas: string };
  /** Bitmap font family of the gold digits and the `+`, from the game. */
  digitsFont: string;
}

/** Authored geometry, px: the plates' apex sits `hubRadius` from the centre and reaches the rim. */
export const PRAGMATIC_RADIUS = { hub: 232, plate: 313, outer: 232 + 313 } as const;

let cached: Promise<PragmaticWheelArt> | null = null;

export function loadPragmaticWheel(base = '/pragmatic-wheel/'): Promise<PragmaticWheelArt> {
  if (cached) return cached;
  cached = (async () => {
    const fx = { skeleton: 'pragmaticWheelFxSkeleton', atlas: 'pragmaticWheelFxAtlas' };
    const [hub, pointer, logo, red, green, redDim, greenDim] = await Promise.all(
      ['hub', 'pointer', 'logo', 'plate_red', 'plate_green', 'plate_red_dim', 'plate_green_dim'].map((n) => Assets.load<Texture>(`${base}${n}.webp`)),
    );
    await Assets.load([
      { alias: fx.skeleton, src: `${base}spine/whh_wheel_fx.json` },
      { alias: fx.atlas, src: `${base}spine/whh_wheel_fx.atlas` },
      { alias: 'pragmaticDigits', src: `${base}fonts/impact.fnt` },
    ]);
    return { hub, pointer, logo, plates: { red, green, redDim, greenDim }, fx, digitsFont: 'impact' };
  })();
  return cached;
}

/** The twelve plates in the game's order: pairs of WILD WINS and FREE SPINS. */
export const PRAGMATIC_SECTIONS = Array.from({ length: 12 }, (_, i) => {
  const free = i % 4 >= 2;
  return { id: `${free ? 'free' : 'wild'}-${i}`, label: free ? 'FREE SPINS' : 'WILD WINS', tags: [free ? 'free' : 'wild'] };
});

const goldFill = () =>
  new FillGradient({
    type: 'linear',
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
    textureSpace: 'local',
    colorStops: [
      { offset: 0, color: 0xfff6b8 },
      { offset: 0.45, color: 0xffd23f },
      { offset: 0.55, color: 0xf0a41c },
      { offset: 1, color: 0xffe066 },
    ],
  });

/**
 * A plate's label as the game sets it: two lines of gold Impact-style text
 * with the top toward the hub, and the bitmap `+` at the wide end. Built as a
 * `content` factory so the label layer places and fits it.
 */
export function pragmaticPlateLabel(art: PragmaticWheelArt): (ctx: LabelContext) => Container {
  return (ctx) => {
    const view = new Container();
    const size = Math.round(ctx.slot.width * 0.44);
    const text = new Text({
      text: ctx.section.label.replace(' ', '\n'),
      style: {
        fontFamily: 'Impact, Haettenschweiler, "Arial Narrow Bold", "Helvetica Neue", sans-serif',
        fontSize: size,
        fontWeight: '900',
        align: 'center',
        lineHeight: size * 0.95,
        fill: goldFill(),
        stroke: { color: 0x4a0d06, width: Math.max(2, size * 0.13), join: 'round' },
        dropShadow: { color: 0x000000, alpha: 0.55, blur: 2, distance: size * 0.06, angle: Math.PI / 2 },
      },
    });
    text.anchor.set(0.5);
    text.position.set(0, -ctx.slot.height * 0.04);
    const plus = new BitmapText({ text: '+', style: { fontFamily: art.digitsFont, fontSize: size * 0.9 } });
    plus.anchor.set(0.5);
    plus.position.set(0, ctx.slot.height * 0.36);
    view.addChild(text, plus);
    ctx.fit(view);
    return view;
  };
}

export interface PragmaticWheelSkinOptions {
  art: PragmaticWheelArt;
  /** Which plate colour a section gets. Defaults to green for `free` tags, red otherwise. */
  plateFor?: (section: ResolvedSection) => 'red' | 'green';
  /** Dim every plate but the winner on landing, restore on the next spin. Default true. */
  dimLosers?: boolean;
  /** Play the game's Spine effects: ring flare on spin start, selection pulse on the winner. Default true. */
  effects?: boolean;
  /** Draw the sections' labels or `content`. Default true. */
  labels?: boolean;
}

/**
 * The Wheel of Happiness as a ring skin. The plates are painted for a
 * 30-degree wedge, so the ring must have exactly 12 equal sections.
 */
export class PragmaticWheelSkin implements RingSkin {
  private readonly _opts: PragmaticWheelSkinOptions;
  private _ctx: RingSkinContext | null = null;
  private readonly _plates = new Container();
  private readonly _labelLayer = new Container();
  private readonly _fixed = new Container();
  private _plateSprites = new Map<string, { sprite: Sprite; colour: 'red' | 'green' }>();
  private _labels: SectionLabels | null = null;
  private _fxHub: Spine | null = null;
  private _fxSelect: Spine | null = null;
  private _isDestroyed = false;

  constructor(options: PragmaticWheelSkinOptions) {
    this._opts = options;
  }

  attach(ctx: RingSkinContext): void {
    this._ctx = ctx;
    const n = ctx.geometry.count;
    if (n !== 12 || ctx.geometry.sections.some((s) => Math.abs(s.arc - 30) > 0.01)) {
      throw new Error(`PragmaticWheelSkin: the plates are painted for 12 equal sections; this ring has ${n}.`);
    }
    const art = this._opts.art;
    const k = ctx.outerRadius / PRAGMATIC_RADIUS.outer;
    for (const s of ctx.geometry.sections) {
      const colour = (this._opts.plateFor ?? defaultColour)(s);
      const sprite = new Sprite(colour === 'red' ? art.plates.red : art.plates.green);
      // The plate image has its narrow end at the top: seat that on the hub edge, wide end out.
      sprite.anchor.set(0.5, 0);
      sprite.scale.set(k);
      const mid = s.midAngle * DEG_TO_RAD;
      sprite.position.set(Math.cos(mid) * PRAGMATIC_RADIUS.hub * k, Math.sin(mid) * PRAGMATIC_RADIUS.hub * k);
      sprite.rotation = mid - Math.PI / 2;
      this._plates.addChild(sprite);
      this._plateSprites.set(s.id, { sprite, colour });
    }
    ctx.disc.addChild(this._plates);
    if (this._opts.labels ?? true) {
      this._labelLayer.label = 'pixi-wheels:labels';
      ctx.disc.addChild(this._labelLayer);
      this._labels = new SectionLabels(this._labelLayer);
      this._labels.layout(ctx.geometry.sections, ctx.outerRadius, ctx.innerRadius);
    }
    const hub = new Sprite(art.hub);
    hub.anchor.set(0.5);
    hub.scale.set(k);
    this._fixed.addChild(hub);
    ctx.overlay.addChild(this._fixed);

    if (this._opts.effects ?? true) {
      // Two instances of the game's effects skeleton: one flares round the hub,
      // one rides the disc on the landed plate.
      this._fxHub = Spine.from({ skeleton: art.fx.skeleton, atlas: art.fx.atlas });
      // The ring frames are 2600 units across; fit them to the hub ring.
      this._fxHub.scale.set((art.hub.width * 1.08 * k) / 2600);
      this._fixed.addChild(this._fxHub);
      this._fxSelect = Spine.from({ skeleton: art.fx.skeleton, atlas: art.fx.atlas });
      // The selection frames are 1008 units tall; a little larger than the plate they crown.
      this._fxSelect.scale.set((PRAGMATIC_RADIUS.plate * 1.32 * k) / 1008);
      this._fxSelect.visible = false;
      ctx.disc.addChild(this._fxSelect);
    }
  }

  layout(): void {
    const ctx = this._ctx;
    if (ctx && this._labels) this._labels.layout(ctx.geometry.sections, ctx.outerRadius, ctx.innerRadius);
  }

  syncRotation(rotationDeg: number): void {
    this._labels?.syncRotation(rotationDeg);
  }

  onSpinStart(): void {
    const art = this._opts.art;
    for (const { sprite, colour } of this._plateSprites.values()) sprite.texture = colour === 'red' ? art.plates.red : art.plates.green;
    if (this._fxHub) {
      this._fxHub.state.setAnimation(0, 'wheel_active', false);
      this._fxHub.state.addAnimation(0, 'wheel_loop', true, 0);
    }
    if (this._fxSelect?.visible) {
      const fx = this._fxSelect;
      fx.state.setAnimation(0, 'wheel_out', false);
      fx.state.addEmptyAnimation(0, 0, 0);
      setTimeout(() => {
        if (!this._isDestroyed) fx.visible = false;
      }, 300);
    }
  }

  onLanded(section: ResolvedSection): void {
    const ctx = this._ctx;
    if (!ctx) return;
    if (this._opts.dimLosers ?? true) {
      const art = this._opts.art;
      for (const [id, { sprite, colour }] of this._plateSprites) {
        if (id === section.id) continue;
        sprite.texture = colour === 'red' ? art.plates.redDim : art.plates.greenDim;
      }
    }
    if (this._fxHub) this._fxHub.state.setEmptyAnimation(0, 0.4);
    if (this._fxSelect) {
      const k = ctx.outerRadius / PRAGMATIC_RADIUS.outer;
      const mid = section.midAngle * DEG_TO_RAD;
      const r = (PRAGMATIC_RADIUS.hub + PRAGMATIC_RADIUS.plate / 2) * k;
      this._fxSelect.position.set(Math.cos(mid) * r, Math.sin(mid) * r);
      this._fxSelect.rotation = mid - Math.PI / 2;
      this._fxSelect.visible = true;
      this._fxSelect.state.setAnimation(0, 'wheel_selection', false);
      this._fxSelect.state.addAnimation(0, 'wheel_selection_loop', true, 0);
    }
  }

  /** The label layer, for callers that want a section's content. */
  get labels(): SectionLabels | null {
    return this._labels;
  }

  get isDestroyed(): boolean {
    return this._isDestroyed;
  }

  destroy(): void {
    if (this._isDestroyed) return;
    this._isDestroyed = true;
    this._labels?.destroy();
    for (const c of [this._plates, this._labelLayer, this._fixed]) {
      c.parent?.removeChild(c);
      c.destroy({ children: true });
    }
    if (this._fxSelect) {
      this._fxSelect.parent?.removeChild(this._fxSelect);
      this._fxSelect.destroy();
    }
  }
}

function defaultColour(section: ResolvedSection): 'red' | 'green' {
  return section.tags.includes('free') ? 'green' : 'red';
}
