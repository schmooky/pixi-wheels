import { Container, Graphics, Text, Ticker } from 'pixi.js';
import type { Wheel } from '../core/Wheel.js';
import type { Ring } from '../core/Ring.js';
import { DEG_TO_RAD, normalizeDeg } from '../utils/angles.js';
import type { Disposable } from '../utils/Disposable.js';
import { noticeWarnOnce } from '../utils/notify.js';
import { TickerRef } from '../utils/TickerRef.js';

/**
 * Overlay layers.
 *   - `sections`  divider lines on the disc, plus an upright pill just inside the rim with each section's id and start angle.
 *   - `pointers`  a marker at every pointer angle and a pill with the local angle under it.
 *   - `pegs`      the pegs the tongues touch, the peg being ridden, and each tongue's contact zone.
 *   - `target`    the landing angle of the current result: a line on the disc and a pill naming it.
 *   - `hud`       a panel per ring in screen space: state, rotation, speed, current leg, section under the pointer, flap.
 *
 * Text is drawn at a constant screen size whatever scale the wheel is shown
 * at, on dark pills that read on any background.
 */
export type DebugOverlayLayer = 'sections' | 'pointers' | 'pegs' | 'target' | 'hud';

/**
 * Where the HUD panel goes, in screen pixels on the wheel's root container
 * (the stage). Corners on the right or bottom need `screen`; `{ x, y }` pins
 * it exactly; `false` draws no panel.
 */
export type DebugHudPlacement = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | { x: number; y: number } | false;

export interface DebugOverlayOptions {
  layers?: DebugOverlayLayer[] | 'all';
  /** Redraw every tick. Default true. */
  live?: boolean;
  /** Ticker for the live redraw. Default `Ticker.shared`; pass the wheel's own to stay in step. */
  ticker?: Ticker;
  /** HUD placement. Default `'top-left'`. */
  hud?: DebugHudPlacement;
  /** The canvas size, for right and bottom placements: `app.screen` is live and does. */
  screen?: { width: number; height: number };
  /** Screen-pixel size of the overlay text. Default 12. */
  fontSize?: number;
}

export interface DebugOverlayHandle extends Disposable {
  redraw(): void;
  setLayers(layers: DebugOverlayLayer[] | 'all'): void;
}

export const OVERLAY_LABEL = 'pixi-wheels:debugOverlay';
const ALL: readonly DebugOverlayLayer[] = ['sections', 'pointers', 'pegs', 'target', 'hud'];
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const INK = 0xffffff;
const PANEL = 0x0b0d12;
const CYAN = 0x32ade6;
const RED = 0xff453a;
const GOLD = 0xffcc00;
const PINK = 0xff2d95;

/** A small upright label on a dark plate, drawn at a constant screen size. */
class Pill extends Container {
  private readonly _back = new Graphics();
  private readonly _text: Text;

  constructor(fontSize: number) {
    super();
    this._text = new Text({ text: '', style: { fontFamily: MONO, fontSize, fill: INK, lineHeight: Math.round(fontSize * 1.25) } });
    this._text.anchor.set(0.5);
    this.addChild(this._back, this._text);
  }

  set(text: string, accent: number, worldScale: number): void {
    this._text.text = text;
    const w = this._text.width + 10;
    const h = this._text.height + 4;
    this._back.clear();
    this._back.roundRect(-w / 2, -h / 2, w, h, 4).fill({ color: PANEL, alpha: 0.86 }).stroke({ color: accent, width: 1, alpha: 0.9 });
    this.scale.set(1 / worldScale);
    this.visible = true;
  }

  /** Half the plate height in wheel px at the given scale, to keep pills off the rim. */
  halfHeight(worldScale: number): number {
    return (this._text.height + 4) / 2 / worldScale;
  }
}

/** A HUD panel for one ring, in screen space. */
class Panel extends Container {
  private readonly _back = new Graphics();
  private readonly _text: Text;

