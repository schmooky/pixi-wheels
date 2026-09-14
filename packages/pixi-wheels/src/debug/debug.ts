import type { Ring } from '../core/Ring.js';
import type { Wheel } from '../core/Wheel.js';
import type { SpinState } from '../spin/SpinController.js';
import { normalizeDeg } from '../utils/angles.js';
import { debugOverlay, type DebugOverlayHandle, type DebugOverlayOptions } from './debugOverlay.js';

/** One section in a snapshot. Plain numbers, rounded for reading. */
export interface DebugSectionSnapshot {
  id: string;
  index: number;
  label: string;
  value: number | string | undefined;
  weight: number;
  start: number;
  end: number;
  arc: number;
}

export interface DebugRingSnapshot {
  id: string;
  state: SpinState;
  direction: 'cw' | 'ccw';
  /** Normalised rotation, 0..360. */
  rotation: number;
  /** Unbounded rotation. */
  rotationRaw: number;
  /** Signed angular speed of the last frame, deg/s. */
  speed: number;
  /** Arc the tongues are holding back right now, degrees. 0 without `flap.drag`. */
  drag: number;
  activeSpeed: string;
  step: number | null;
  pointers: Array<{ id: string; angle: number; facing: 'inward' | 'outward'; deflection: number; section: string; localAngle: number }>;
  target: { section: string; landingAngle: number; offset: number } | null;
  legs: Array<{ kind: string; distance: number; duration: number; reverse: boolean }>;
  currentLeg: number;
  sections: DebugSectionSnapshot[];
}

/**
 * Plain-JSON state of the whole wheel. No PixiJS objects, no cycles: it
 * serialises, so an agent that cannot see the canvas can still read it.
 */
export interface DebugSnapshot {
  timestamp: number;
  isSpinning: boolean;
  rings: DebugRingSnapshot[];
}

const r1 = (n: number): number => Math.round(n * 10) / 10;
const r2 = (n: number): number => Math.round(n * 100) / 100;

export function debugRingSnapshot(ring: Ring): DebugRingSnapshot {
  const c = ring.controller;
  const target = c.target;
  return {
    id: ring.id,
    state: c.state,
    direction: ring.direction,
    rotation: r1(normalizeDeg(ring.rotationDeg)),
    rotationRaw: r1(ring.rotationDeg),
    speed: r1(ring.speed),
    drag: r2(ring.dragDeg),
    activeSpeed: ring.activeSpeed,
    step: ring.step,
    pointers: ring.pointers.map((p) => ({
      id: p.id,
      angle: p.angle,
      facing: p.facing,
      deflection: r1(p.deflection),
      section: ring.geometry.sectionAt(p.localAngle(ring.rotationDeg)).id,
      localAngle: r1(p.localAngle(ring.rotationDeg)),
    })),
    target: target ? { section: target.section.id, landingAngle: r1(target.landingAngle), offset: Math.round(target.offset * 1000) / 1000 } : null,
    legs: c.legs.map((l) => ({ kind: l.kind, distance: r1(l.distance), duration: Math.round(l.duration), reverse: l.reverse })),
    currentLeg: c.currentLegIndex,
    sections: ring.sections.map((s) => ({
      id: s.id,
      index: s.index,
      label: s.label,
      value: s.value,
      weight: s.weight,
      start: r1(s.startAngle),
      end: r1(s.endAngle),
      arc: r1(s.arc),
    })),
  };
}

export function debugSnapshot(wheel: Wheel): DebugSnapshot {
  return {
    timestamp: Date.now(),
    isSpinning: wheel.isSpinning,
    rings: wheel.rings.map(debugRingSnapshot),
  };
}

/**
 * The ring unrolled into a line of text: every section as a box whose width
 * is its arc, and a caret under the pointer. Read the wheel without seeing it.
 *
 * ```
 * main  rot 123.4  state stopping  speed -210.3 deg/s
 * |  x2  |x5| x3  |x10|  x2  |x8|  x3 |x50|
 *              ^ pointer -> x3
 * ```
 */
export function debugArc(wheel: Wheel, ringId?: string, width = 64): string {
  const rings = ringId ? [wheel.ring(ringId)] : wheel.rings;
  return rings.map((ring) => arcLine(ring, width)).join('\n');
}

