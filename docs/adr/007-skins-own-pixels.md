# ADR 007: Skins own pixels; rings own motion

## Status: Accepted

## Context

The same wheel ships as a painted prototype, a textured production asset and a Spine skeleton. If the drawing code knows about motion, every look reimplements the spin.

## Decision

`Ring` owns rotation, sections, pointers, the controller and the ticker. A `RingSkin` is attached once with two containers (`disc`, which rotates; `overlay`, which does not), the geometry and the radii, and is told `layout()` when weights change, `syncRotation(deg)` every frame, and the spin hooks (`onSpinStart`, `onSpinStop`, `onLanded`, `highlight`). Pointers have the same split: `Pointer` detects crossings and runs the flap spring; a `PointerSkin` draws in a local space where the pin is the origin and the tip is at `+length` on x. Skins register a config type so JSON can name them.

## Consequences

- Swapping `GraphicsRingSkin` for a `TextureRingSkin` or a `SpineRingSkin` changes no motion code.
- A studio's authored wheel is a skin of ~150 lines composed from its atlas (the Playson recipe), not a fork of the engine.
- Skins that need per-frame work get exactly one hook and no ticker of their own.