  constructor(fontSize: number) {
    super();
    this._text = new Text({ text: '', style: { fontFamily: MONO, fontSize, fill: INK, lineHeight: Math.round(fontSize * 1.35) } });
    this._text.position.set(10, 7);
    this.addChild(this._back, this._text);
  }

  set(lines: string[]): { width: number; height: number } {
    this._text.text = lines.join('\n');
    const w = this._text.width + 20;
    const h = this._text.height + 14;
    this._back.clear();
    this._back.roundRect(0, 0, w, h, 8).fill({ color: PANEL, alpha: 0.86 }).stroke({ color: INK, width: 1, alpha: 0.14 });
    return { width: w, height: h };
  }
}

function worldScaleOf(node: Container): number {
  const m = node.worldTransform;
  const s = Math.sqrt(m.a * m.a + m.b * m.b);
  return s > 1e-6 ? s : 1;
}

function rootOf(node: Container): Container {
  let n = node;
  while (n.parent) n = n.parent;
  return n;
}

/**
 * Draw the wheel's invisible geometry over it: dividers with their angles,
 * pointer markers with the local angle under them, the pegs and the tongue's
 * contact, the planned landing angle, and a HUD panel per ring. Everything a
 * developer stares at the canvas to guess is written out, at a readable size
 * whatever scale the wheel is drawn at.
 */