function arcLine(ring: Ring, width: number): string {
  const g = ring.geometry;
  const header = `${ring.id}  rot ${r1(normalizeDeg(ring.rotationDeg))}  state ${ring.state}  speed ${r1(ring.speed)} deg/s`;
  let line = '|';
  const starts: number[] = [];
  for (const s of g.sections) {
    starts.push(line.length);
    const cells = Math.max(1, Math.round((s.arc / 360) * width));
    const label = s.label || s.id;
    const inner = cells - 1;
    let text = label.length > inner ? label.slice(0, Math.max(0, inner)) : label;
    const padTotal = inner - text.length;
    const left = Math.floor(padTotal / 2);
    text = ' '.repeat(Math.max(0, left)) + text + ' '.repeat(Math.max(0, padTotal - left));
    line += `${text}|`;
  }
  const lines = [header, line];
  for (const p of ring.pointers) {
    const local = p.localAngle(ring.rotationDeg);
    const rel = normalizeDeg(local - g.startAngle) / 360;
    const col = 1 + Math.min(line.length - 2, Math.round(rel * (line.length - 2)));
    const section = g.sectionAt(local);
    lines.push(`${' '.repeat(col)}^ ${p.id} -> ${section.id}`);
  }
  return lines.join('\n');
}

const TRACED_EVENTS = [
  'spin:start', 'spin:cruise', 'spin:resultSet', 'spin:stopping', 'spin:landing',
  'spin:settle:start', 'spin:settle:end', 'spin:complete',
  'anticipation:start', 'anticipation:bait', 'anticipation:end',
  'skip:requested', 'skip:completed', 'idle:start', 'idle:stop',
  'sections:changed', 'sections:transition:start', 'sections:transition:end',
  'speed:changed', 'destroyed',
] as const;

/**
 * Attach the debug handle to `window.__PIXI_WHEELS_DEBUG`.
 *
 * ```js
 * __PIXI_WHEELS_DEBUG.log()        // arc + state
 * __PIXI_WHEELS_DEBUG.snapshot()   // full JSON
 * __PIXI_WHEELS_DEBUG.trace()      // log every event as it fires (ticks too with trace(true))
 * __PIXI_WHEELS_DEBUG.overlay()    // draw boundaries, pointers, target and a HUD
 * __PIXI_WHEELS_DEBUG.land('x8')   // setResult({ section }) on the current spin
 * ```
 *
 * Several wheels on one page: pass a distinct `key`; each is reachable at
 * `__PIXI_WHEELS_DEBUG_INSTANCES[key]` and the bare global points at the
 * most recently enabled one. Dev and QA builds only.
 */
export function enableDebug(wheel: Wheel, key?: string): void {
  if (typeof window === 'undefined') return;
  let overlayHandle: DebugOverlayHandle | null = null;
  let tracing = false;
  let tracingTicks = false;
  const debug = {
    wheel,
    snapshot: () => debugSnapshot(wheel),
    arc: (ringId?: string) => debugArc(wheel, ringId),
    log: () => {
      const snap = debugSnapshot(wheel);
      console.log(debugArc(wheel));
      return snap;
    },
    trace: (ticks = false) => {
      // Idempotent: a second call from the console must not double every line.
      if (!tracing) {
        tracing = true;
        for (const event of TRACED_EVENTS) {
          wheel.events.on(event, (...args: unknown[]) => console.log(`[pixi-wheels] ${event}`, ...args));
        }
      }
      if (ticks && !tracingTicks) {
        tracingTicks = true;
        wheel.events.on('pointer:tick', (info) => console.log('[pixi-wheels] pointer:tick', info.from.id, '->', info.to.id, Math.round(info.speed)));
      }
      console.log('[pixi-wheels debug] tracing enabled');
    },
    land: (section: string, ring?: string) => wheel.setResult({ section }, { ring }),
    spin: (ring?: string) => wheel.spin({ ring }),
    skip: (ring?: string) => wheel.skip(ring),
    overlay: (opts?: DebugOverlayOptions): DebugOverlayHandle => {
      overlayHandle?.destroy();
      overlayHandle = debugOverlay(wheel, opts);
      return overlayHandle;
    },
    hideOverlay: () => {
      overlayHandle?.destroy();
      overlayHandle = null;
    },
  };
  const w = window as unknown as {
    __PIXI_WHEELS_DEBUG?: typeof debug;
    __PIXI_WHEELS_DEBUG_INSTANCES?: Record<string, typeof debug>;
  };
  const registry = (w.__PIXI_WHEELS_DEBUG_INSTANCES ??= {});
  const resolvedKey = key ?? `wheel_${Object.keys(registry).length}`;
  registry[resolvedKey] = debug;
  w.__PIXI_WHEELS_DEBUG = debug;
  console.log(`[pixi-wheels] Debug enabled (key "${resolvedKey}"). Use __PIXI_WHEELS_DEBUG.log() or __PIXI_WHEELS_DEBUG_INSTANCES["${resolvedKey}"].`);
}
