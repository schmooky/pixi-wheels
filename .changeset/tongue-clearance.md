---
"pixi-wheels": minor
---

The tongue and the pegs are now two solids that may not overlap. The blade is a triangle hinged at the pin - `tipWidth` across at its base, tapering to a point at the tip - and the peg is a circle; each frame the contact solves for the smallest swing that keeps the circle outside the triangle. So the tongue yields exactly as far as the peg needs, never cuts through one at any speed or frame rate, and does not fall until the peg has actually gone: on the way down the spring only moves it into clear air. The old model pushed the tip along a curve that had no idea where the peg's edge was, which showed as the blade clipping straight through pegs.

Falling out of that: `pegs.inset` now defaults to `tipInset + size - 2` (the peg ring just inside the first tongue's tip, a 2 px bite) instead of a flat 9, since pegs out past the tip force the blade to lift clear over them - a much bigger flap. `DEFAULT_FLAP.maxAngle` is 45, up from 28, so the default geometry has room to clear; a `maxAngle` below what the geometry needs is reported once. `elasticity` now means "how far past the minimum", clamped at 1, because yielding less than the geometry is a blade drawn through a peg. `friction` is a fatter peg: a bigger swing, held longer.