export function debugOverlay(wheel: Wheel, options: DebugOverlayOptions = {}): DebugOverlayHandle {
  let layers = new Set<DebugOverlayLayer>(options.layers === undefined || options.layers === 'all' ? ALL : options.layers);
  const fontSize = options.fontSize ?? 12;
  const perRing = wheel.rings.map((ring) => {
    const disc = new Graphics();
    disc.label = `${OVERLAY_LABEL}:disc:${ring.id}`;
    const fixed = new Graphics();
    fixed.label = `${OVERLAY_LABEL}:fixed:${ring.id}`;
    const pills = new Container();
    pills.label = `${OVERLAY_LABEL}:pills:${ring.id}`;
    ring.disc.addChild(disc);
    ring.overlay.addChild(fixed, pills);
    return { ring, disc, fixed, pills, pool: [] as Pill[], used: 0, panel: new Panel(fontSize) };
  });
  const hudRoot = new Container();
  hudRoot.label = `${OVERLAY_LABEL}:hud`;
  for (const e of perRing) hudRoot.addChild(e.panel);
  let destroyed = false;

  const pill = (e: (typeof perRing)[number]): Pill => {
    let p = e.pool[e.used];
    if (!p) {
      p = new Pill(fontSize);
      e.pool.push(p);
      e.pills.addChild(p);
    }
    e.used++;
    return p;
  };
  const place = (p: Pill, screenDeg: number, radius: number): void => {
    const a = screenDeg * DEG_TO_RAD;
    p.position.set(Math.cos(a) * radius, Math.sin(a) * radius);
  };

  const drawRing = (e: (typeof perRing)[number]): void => {
    const { ring, disc, fixed } = e;
    const R = ring.outerRadius;
    const r = ring.innerRadius;
    const ws = worldScaleOf(ring.overlay);
    const px = (n: number): number => n / ws; // screen px expressed in wheel px
    const rotation = ring.visualRotationDeg;
    disc.clear();
    fixed.clear();
    e.used = 0;

    if (layers.has('sections')) {
      const sections = ring.sections;
      const every = Math.max(1, Math.ceil(sections.length / 24));
      sections.forEach((s, i) => {
        const a = s.startAngle * DEG_TO_RAD;
        disc.moveTo(Math.cos(a) * r, Math.sin(a) * r).lineTo(Math.cos(a) * R, Math.sin(a) * R);
        disc.stroke({ color: CYAN, width: px(1.5), alpha: 0.95 });
        if (i % every !== 0) return;
        const p = pill(e);
        p.set(`${s.id} ${Math.round(normalizeDeg(s.startAngle))}`, CYAN, ws);
        // Just inside the rim: a canvas fitted to the wheel never crops it.
        place(p, s.startAngle + rotation, R - px(10) - p.halfHeight(ws));
      });
    }
    if (layers.has('target')) {
      const target = ring.controller.target;
      if (target) {
        const a = target.landingAngle * DEG_TO_RAD;
        disc.moveTo(Math.cos(a) * (r + px(4)), Math.sin(a) * (r + px(4))).lineTo(Math.cos(a) * (R - px(2)), Math.sin(a) * (R - px(2)));
        disc.stroke({ color: GOLD, width: px(2.5), alpha: 0.95 });
        disc.circle(Math.cos(a) * (R - px(10)), Math.sin(a) * (R - px(10)), px(5)).fill({ color: GOLD });
        const p = pill(e);
        p.set(`target ${target.section.id} ${target.landingAngle.toFixed(1)}`, GOLD, ws);
        place(p, target.landingAngle + rotation, R - px(66) - p.halfHeight(ws));
      }
    }
    if (layers.has('pointers')) {
      for (const ptr of ring.pointers) {
        const a = ptr.angle * DEG_TO_RAD;
        // The pointer's real body: pin to tip, the same span the art covers,
        // swung by the deflection so the mark lies along the drawn tongue
        // instead of being a stub near the rim.
        const pinX = Math.cos(a) * ptr.pinRadius;
        const pinY = Math.sin(a) * ptr.pinRadius;
        const rest = ptr.facing === 'inward' ? a + Math.PI : a;
        const swung = rest + ptr.deflection * DEG_TO_RAD;
        const len = ptr.skin.length;
        fixed.moveTo(pinX, pinY).lineTo(Math.cos(a) * ptr.tipRadius, Math.sin(a) * ptr.tipRadius);
        fixed.stroke({ color: RED, width: px(1.5), alpha: 0.35 });
        fixed.moveTo(pinX, pinY).lineTo(pinX + Math.cos(swung) * len, pinY + Math.sin(swung) * len);
        fixed.stroke({ color: RED, width: px(2), alpha: 0.95 });
        fixed.circle(pinX, pinY, px(3.5)).fill({ color: RED, alpha: 0.95 });
        const p = pill(e);
        p.set(`${ptr.id} ${ring.localAngleUnderPointer(ptr.id).toFixed(1)}`, RED, ws);
        place(p, ptr.angle, R - px(38) - p.halfHeight(ws));
      }
    }
    const pegs = ring.pegs;
    if (layers.has('pegs') && pegs) {
      const ridden = new Set(ring.pointers.map((ptr) => ptr.engagedPeg).filter((i): i is number => i !== null));
      pegs.angles.forEach((deg, i) => {
        const a = deg * DEG_TO_RAD;
        disc.circle(Math.cos(a) * pegs.radius, Math.sin(a) * pegs.radius, pegs.size);
        if (ridden.has(i)) disc.fill({ color: PINK, alpha: 0.9 });
        disc.stroke({ color: CYAN, width: px(1.5), alpha: 0.95 });
      });
      for (const ptr of ring.pointers) {
        if (!ptr.flap) continue;
        const c = ptr.contactHalfWidth(pegs);
        const half = c / pegs.radius;
        const a = ptr.angle * DEG_TO_RAD;
        fixed.moveTo(Math.cos(a - half) * pegs.radius, Math.sin(a - half) * pegs.radius).arc(0, 0, pegs.radius, a - half, a + half);
        fixed.stroke({ color: PINK, width: Math.max(px(3), pegs.size), alpha: 0.3 });
      }
    }
    for (let i = e.used; i < e.pool.length; i++) e.pool[i].visible = false;

    if (layers.has('hud') && options.hud !== false) {
      const c = ring.controller;
      const leg = c.legs[c.currentLegIndex];
      const under = ring.pointers[0] ? ring.sectionUnderPointer().id : '-';
      const tongue = ring.pointers[0];
      const lines = [
        `ring ${ring.id}  ${c.state}${c.isIdling ? ' (idle)' : ''}`,
        `rot ${normalizeDeg(ring.rotationDeg).toFixed(1)}  speed ${ring.speed.toFixed(0)} deg/s`,
        `under pointer  ${under}`,
        c.target ? `target  ${c.target.section.id} @ ${c.target.landingAngle.toFixed(1)}` : 'target  -',
        leg ? `leg ${c.currentLegIndex + 1}/${c.legs.length}  ${leg.kind} ${leg.distance.toFixed(0)} deg ${Math.round(leg.duration)} ms` : 'leg  -',
        ring.step !== null ? `step ${ring.step}/${ring.stepCount - 1}` : '',
        tongue?.flap ? `flap ${tongue.deflection.toFixed(1)} deg${tongue.engagedPeg !== null ? `  on peg ${tongue.engagedPeg}` : ''}` : '',
        ring.dragDeg !== 0 ? `drag ${ring.dragDeg.toFixed(2)} deg held` : '',
      ].filter((l) => l !== '');
      e.panel.visible = true;
      e.panel.set(lines);
    } else {
      e.panel.visible = false;
    }
  };

  const placeHud = (): void => {
    if (!layers.has('hud') || options.hud === false) {
      hudRoot.visible = false;
      return;
    }
    hudRoot.visible = true;
    const root = rootOf(wheel);
    if (hudRoot.parent !== root) root.addChild(hudRoot);
    let y = 0;
    let width = 0;
    for (const e of perRing) {
      if (!e.panel.visible) continue;
      e.panel.position.set(0, y);
      const b = e.panel.getLocalBounds();
      y += b.height + 8;
      width = Math.max(width, b.width);
    }
    const height = Math.max(0, y - 8);
    const margin = 8;
    const placement = options.hud ?? 'top-left';
    if (typeof placement === 'object') {
      hudRoot.position.set(placement.x, placement.y);
      return;
    }
    const screen = options.screen;
    const needsScreen = placement !== 'top-left';
    if (needsScreen && !screen) {
      noticeWarnOnce('debug-hud-screen', `debugOverlay: hud '${placement}' needs the \`screen\` option (pass app.screen); using 'top-left'.`);
    }
    const right = screen && (placement === 'top-right' || placement === 'bottom-right');
    const bottom = screen && (placement === 'bottom-left' || placement === 'bottom-right');
    hudRoot.position.set(right && screen ? screen.width - width - margin : margin, bottom && screen ? screen.height - height - margin : margin);
  };

  const redraw = (): void => {
    if (destroyed) return;
    for (const e of perRing) drawRing(e);
    placeHud();
  };
  redraw();

  let tickerRef: TickerRef | null = null;
  if (options.live ?? true) {
    tickerRef = new TickerRef(options.ticker ?? Ticker.shared);
    tickerRef.add(redraw);
  }

  return {
    redraw,
    setLayers(next) {
      layers = new Set(next === 'all' ? ALL : next);
      redraw();
    },
    get isDestroyed() {
      return destroyed;
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      tickerRef?.destroy();
      for (const e of perRing) {
        for (const c of [e.disc, e.fixed, e.pills]) {
          c.parent?.removeChild(c);
          c.destroy({ children: true });
        }
      }
      hudRoot.parent?.removeChild(hudRoot);
      hudRoot.destroy({ children: true });
    },
  };
}

/** For tests: the debug graphics a ring currently carries. */
export function overlayNodesOn(ring: Ring): Container[] {
  return [...ring.disc.children, ...ring.overlay.children].filter((c) => (c.label ?? '').startsWith(OVERLAY_LABEL));
}
