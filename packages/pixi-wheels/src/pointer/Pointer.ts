import { Container } from 'pixi.js';
import type { FlapConfig, PointerConfig, PointerFacing, ResolvedPegs, ResolvedSection, SpinDirection } from '../config/types.js';
import { DEFAULT_FLAP, DEFAULT_POINTER } from '../config/defaults.js';
import type { RingGeometry } from '../core/RingGeometry.js';
import { localAngleUnderPointer } from '../core/RingGeometry.js';
import { DEG_TO_RAD, RAD_TO_DEG, clamp, normalizeDeg, signedDeg } from '../utils/angles.js';
import type { Disposable } from '../utils/Disposable.js';
import { noticeWarnOnce } from '../utils/notify.js';
import type { PointerSkin } from './PointerSkin.js';

/** The tongue's blade as the contact model sees it: a triangle in wheel space. */
interface Triangle {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  cx: number;
  cy: number;
}

function segmentDistance(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len = dx * dx + dy * dy;
  const t = len > 0 ? clamp(((px - ax) * dx + (py - ay) * dy) / len, 0, 1) : 0;
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

/** True when a peg of radius `r` centred at `(px, py)` does not touch the blade. */
function pegClearsBlade(t: Triangle, px: number, py: number, r: number): boolean {
  const side = (ax: number, ay: number, bx: number, by: number): number =>
    (bx - ax) * (py - ay) - (by - ay) * (px - ax);
  const s1 = side(t.ax, t.ay, t.bx, t.by);
  const s2 = side(t.bx, t.by, t.cx, t.cy);
  const s3 = side(t.cx, t.cy, t.ax, t.ay);
  const inside = (s1 >= 0 && s2 >= 0 && s3 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0);
  if (inside) return false;
  const d = Math.min(
    segmentDistance(px, py, t.ax, t.ay, t.bx, t.by),
    segmentDistance(px, py, t.bx, t.by, t.cx, t.cy),
    segmentDistance(px, py, t.cx, t.cy, t.ax, t.ay),
  );
  return d >= r;
}

/** A divider crossing, as `Pointer.update()` reports it. */
export interface PointerCrossing {
  pointer: string;
  from: ResolvedSection;
  to: ResolvedSection;
  /** Ring angular speed at the crossing, deg/s, unsigned. */
  speed: number;
  direction: SpinDirection;
}

/**
 * A pointer: the fixed mark a ring is read against.
 *
 * Owns its skin's view, seats it on the ring, detects the dividers that pass
 * under it each frame (one crossing per divider, however fast the ring
 * turns) and runs the tongue against the ring's pegs: pushed aside as a peg
 * comes through, carried on its crown, released into a spring. See
 * {@link FlapConfig} for the knobs.
 */
export class Pointer implements Disposable {
  readonly id: string;
  readonly angle: number;
  readonly facing: PointerFacing;
  readonly tipInset: number;
  readonly view = new Container();
  readonly skin: PointerSkin;
  private readonly _flap: Required<FlapConfig> | null;
  private _pinRadius = 0;
  private _tipRadius = 0;
  private _deflection = 0;
  private _deflectionVel = 0;
  private _drag = 0;
  private _engaged: number | null = null;
  private _moveSign = 1;
  private _movingNow = false;
  private _baseHalf = 0;
  private _lastPegs: ResolvedPegs | null = null;
  private _isDestroyed = false;

  constructor(config: PointerConfig, skin: PointerSkin) {
    this.id = config.id ?? DEFAULT_POINTER.id;
    this.angle = config.angle ?? DEFAULT_POINTER.angle;
    this.facing = config.facing ?? DEFAULT_POINTER.facing;
    this.tipInset = config.tipInset ?? DEFAULT_POINTER.tipInset;
    this.skin = skin;
    this._flap = config.flap === false ? null : { ...DEFAULT_FLAP, ...(config.flap ?? {}) };
    this.view.addChild(skin.view);
    this.view.label = `pixi-wheels:pointer:${this.id}`;
  }

  /** Seat the view on the ring: base rotation and position from the radii. */
  layout(outerRadius: number, innerRadius: number): void {
    const a = this.angle * DEG_TO_RAD;
    if (this.facing === 'inward') {
      const tipRadius = outerRadius - this.tipInset;
      const baseRadius = tipRadius + this.skin.length;
      this._pinRadius = baseRadius;
      this._tipRadius = tipRadius;
      this.view.position.set(Math.cos(a) * baseRadius, Math.sin(a) * baseRadius);
      this.view.rotation = a + Math.PI;
    } else {
      const tipRadius = innerRadius + this.tipInset;
      const baseRadius = tipRadius - this.skin.length;
      this._pinRadius = baseRadius;
      this._tipRadius = tipRadius;
      this.view.position.set(Math.cos(a) * baseRadius, Math.sin(a) * baseRadius);
      this.view.rotation = a;
    }
  }

  /** Current flap deflection, degrees. */
  get deflection(): number {
    return this._deflection;
  }

  /**
   * The angular hold this tongue is asking of the ring right now, degrees,
   * signed against the direction of travel. Zero unless `flap.drag` is set.
   * The ring adds it to the disc's drawn rotation only: the logical rotation,
   * the crossings and the landing never see it.
   */
  get dragDeg(): number {
    return this._drag;
  }

  /** Index into the ring's peg angles of the peg carrying the tongue right now, or null. */
  get engagedPeg(): number | null {
    return this._engaged;
  }

  /** The flap settings in force, or null for a rigid pointer. */
  get flap(): Readonly<Required<FlapConfig>> | null {
    return this._flap;
  }

  /** Distance from the pin to the hub, px, after `layout()`. */
  get pinRadius(): number {
    return this._pinRadius;
  }

  /** Distance from the tip to the hub, px, after `layout()`. */
  get tipRadius(): number {
    return this._tipRadius;
  }

  /**
   * True when the peg ring runs under the tongue somewhere between its pin
   * and its tip, which is the only way a peg can push it. Pegs deeper than
   * the tip pass beneath it; pegs beyond the pin would have to strike the
   * heel, which is not a thing a flapper does.
   */
  reaches(pegs: ResolvedPegs): boolean {
    const lo = Math.min(this._pinRadius, this._tipRadius);
    const hi = Math.max(this._pinRadius, this._tipRadius);
    // The peg's whole disc, not just its centre: a peg just under the tip
    // still catches the blade with its shoulder, which is the usual setup.
    return pegs.radius + pegs.size >= lo && pegs.radius - pegs.size <= hi;
  }

  /** Half the width of the contact zone at the peg ring, px: peg radius plus half the tongue tip. */
  contactHalfWidth(pegs: ResolvedPegs): number {
    return pegs.size + (this._flap?.tipWidth ?? DEFAULT_FLAP.tipWidth) / 2;
  }

  /** The wheel-local angle under this pointer for a disc rotation. */
  localAngle(rotationDeg: number): number {
    return localAngleUnderPointer(rotationDeg, this.angle);
  }

  /**
   * Advance one frame. Returns every divider that passed under the pointer
   * between `prevRotation` and `rotation`, in the order they passed. `pegs`
   * drives the tongue; without them a flapping pointer stays at rest.
   */
  update(
    prevRotation: number,
    rotation: number,
    dt: number,
    geometry: RingGeometry,
    pegs: ResolvedPegs | null = null,
    dragOffset = 0,
  ): PointerCrossing[] {
    const crossings: PointerCrossing[] = [];
    const delta = rotation - prevRotation;
    const speed = dt > 0 ? Math.abs(delta) / dt : 0;
    this._movingNow = Math.abs(delta) > 1e-9;
    if (this._movingNow) {
      this._moveSign = delta > 0 ? 1 : -1;
      const a0 = this.localAngle(prevRotation);
      const dist = Math.min(360, Math.abs(delta));
      const movingDir: SpinDirection = delta > 0 ? 'cw' : 'ccw';
      // A clockwise-turning disc sweeps DEcreasing local angles under the pointer.
      const found: Array<{ d: number; b: number }> = [];
      for (const b of geometry.boundaries()) {
        const d = delta > 0 ? normalizeDeg(a0 - b) : normalizeDeg(b - a0);
        if (d > 0 && d <= dist) found.push({ d, b });
      }
      found.sort((x, y) => x.d - y.d);
      for (const { b } of found) {
        const before = geometry.sectionAt(b + 1e-6);
        const after = geometry.sectionAt(b - 1e-6);
        // cw: the pointer was in the section that starts at b and moves to the one that ends there.
        const from = delta > 0 ? before : after;
        const to = delta > 0 ? after : before;
        crossings.push({ pointer: this.id, from, to, speed, direction: movingDir });
      }
    }
    if (this._flap) {
      if (pegs && pegs.angles.length > 0) this._contact(rotation + dragOffset, dt, pegs, delta);
      else {
        this._stepSpring(dt);
        this._releaseDrag(dt);
      }
      this.skin.setDeflection(this._deflection);
    }
    if (crossings.length > 0 && this.skin.tick) this.skin.tick(speed);
    return crossings;
  }

  /**
   * The tongue against the pegs, as two solids that may not overlap.
   *
   * The blade is a triangle hinged at the pin: `tipWidth` across where it
   * crosses the peg ring, tapering to a point at the tip. The peg is a
   * circle. Each frame this asks the only question that matters - what is
   * the smallest swing that keeps the circle outside the triangle - and
   * gives the tongue exactly that. So it is pushed aside as far as the peg
   * needs and no further, it never cuts through one, and it does not fall
   * until the peg has actually gone: on the way down the spring does the
   * work, clamped so it can never drop back into the peg it just cleared.
   */
  private _contact(rotation: number, dt: number, pegs: ResolvedPegs, delta: number): void {
    const f = this._flap!;
    if (!this.reaches(pegs)) {
      // Nothing to push it: let it settle rather than deflect out of thin air.
      noticeWarnOnce(
        `pointer-reach-${this.id}`,
        `Pointer "${this.id}": the pegs sit at radius ${Math.round(pegs.radius)}, outside the tongue's ` +
          `${Math.round(Math.min(this._tipRadius, this._pinRadius))}..${Math.round(Math.max(this._tipRadius, this._pinRadius))} reach, ` +
          'so nothing touches it. Change pegs.inset, tipInset or the skin length.',
      );
      this._engaged = null;
      this._releaseDrag(dt);
      this._stepSpring(dt);
      return;
    }
    const c = this.contactHalfWidth(pegs);
    // The blade: a triangle `tipWidth` across at the pin, tapering to a point
    // at the tip. Narrow on purpose - a wedge wide enough to matter at the pin
    // would sweep half the rim as it swings.
    this._baseHalf = f.tipWidth / 2;
    this._lastPegs = pegs;
    let bestIndex = -1;
    let bestX = Number.POSITIVE_INFINITY;
    for (let i = 0; i < pegs.angles.length; i++) {
      const x = signedDeg(pegs.angles[i] + rotation - this.angle) * DEG_TO_RAD * pegs.radius;
      if (Math.abs(x) < Math.abs(bestX)) {
        bestX = x;
        bestIndex = i;
      }
    }
    const u = bestX * this._moveSign;
    let sign = this._moveSign * (this.facing === 'inward' ? -1 : 1) * (f.invert ? -1 : 1);
    const pegAngle = (pegs.angles[bestIndex] + rotation) * DEG_TO_RAD;
    const qx = Math.cos(pegAngle) * pegs.radius;
    const qy = Math.sin(pegAngle) * pegs.radius;
    // `elasticity` and `friction` are both padding on the peg: a fatter peg
    // takes a bigger swing to clear and stays in contact longer, and the real
    // peg is never touched on the way past.
    const pad = pegs.size * Math.max(1, f.elasticity) * (1 + Math.max(0, f.friction));
    const clearAt = (deg: number): boolean => pegClearsBlade(this._blade(deg), qx, qy, pad);

    if (!this._movingNow) {
      // A wheel standing still with a peg under the tongue: the tongue is
      // sitting on it, so it leans off to one side. Whichever side it was
      // already on, or the nearer one if it is straight.
      if (this._deflection !== 0) sign = Math.sign(this._deflection);
      else if (this._clearance(clearAt, -sign, f) < this._clearance(clearAt, sign, f)) sign = -sign;
    }

    // The blade rides the peg it is touching. Everything is measured from
    // where it stands, never from rest: a blade shoved past a peg cannot get
    // home by the way it came, and a solver that looks for "the smallest
    // swing from zero" hands it an answer on the wrong side of the peg.
    if (!clearAt(this._deflection)) {
      const from = Math.max(0, this._deflection * sign);
      const want = Math.min(f.maxAngle, this._clearance(clearAt, sign, f, from));
      this._deflection = sign * want;
      // Carried by the peg, not thrown by it: no momentum to hand the spring
      // when the peg finally lets go, so the release is one clean swing.
      this._deflectionVel = 0;
      this._engaged = bestIndex;
      // Climbing the peg, the tongue pushes back: the ring is held by up to
      // `drag` of a contact width of arc. Past the crown the peg is winning,
      // so the hold lets go and the ring catches up.
      if (f.drag > 0 && u <= 0 && this._movingNow) {
        this._drag = -this._moveSign * f.drag * ((u + c) / Math.max(1, pegs.radius)) * RAD_TO_DEG;
      } else {
        this._releaseDrag(dt);
      }
      return;
    }

    // Standing clear: the spring brings it home, as far as the peg allows.
    this._releaseDrag(dt);
    const from = this._deflection;
    this._stepSpring(dt);
    if (!clearAt(this._deflection)) {
      let blocked = this._deflection;
      let ok = from;
      for (let k = 0; k < 14; k++) {
        const mid = (blocked + ok) / 2;
        if (clearAt(mid)) ok = mid;
        else blocked = mid;
      }
      this._deflection = ok;
      this._deflectionVel = 0;
      this._engaged = bestIndex;
      return;
    }
    this._engaged = null;
    if (Math.abs(delta) > this._contactSpan(pegs, f)) {
      // The peg crossed the whole contact inside this one frame: nothing was
      // ever seen pushing, so flick the tongue to where it would have held it.
      const crown = this._crownAngle(pegs, f);
      if (Math.abs(this._deflection) < crown * 0.5) {
        this._deflection = clamp(sign * crown, -f.maxAngle, f.maxAngle);
        this._deflectionVel = 0;
      }
    }
  }

  /** How much rotation it takes for a peg to cross the whole contact, degrees. */
  private _contactSpan(pegs: ResolvedPegs, f: Required<FlapConfig>): number {
    return ((2 * this.contactHalfWidth(pegs)) / Math.max(1, pegs.radius)) * RAD_TO_DEG;
  }

  /**
   * The smallest swing, in degrees and unsigned, that puts the peg outside
   * the blade. Zero when the resting blade is already clear. Scans in the
   * direction the tongue is being pushed, then bisects, so the rise is
   * smooth rather than stepped.
   */
  private _clearance(clearAt: (deg: number) => boolean, sign: number, f: Required<FlapConfig>, fromDeg = 0): number {
    const clear = (deg: number): boolean => clearAt(sign * deg);
    if (clear(fromDeg)) return fromDeg;
    const STEPS = 24;
    let blocked = fromDeg;
    for (let i = 1; i <= STEPS; i++) {
      const deg = fromDeg + ((f.maxAngle - fromDeg) * i) / STEPS;
      if (clear(deg)) {
        // Between `blocked` and `deg` is the first angle that works.
        let lo = blocked;
        let hi = deg;
        for (let k = 0; k < 7; k++) {
          const mid = (lo + hi) / 2;
          if (clear(mid)) hi = mid;
          else lo = mid;
        }
        return hi;
      }
      blocked = deg;
    }
    noticeWarnOnce(
      `pointer-maxangle-${this.id}`,
      `Pointer "${this.id}": the blade cannot clear a peg within maxAngle ${f.maxAngle} deg, so it rides through them. ` +
        `This geometry needs about ${Math.ceil(this._worstClearance(sign, f))} deg. ` +
        'Raise maxAngle, lift the tip (smaller tipInset), or set the pegs deeper (larger pegs.inset).',
    );
    return f.maxAngle;
  }

  /**
   * The largest swing this geometry will ever ask for, degrees. Only used to
   * put a number in the warning above, so it may take its time: it re-solves
   * the clearance against an uncapped blade at the angle the peg is at.
   */
  private _worstClearance(sign: number, f: Required<FlapConfig>): number {
    const pegs = this._lastPegs;
    if (!pegs) return 0;
    const wide = { ...f, maxAngle: 150 };
    const pad = pegs.size * Math.max(1, f.elasticity) * (1 + Math.max(0, f.friction));
    const span = this._contactSpan(pegs, f) * 2;
    let worst = 0;
    for (let i = -12; i <= 12; i++) {
      const a = (this.angle + (span * i) / 12) * DEG_TO_RAD;
      const qx = Math.cos(a) * pegs.radius;
      const qy = Math.sin(a) * pegs.radius;
      worst = Math.max(worst, this._clearance((deg) => pegClearsBlade(this._blade(deg), qx, qy, pad), sign, wide));
    }
    return worst;
  }

  /** How far a peg dead under the pointer would hold the tongue, degrees. */
  private _crownAngle(pegs: ResolvedPegs, f: Required<FlapConfig>): number {
    const a = this.angle * DEG_TO_RAD;
    const qx = Math.cos(a) * pegs.radius;
    const qy = Math.sin(a) * pegs.radius;
    return this._clearance((deg) => pegClearsBlade(this._blade(deg), qx, qy, pegs.size), 1, f);
  }

  /**
   * The blade at a given deflection: a triangle from the pin, `tipWidth`
   * across where it crosses the peg ring, to a point at the tip.
   */
  private _blade(deflectionDeg: number): Triangle {
    const a = this.angle * DEG_TO_RAD;
    const px = Math.cos(a) * this._pinRadius;
    const py = Math.sin(a) * this._pinRadius;
    const dir = (this.facing === 'inward' ? a + Math.PI : a) + deflectionDeg * DEG_TO_RAD;
    const ux = Math.cos(dir);
    const uy = Math.sin(dir);
    const L = Math.max(1, this.skin.length);
    return {
      ax: px - uy * this._baseHalf,
      ay: py + ux * this._baseHalf,
      bx: px + uy * this._baseHalf,
      by: py - ux * this._baseHalf,
      cx: px + ux * L,
      cy: py + uy * L,
    };
  }

  /** Let the held arc go, so the ring is drawn where it logically is again. */
  private _releaseDrag(dt: number): void {
    if (this._drag === 0) return;
    const rate = this._flap?.dragRelease ?? DEFAULT_FLAP.dragRelease;
    this._drag *= Math.max(0, 1 - rate * dt);
    if (Math.abs(this._drag) < 1e-3) this._drag = 0;
  }

  private _stepSpring(dt: number): void {
    const f = this._flap!;
    if (this._deflection === 0 && this._deflectionVel === 0) return;
    const acc = -f.stiffness * this._deflection - f.damping * this._deflectionVel;
    this._deflectionVel += acc * dt;
    this._deflection += this._deflectionVel * dt;
    if (this._deflection > f.maxAngle) {
      this._deflection = f.maxAngle;
      if (this._deflectionVel > 0) this._deflectionVel = 0;
    } else if (this._deflection < -f.maxAngle) {
      this._deflection = -f.maxAngle;
      if (this._deflectionVel < 0) this._deflectionVel = 0;
    }
    if (Math.abs(this._deflection) < 0.02 && Math.abs(this._deflectionVel) < 0.5) {
      this._deflection = 0;
      this._deflectionVel = 0;
    }
  }

  get isDestroyed(): boolean {
    return this._isDestroyed;
  }

  destroy(): void {
    if (this._isDestroyed) return;
    this._isDestroyed = true;
    this.skin.destroy();
    this.view.destroy({ children: true });
  }
}
