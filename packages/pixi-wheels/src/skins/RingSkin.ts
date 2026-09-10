import type { Container, Texture } from 'pixi.js';
import type { ResolvedSection, SpinDirection } from '../config/types.js';
import type { RingGeometry } from '../core/RingGeometry.js';
import type { Disposable } from '../utils/Disposable.js';

/** What a ring hands its skin when the skin is attached. */
export interface RingSkinContext {
  ringId: string;
  geometry: RingGeometry;
  outerRadius: number;
  innerRadius: number;
  /** Rotates with the wheel. Sections, labels, the face texture live here. */
  disc: Container;
  /** Does not rotate. Rim decoration, hub caps, anything fixed. Pointers are added by the ring, above this. */
  overlay: Container;
  direction: SpinDirection;
  /** Screen angles of the ring's pointers, for skins that mark them. */
  pointerAngles: readonly number[];
}

/**
 * How a ring looks. The ring owns the motion (rotation, sections, pointers);
 * a skin owns the pixels. Swap `GraphicsRingSkin` for `TextureRingSkin` or a
 * Spine skin and nothing about the spin changes.
 *
 * `attach()` is called once at build; `layout()` whenever the geometry
 * changes (a dynamic-section transition calls it every frame, so keep it
 * proportional to the section count).
 */
export interface RingSkin extends Disposable {
  attach(ctx: RingSkinContext): void;
  layout(): void;
  /** Every frame, the disc rotation in degrees. For upright labels and bone-driven skins. */
  syncRotation?(rotationDeg: number): void;
  /** Turn a highlight on one section (or off with `null`). */
  highlight?(sectionId: string | null): void;
  /** Hooks the ring calls from its own event stream, for skins with spin / win states. */
  onSpinStart?(): void;
  onSpinStop?(): void;
  onLanded?(section: ResolvedSection): void;
}

/** Resolves asset keys named in a serialised config to loaded textures. */
export interface AssetResolver {
  texture(key: string): Texture;
}
