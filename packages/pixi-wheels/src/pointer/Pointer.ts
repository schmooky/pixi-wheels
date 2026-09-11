import { Container } from 'pixi.js';
import type { FlapConfig, PointerConfig, PointerFacing, ResolvedPegs, ResolvedSection, SpinDirection } from '../config/types.js';
import { DEFAULT_FLAP, DEFAULT_POINTER } from '../config/defaults.js';
import type { RingGeometry } from '../core/RingGeometry.js';
import { localAngleUnderPointer } from '../core/RingGeometry.js';
import { DEG_TO_RAD, RAD_TO_DEG, clamp, normalizeDeg, signedDeg } from '../utils/angles.js';
import type { Disposable } from '../utils/Disposable.js';
import { noticeWarnOnce } from '../utils/notify.js';
import type { PointerSkin } from './PointerSkin.js';

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
  private _moved = false;
  private _movingNow = false;
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
    return pegs.radius >= lo && pegs.radius <= hi;
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
    direction: SpinDirection,
    pegs: ResolvedPegs | null = null,
    dragOffset = 0,
  ): PointerCrossing[] {
    const crossings: PointerCrossing[] = [];
    const delta = rotation - prevRotation;
    const speed = dt > 0 ? Math.abs(delta) / dt : 0;
    this._movingNow = Math.abs(delta) > 1e-9;
    if (this._movingNow) {
      this._moved = true;
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
      void direction;
    }
    if (this._flap) {
      // A wheel that has never turned rests its tongue straight, even with a peg right under it.
      if (pegs && pegs.angles.length > 0 && this._moved) this._contact(rotation + dragOffset, dt, pegs, crossings.length);
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
   * The tongue against the pegs. `u` is the nearest peg's position along its
   * rim relative to the tongue's rest axis, in px, positive once it is past
   * the axis in the direction of motion. Contact runs from `-c` (first
   * touch) to `c * (1 + friction)` (release); the push grows to the crown at
   * `u = 0` and is carried flat after it.
   */
  private _contact(rotation: number, dt: number, pegs: ResolvedPegs, crossingCount: number): void {
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
    // The lever: pin to the peg ring. A long tongue turns less for the same shove.
    const D = Math.max(1, Math.abs(this._pinRadius - pegs.radius));
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
    const sign = this._moveSign * (this.facing === 'inward' ? -1 : 1) * (f.invert ? -1 : 1);
    const crown = f.elasticity * Math.atan(c / D) * RAD_TO_DEG;
    if (u > -c && u < c * (1 + Math.max(0, f.friction))) {
      const push = u <= 0 ? u + c : c;
      const target = clamp(sign * f.elasticity * Math.atan(push / D) * RAD_TO_DEG, -f.maxAngle, f.maxAngle);
      this._deflectionVel = dt > 0 ? (target - this._deflection) / dt : 0;
      this._deflection = target;
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
    this._engaged = null;
    this._releaseDrag(dt);
    if (crossingCount > 0 && Math.abs(this._deflection) < Math.abs(crown) * 0.5) {
      // The peg went through within one frame: nothing was seen pushing, so flick to the crown.
      this._deflection = clamp(sign * crown, -f.maxAngle, f.maxAngle);
      this._deflectionVel = 0;
    }
    this._stepSpring(dt);
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
