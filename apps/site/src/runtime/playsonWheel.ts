import { Assets, Container, Sprite, type Texture } from 'pixi.js';
import { DEG_TO_RAD, type ResolvedSection, type RingSkin, type RingSkinContext } from 'pixi-wheels';
import { parseSpineAtlas, texturesFromAtlas } from './spineAtlas.ts';

/**
 * The Playson "Four Charged Clovers: Super Wheel" art, used with permission.
 * One Spine-format atlas over three sheets in `public/playson-wheel/`; the
 * game's own skeleton did not survive the capture, so the wheel is
 * composed here from the sheet's parts.
 *
 * Useful region groups:
 *   `wheel/<mini|minor|major>/<x>_sector`, `wheel/coin_sector_1`,
 *   `wheel/<collect|multi|mystery>/<x>_sector_bg` (+ `_bavel`) - 12 wedge plates, 154x297
 *   `wheel/frame_parts/frame_back_01..12` - the bezel, one piece per 30 degrees
 *   `wheel/divider`, `wheel/bulb`, `wheel/bulb_active`, `wheel/center`
 *   `wheel/stopper`, `wheel/stopper_shadow` - the pointer
 *   `wheel/<mini|minor|major>/<x>_title` - the tier plates, `wheel/x` - the multiplier x
 */
export interface PlaysonWheelArt {
  textures: Record<string, Texture>;
}

let cached: Promise<PlaysonWheelArt> | null = null;

export function loadPlaysonWheel(base = '/playson-wheel/'): Promise<PlaysonWheelArt> {
  if (cached) return cached;
  cached = (async () => {
    const atlasText = await (await fetch(`${base}wheel.atlas`)).text();
    const atlas = parseSpineAtlas(atlasText);
    const pages: Record<string, Texture> = {};
    await Promise.all(
      atlas.pages.map(async (p) => {
        pages[p.name] = await Assets.load<Texture>(`${base}${p.name}`);
      }),
    );
    return { textures: texturesFromAtlas(atlas, pages) };
  })();
  return cached;
}

export type PlaysonPlate = 'mini' | 'minor' | 'major' | 'coin' | 'collect' | 'multi' | 'mystery';

export const PLAYSON_PLATES: readonly PlaysonPlate[] = ['mini', 'minor', 'major', 'coin', 'collect', 'multi', 'mystery'];

/** The authored radius of the sector plates: their tip is the hub, their top edge the rim. */
export const PLAYSON_PLATE_RADIUS = 297;

export interface PlaysonWheelSkinOptions {
  art: PlaysonWheelArt;
  /** Which plate a section shows. Defaults to a match on the section's id / value / tags. */
  plateFor?: (section: ResolvedSection) => PlaysonPlate;
  /** Draw the tier title plates and the multiplier `x` on coin sections. Default true. */
  titles?: boolean;
  /** Bulbs on the bezel: alternate on every `bulbBlinkMs`. Default 420; 0 to keep them still. */
  bulbBlinkMs?: number;
}

const PLATE_REGION: Record<PlaysonPlate, { base: string; bevel?: string; title?: string }> = {
  mini: { base: 'wheel/mini/mini_sector', title: 'wheel/mini/mini_title' },
  minor: { base: 'wheel/minor/minor_sector', title: 'wheel/minor/minor_title' },
  major: { base: 'wheel/major/major_sector', title: 'wheel/major/major_title' },
  coin: { base: 'wheel/coin_sector_1' },
  collect: { base: 'wheel/collect/collect_sector_bg', bevel: 'wheel/collect/collect_sector_bavel' },
  multi: { base: 'wheel/multi/multi_sector_bg', bevel: 'wheel/multi/multi_sector_bavel' },
  mystery: { base: 'wheel/mystery/mystery_sector_bg', bevel: 'wheel/mystery/mystery_sector_bavel' },
};

function defaultPlate(section: ResolvedSection): PlaysonPlate {
  const hay = `${section.id} ${String(section.value ?? '')} ${section.tags.join(' ')}`.toLowerCase();
  for (const p of PLAYSON_PLATES) if (hay.includes(p)) return p;
  return 'coin';
}

/**
 * The Playson wheel as a ring skin: twelve authored wedge plates, the bezel
 * pieces, dividers, bulbs and hub. The plates are painted for a 30-degree
 * wedge, so the ring must have exactly 12 equal sections; the skin throws
 * otherwise instead of stretching the art.
 */
