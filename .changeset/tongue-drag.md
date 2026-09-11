---
"pixi-wheels": minor
---

`flap.drag`: the tongue can hold the ring back. While a peg climbs the tip, the disc is drawn up to one contact width of arc behind itself, and springs forward at `dragRelease` once the peg is over the crown, so a wheel crawling to a stop visibly fights every peg. The hold is drawn only: `rotationDeg`, the crossings and the landing never see it, and it relaxes to zero whenever the ring is not moving, so the wheel still comes to rest exactly on its result. New: `FlapConfig.drag` (0 by default) and `FlapConfig.dragRelease`, `Ring.visualRotationDeg`, `Ring.dragDeg`, `Pointer.dragDeg`, and a `drag` field on the debug snapshot. The debug HUD prints the held arc while it is non-zero.
