import { Container, Graphics, Text, Ticker } from 'pixi.js';
import type { Wheel } from '../core/Wheel.js';
import type { Ring } from '../core/Ring.js';
import { DEG_TO_RAD, normalizeDeg } from '../utils/angles.js';
import type { Disposable } from '../utils/Disposable.js';
import { TickerRef } from '../utils/TickerRef.js';

/**
 * Overlay layers.
 *   - `sections`  divider lines, section ids and start angles, drawn on the disc.
 *   - `pointers`  a line at every pointer angle plus its local angle.
 *   - `pegs`      the pegs the tongues touch, the peg being ridden, and each tongue's contact zone.
 *   - `target`    the landing angle of the current result, on the disc.
 *   - `hud`       state, rotation, speed, current leg, section under the pointer.
 */
export type DebugOverlayLayer = 'sections' | 'pointers' | 'pegs' | 'target' | 'hud';

export interface DebugOverlayOptions {
  layers?: DebugOverlayLayer[] | 'all';
  /** Redraw every tick. Default true. */
  live?: boolean;
  /** Ticker for the live redraw. Default `Ticker.shared`; pass the wheel's own to stay in step. */
  ticker?: Ticker;
  /**
   * Where the HUD text sits. `'inside'` (default) pins it to the top-left of
   * the ring's bounding square, so a canvas fitted to the wheel never crops
   * it. `'below'` puts it under the wheel; re-fit the canvas after enabling.
   */
  hud?: 'inside' | 'below';
}

export interface DebugOverlayHandle extends Disposable {
  redraw(): void;
  setLayers(layers: DebugOverlayLayer[] | 'all'): void;
}

export const OVERLAY_LABEL = 'pixi-wheels:debugOverlay';
const ALL: readonly DebugOverlayLayer[] = ['sections', 'pointers', 'pegs', 'target', 'hud'];

/**
 * Draw the wheel's invisible geometry over it: dividers with angles, pointer
 * lines, the planned landing angle and a text HUD per ring. Everything a
 * developer stares at the canvas to guess is written out.
 */