export class PlaysonWheelSkin implements RingSkin {
  private readonly _opts: PlaysonWheelSkinOptions;
  private _ctx: RingSkinContext | null = null;
  private readonly _plates = new Container();
  private readonly _titles = new Container();
  private readonly _bezel = new Container();
  private readonly _bulbs: Sprite[] = [];
  private _highlight: Sprite | null = null;
  private _blinkMs = 0;
  private _blinkPhase = 0;
  private _isDestroyed = false;

  constructor(options: PlaysonWheelSkinOptions) {
    this._opts = options;
  }

  attach(ctx: RingSkinContext): void {
    this._ctx = ctx;
    const n = ctx.geometry.count;
    if (n !== 12 || ctx.geometry.sections.some((s) => Math.abs(s.arc - 30) > 0.01)) {
      throw new Error(`PlaysonWheelSkin: the plates are painted for 12 equal sections; this ring has ${n} (arcs ${ctx.geometry.sections.map((s) => Math.round(s.arc)).join(', ')}).`);
    }
    const t = this._opts.art.textures;
    const R = ctx.outerRadius;
    const k = R / PLAYSON_PLATE_RADIUS;
    const tex = (name: string): Texture => {
      const x = t[name];
      if (!x) throw new Error(`PlaysonWheelSkin: region "${name}" is not in the atlas.`);
      return x;
    };
    // Plates: apex at the hub, top edge on the rim, one per section.
    for (const s of ctx.geometry.sections) {
      const plate = (this._opts.plateFor ?? defaultPlate)(s);
      const def = PLATE_REGION[plate];
      const mid = s.midAngle * DEG_TO_RAD;
      const base = new Sprite(tex(def.base));
      base.anchor.set(0.5, 1);
      base.scale.set(k);
      base.rotation = mid + Math.PI / 2;
      this._plates.addChild(base);
      if (def.bevel) {
        const bevel = new Sprite(tex(def.bevel));
        bevel.anchor.set(0.5, 1);
        bevel.scale.set(k);
        bevel.rotation = mid + Math.PI / 2;
        this._plates.addChild(bevel);
      }
      if ((this._opts.titles ?? true) && def.title) {
        const title = new Sprite(tex(def.title));
        title.anchor.set(0.5);
        title.scale.set(k * 0.95);
        const r = R * 0.72;
        title.position.set(Math.cos(mid) * r, Math.sin(mid) * r);
        title.rotation = mid + Math.PI / 2;
        this._titles.addChild(title);
      }
      if ((this._opts.titles ?? true) && plate === 'coin' && typeof s.value === 'number') {
        const x = new Sprite(tex('wheel/x'));
        x.anchor.set(0.5);
        x.scale.set(k);
        const r = R * 0.62;
        x.position.set(Math.cos(mid) * r, Math.sin(mid) * r);
        x.rotation = mid + Math.PI / 2;
        this._titles.addChild(x);
      }
    }
    // Dividers on every boundary.
    for (const s of ctx.geometry.sections) {
      const a = s.startAngle * DEG_TO_RAD;
      const d = new Sprite(tex('wheel/divider'));
      d.anchor.set(0.5, 1);
      d.scale.set(k);
      const r = R * 0.98;
      d.position.set(Math.cos(a) * r, Math.sin(a) * r);
      d.rotation = a + Math.PI / 2;
      this._plates.addChild(d);
    }
    ctx.disc.addChild(this._plates, this._titles);

    // Bezel: twelve unrotated pieces, each the bounding box of a 30-degree arc of the frame ring.
    const r1 = 282.4 * k;
    const r2 = 316.8 * k;
    for (let i = 0; i < 12; i++) {
      const name = `wheel/frame_parts/frame_back_${String(i + 1).padStart(2, '0')}`;
      const region = t[name];
      if (!region) continue;
      const centerDeg = -90 + i * 30;
      const bb = arcBounds(r1, r2, centerDeg - 15, centerDeg + 15);
      const sp = new Sprite(region);
      sp.anchor.set(0.5);
      sp.scale.set(k);
      sp.position.set((bb.minX + bb.maxX) / 2, (bb.minY + bb.maxY) / 2);
      this._bezel.addChild(sp);
    }
    // Bulbs on the bezel ring, one per divider and one per section middle.
    const bulbOn = tex('wheel/bulb_active');
    const bulbOff = tex('wheel/bulb');
    for (let i = 0; i < 24; i++) {
      const a = (-90 + i * 15) * DEG_TO_RAD;
      const b = new Sprite(i % 2 === 0 ? bulbOn : bulbOff);
      b.anchor.set(0.5);
      b.scale.set(k);
      const r = (r1 + r2) / 2;
      b.position.set(Math.cos(a) * r, Math.sin(a) * r);
      this._bezel.addChild(b);
      this._bulbs.push(b);
    }
    const hub = new Sprite(tex('wheel/center'));
    hub.anchor.set(0.5);
    hub.scale.set(k);
    this._bezel.addChild(hub);
    ctx.overlay.addChild(this._bezel);
    this._blinkMs = this._opts.bulbBlinkMs ?? 420;
  }

