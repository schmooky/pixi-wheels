# ADR 003: Degrees, clockwise positive, wheel-local; the pointer reads decreasing local angles

## Status: Accepted (load-bearing)

## Context

Angles show up everywhere: section layout, pointer placement, landing, anticipation geometry, the debug output. Designers think in degrees from twelve o'clock; PixiJS rotates in radians with clockwise positive because y points down.

## Decision

All public angles are degrees. Clockwise is positive, matching PixiJS. Section geometry is wheel-local: section 0 starts at `startAngle` (default -90, twelve o'clock) and sections proceed clockwise (increasing). A pointer is a screen angle. The local angle under a pointer is `pointerAngle - rotation`, so a clockwise spin sweeps *decreasing* local angles under it: the pointer enters a section through its `endAngle` and leaves through its `startAngle`. `RingGeometry.entryAngle(section, direction)` and `exitAngle` encode this, and the planner and the pointer-crossing detector use them rather than re-deriving.

## Consequences

- "Bait before the landing" (creep) means the section *after* the target in layout order on a clockwise wheel. The planner decides by measuring `arcDelta` in the spin direction, so callers do not have to think about it; `'auto'` picks the style.
- The debug arc prints sections left to right in layout order with the pointer caret, which reads naturally even though the disc moves the other way.
- Landing rotation is `pointerAngle - landingAngle` (mod 360). `rotationForLocalAngle` / `localAngleUnderPointer` are the two helpers; nothing else does this arithmetic.
