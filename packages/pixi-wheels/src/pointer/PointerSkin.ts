import type { Container } from 'pixi.js';
import type { Disposable } from '../utils/Disposable.js';

/**
 * The visual of a pointer. Drawn in a local space where the pin (the point
 * it pivots around) is at `(0, 0)` and the tip is at `(+length, 0)`. The
 * ring positions and rotates the view so the tip faces the hub or the rim.
 */
export interface PointerSkin extends Disposable {
  readonly view: Container;
  /** Pin-to-tip distance in pixels, so the ring can seat the tip on the rim. */
  readonly length: number;
  /** Rotate the visual around the pin by `deg` (the flap). */
  setDeflection(deg: number): void;
  /** A divider just passed. Optional: skins with a "tick" animation play it here. */
  tick?(speed: number): void;
}
