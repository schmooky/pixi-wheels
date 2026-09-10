import { Container } from 'pixi.js';
import type { FlapConfig, PointerConfig, PointerFacing, ResolvedSection, SpinDirection } from '../config/types.js';
import { DEFAULT_FLAP, DEFAULT_POINTER } from '../config/defaults.js';
import type { RingGeometry } from '../core/RingGeometry.js';
import { localAngleUnderPointer } from '../core/RingGeometry.js';
import { DEG_TO_RAD, clamp, normalizeDeg } from '../utils/angles.js';
import type { Disposable } from '../utils/Disposable.js';
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
 * turns) and runs the flap spring that makes the tongue kick.
 */
export class Pointer implements Disposable {
  readonly id: string;
  readonly angle: number;
  readonly facing: PointerFacing;
  readonly tipInset: number;
  readonly view = new Container();
  readonly skin: PointerSkin;
  private readonly _flap: Required<FlapConfig> | null;
  private _deflection = 0;
  private _deflectionVel = 0;
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
      this.view.position.set(Math.cos(a) * baseRadius, Math.sin(a) * baseRadius);
      this.view.rotation = a + Math.PI;
    } else {
      const tipRadius = innerRadius + this.tipInset;
      const baseRadius = tipRadius - this.skin.length;
      this.view.position.set(Math.cos(a) * baseRadius, Math.sin(a) * baseRadius);
      this.view.rotation = a;
    }
  }

  /** Current flap deflection, degrees. */
  get deflection(): number {
    return this._deflection;
  }

  /** The wheel-local angle under this pointer for a disc rotation. */
  localAngle(rotationDeg: number): number {
    return localAngleUnderPointer(rotationDeg, this.angle);
  }

  /**
   * Advance one frame. Returns every divider that passed under the pointer
   * between `prevRotation` and `rotation`, in the order they passed.
   */
  update(
    prevRotation: number,
    rotation: number,
    dt: number,
    geometry: RingGeometry,
    direction: SpinDirection,
  ): PointerCrossing[] {
    const crossings: PointerCrossing[] = [];
    const delta = rotation - prevRotation;
    const speed = dt > 0 ? Math.abs(delta) / dt : 0;
    if (Math.abs(delta) > 1e-9) {
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
      if (this._flap && crossings.length > 0) {
        const f = this._flap;
        const kickSign = (delta > 0 ? 1 : -1) * (this.facing === 'inward' ? -1 : 1) * (f.invert ? -1 : 1);
        const factor = clamp(speed / f.referenceSpeed, 0.25, 1.5);
        this._deflectionVel += kickSign * f.kick * factor * Math.min(crossings.length, 3);
      }
      void direction;
    }
    if (this._flap) this._stepFlap(dt);
    if (crossings.length > 0 && this.skin.tick) this.skin.tick(speed);
    return crossings;
  }

  private _stepFlap(dt: number): void {
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
    this.skin.setDeflection(this._deflection);
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
