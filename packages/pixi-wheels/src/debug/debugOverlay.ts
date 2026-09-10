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
 *   - `target`    the landing angle of the current result, on the disc.
 *   - `hud`       state, rotation, speed, current leg, section under the pointer.
 */
export type DebugOverlayLayer = 'sections' | 'pointers' | 'target' | 'hud';

export interface DebugOverlayOptions {
  layers?: DebugOverlayLayer[] | 'all';
  /** Redraw every tick. Default true. */
  live?: boolean;
  /** Ticker for the live redraw. Default `Ticker.shared`; pass the wheel's own to stay in step. */
  ticker?: Ticker;
}

export interface DebugOverlayHandle extends Disposable {
  redraw(): void;
  setLayers(layers: DebugOverlayLayer[] | 'all'): void;
}

export const OVERLAY_LABEL = 'pixi-wheels:debugOverlay';
const ALL: readonly DebugOverlayLayer[] = ['sections', 'pointers', 'target', 'hud'];

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
    const hud = new Text({ text: '', style: { fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11, fill: 0xffffff, lineHeight: 13 } });
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
    if (layers.has('hud')) {
      const c = ring.controller;
      const leg = c.legs[c.currentLegIndex];
      const under = ring.pointers[0] ? ring.sectionUnderPointer().id : '-';
      const lines = [
        `ring ${ring.id}  ${c.state}${c.isIdling ? ' (idle)' : ''}`,
        `rot ${normalizeDeg(ring.rotationDeg).toFixed(1)}  speed ${ring.speed.toFixed(0)} deg/s`,
        `under pointer: ${under}`,
        c.target ? `target: ${c.target.section.id} @ ${c.target.landingAngle.toFixed(1)}` : 'target: -',
        leg ? `leg ${c.currentLegIndex + 1}/${c.legs.length} ${leg.kind} ${leg.distance.toFixed(0)}deg ${Math.round(leg.duration)}ms` : 'leg: -',
        ring.step !== null ? `step ${ring.step}/${ring.stepCount - 1}` : '',
      ].filter((l) => l !== '');
      hud.text = lines.join('\n');
      hud.visible = true;
      hud.position.set(-R, R + 16);
      hudBack.clear();
      hudBack.rect(-R - 4, R + 12, hud.width + 8, hud.height + 8).fill({ color: 0x000000, alpha: 0.65 });
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