export function debugOverlay(wheel: Wheel, options: DebugOverlayOptions = {}): DebugOverlayHandle {
  let layers = new Set<DebugOverlayLayer>(options.layers === undefined || options.layers === 'all' ? ALL : options.layers);
  const perRing = wheel.rings.map((ring) => {
    const disc = new Graphics();
    disc.label = `${OVERLAY_LABEL}:disc:${ring.id}`;
    const fixed = new Graphics();
    fixed.label = `${OVERLAY_LABEL}:fixed:${ring.id}`;
    const labels = new Container();
    const hud = new Text({ text: '', style: { fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 13, fill: 0xffffff, lineHeight: 16 } });
    const hudBack = new Graphics();
    ring.disc.addChild(disc, labels);
    ring.overlay.addChild(fixed, hudBack, hud);
    return { ring, disc, fixed, labels, hud, hudBack, texts: [] as Text[] };
  });
  let destroyed = false;

  const drawRing = (e: (typeof perRing)[number]): void => {
    const { ring, disc, fixed, labels, hud, hudBack } = e;
    const R = ring.outerRadius;
    const r = ring.innerRadius;
    disc.clear();
    fixed.clear();
    for (const t of e.texts) t.destroy();
    e.texts = [];
    labels.removeChildren();
    if (layers.has('sections')) {
      for (const s of ring.sections) {
        const a = s.startAngle * DEG_TO_RAD;
        disc.moveTo(Math.cos(a) * r, Math.sin(a) * r).lineTo(Math.cos(a) * (R + 10), Math.sin(a) * (R + 10));
        disc.stroke({ color: 0x32ade6, width: 2, alpha: 0.9 });
        const t = new Text({ text: `${s.id} ${Math.round(normalizeDeg(s.startAngle))}`, style: { fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 10, fill: 0x9be7ff } });
        t.anchor.set(0, 0.5);
        const la = (s.startAngle + 1.5) * DEG_TO_RAD;
        t.position.set(Math.cos(la) * (R + 12), Math.sin(la) * (R + 12));
        t.rotation = la;
        labels.addChild(t);
        e.texts.push(t);
      }
    }
    if (layers.has('target')) {
      const target = ring.controller.target;
      if (target) {
        const a = target.landingAngle * DEG_TO_RAD;
        disc.moveTo(Math.cos(a) * (r + 4), Math.sin(a) * (r + 4)).lineTo(Math.cos(a) * (R - 2), Math.sin(a) * (R - 2));
        disc.stroke({ color: 0xffcc00, width: 3 });
        disc.circle(Math.cos(a) * (R - 12), Math.sin(a) * (R - 12), 6).fill({ color: 0xffcc00 });
      }
    }
    if (layers.has('pointers')) {
      for (const p of ring.pointers) {
        const a = p.angle * DEG_TO_RAD;
        fixed.moveTo(Math.cos(a) * (R + 24), Math.sin(a) * (R + 24)).lineTo(Math.cos(a) * (r + 2), Math.sin(a) * (r + 2));
        fixed.stroke({ color: 0xff3b30, width: 2, alpha: 0.85 });
      }
    }
    const pegs = ring.pegs;
    if (layers.has('pegs') && pegs) {
      const ridden = new Set(ring.pointers.map((p) => p.engagedPeg).filter((i): i is number => i !== null));
      pegs.angles.forEach((deg, i) => {
        const a = deg * DEG_TO_RAD;
        disc.circle(Math.cos(a) * pegs.radius, Math.sin(a) * pegs.radius, pegs.size);
        if (ridden.has(i)) disc.fill({ color: 0xff2d95, alpha: 0.9 });
        disc.stroke({ color: 0x32ade6, width: 1.5, alpha: 0.95 });
      });
      for (const p of ring.pointers) {
        if (!p.flap) continue;
        // The contact zone: where a peg centre starts pushing the tongue and where it lets go.
        const c = p.contactHalfWidth(pegs);
        const half = c / pegs.radius;
        const a = p.angle * DEG_TO_RAD;
        fixed.moveTo(Math.cos(a - half) * pegs.radius, Math.sin(a - half) * pegs.radius).arc(0, 0, pegs.radius, a - half, a + half);
        fixed.stroke({ color: 0xff2d95, width: Math.max(3, pegs.size), alpha: 0.35 });
      }
    }
    if (layers.has('hud')) {
      const c = ring.controller;
      const leg = c.legs[c.currentLegIndex];
      const under = ring.pointers[0] ? ring.sectionUnderPointer().id : '-';
      const tongue = ring.pointers[0];
      const flapLine = tongue?.flap
        ? `flap ${tongue.deflection.toFixed(1)} deg${tongue.engagedPeg !== null ? `  on peg ${tongue.engagedPeg}` : ''}`
        : null;
      const lines = [
        `ring ${ring.id}  ${c.state}${c.isIdling ? ' (idle)' : ''}`,
        `rot ${normalizeDeg(ring.rotationDeg).toFixed(1)}  speed ${ring.speed.toFixed(0)} deg/s`,
        `under pointer: ${under}`,
        c.target ? `target: ${c.target.section.id} @ ${c.target.landingAngle.toFixed(1)}` : 'target: -',
        leg ? `leg ${c.currentLegIndex + 1}/${c.legs.length} ${leg.kind} ${leg.distance.toFixed(0)}deg ${Math.round(leg.duration)}ms` : 'leg: -',
        ring.step !== null ? `step ${ring.step}/${ring.stepCount - 1}` : '',
      ].filter((l) => l !== '');
      if (flapLine) lines.push(flapLine);
      hud.text = lines.join('\n');
      hud.visible = true;
      const pad = 6;
      // A fixed plate width keeps the overlay's bounds stable while the lines change length.
      const plateW = Math.max(hud.width + pad * 2, Math.min(2 * R, 300));
      const plateH = hud.height + pad * 2;
      const x = -R;
      const y = (options.hud ?? 'inside') === 'below' ? R + 16 : -R;
      hud.position.set(x + pad, y + pad);
      hudBack.clear();
      hudBack.roundRect(x, y, plateW, plateH, 6).fill({ color: 0x000000, alpha: 0.72 });
    } else {
      hud.visible = false;
      hudBack.clear();
    }
  };

  const redraw = (): void => {
    if (destroyed) return;
    for (const e of perRing) drawRing(e);
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
        for (const t of e.texts) t.destroy();
        for (const c of [e.disc, e.fixed, e.labels, e.hud, e.hudBack]) {
          c.parent?.removeChild(c);
          c.destroy({ children: true });
        }
      }
    },
  };
}

/** For tests: the debug graphics a ring currently carries. */
export function overlayNodesOn(ring: Ring): Container[] {
  return [...ring.disc.children, ...ring.overlay.children].filter((c) => (c.label ?? '').startsWith(OVERLAY_LABEL));
}