  layout(): void {
    // Authored art: fixed 12 x 30 degrees.
  }

  /** Called by the ring every frame; used for the bulb chase. */
  syncRotation(_rotationDeg: number): void {
    if (this._blinkMs <= 0 || this._bulbs.length === 0) return;
    const phase = Math.floor(performance.now() / this._blinkMs) % 2;
    if (phase === this._blinkPhase) return;
    this._blinkPhase = phase;
    const on = this._opts.art.textures['wheel/bulb_active'];
    const off = this._opts.art.textures['wheel/bulb'];
    this._bulbs.forEach((b, i) => {
      b.texture = (i + phase) % 2 === 0 ? on : off;
    });
  }

  highlight(sectionId: string | null): void {
    const ctx = this._ctx;
    if (!ctx) return;
    if (this._highlight) {
      this._highlight.destroy();
      this._highlight = null;
    }
    if (!sectionId || !ctx.geometry.has(sectionId)) return;
    const s = ctx.geometry.byId(sectionId);
    const glow = new Sprite(this._opts.art.textures['wheel/sector_glow']);
    glow.anchor.set(0.5, 1);
    const k = ctx.outerRadius / PLAYSON_PLATE_RADIUS;
    glow.scale.set(k);
    glow.rotation = s.midAngle * DEG_TO_RAD + Math.PI / 2;
    glow.blendMode = 'add';
    this._titles.addChild(glow);
    this._highlight = glow;
  }

  onLanded(section: ResolvedSection): void {
    this.highlight(section.id);
  }

  onSpinStart(): void {
    this.highlight(null);
  }

  get isDestroyed(): boolean {
    return this._isDestroyed;
  }

  destroy(): void {
    if (this._isDestroyed) return;
    this._isDestroyed = true;
    for (const c of [this._plates, this._titles, this._bezel]) {
      c.parent?.removeChild(c);
      c.destroy({ children: true });
    }
  }
}

/** Axis-aligned bounds of an annular sector between two radii and two angles (degrees). */
function arcBounds(r1: number, r2: number, a0: number, a1: number): { minX: number; maxX: number; minY: number; maxY: number } {
  const pts: Array<[number, number]> = [];
  const push = (r: number, deg: number) => pts.push([Math.cos(deg * DEG_TO_RAD) * r, Math.sin(deg * DEG_TO_RAD) * r]);
  for (const r of [r1, r2]) {
    push(r, a0);
    push(r, a1);
    // Axis crossings inside the arc bulge the box out to the full radius.
    for (const axis of [-360, -270, -180, -90, 0, 90, 180, 270, 360]) if (axis > a0 && axis < a1) push(r, axis);
  }
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

/** The twelve sections the Playson wheel is painted for, in the game's order. */
export const PLAYSON_SECTIONS = [
  { id: 'mini', label: 'MINI', tags: ['mini'] },
  { id: 'x2', label: 'x2', value: 2, tags: ['coin'] },
  { id: 'collect', label: 'COLLECT', tags: ['collect'] },
  { id: 'x5', label: 'x5', value: 5, tags: ['coin'] },
  { id: 'minor', label: 'MINOR', tags: ['minor'] },
  { id: 'x3', label: 'x3', value: 3, tags: ['coin'] },
  { id: 'mystery', label: 'MYSTERY', tags: ['mystery'] },
  { id: 'x10', label: 'x10', value: 10, tags: ['coin'] },
  { id: 'major', label: 'MAJOR', tags: ['major'] },
  { id: 'x2b', label: 'x2', value: 2, tags: ['coin'] },
  { id: 'multi', label: 'MULTI', tags: ['multi'] },
  { id: 'x8', label: 'x8', value: 8, tags: ['coin'] },
];
