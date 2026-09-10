---
"pixi-wheels": minor
---

A physical tongue on pegs.

- Every ring has pegs: small circles on the disc, one per divider by default (`.pegs({ size, inset, angles })`, `.pegs(false)` for none), following dynamic sections. `ring.pegs` exposes them, `RingSkinContext.pegs` hands them to skins, `GraphicsRingSkin` draws them with `pegs: true`, and the debug overlay's new `pegs` layer draws them with the peg being ridden and each tongue's contact zone.
- The flap is now contact physics: a peg pushes the tongue aside along its rim as it comes through (scaled by `elasticity`), carries it on its crown until the peg is through plus `friction` of the contact width, then lets go into the spring (`stiffness`, `damping`, `maxAngle`). `tipWidth` sets how early a peg starts pushing. At speed a peg that passes within one frame flicks the tongue to the crown. `kick` and `referenceSpeed` are gone.
- `Pointer` exposes `deflection`, `engagedPeg`, `flap`, `pinRadius` and `contactHalfWidth()`; the HUD prints the first tongue's deflection. The studio gets Pegs and flap fields; `RingConfig.pegs` round-trips.
