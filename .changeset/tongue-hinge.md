---
"pixi-wheels": minor
---

The tongue is drawn and pushed like something actually hung on a pin. `GraphicsPointerSkin` builds every shape from one body - a boss around the pin, tapering to the tip, with the tip's far edge exactly `length` from the pin - instead of a free-hand curve that ignored both. New `pinRadius` option sizes the pin; the boss grows to clear it, and the pin is drawn as a cap with a hole rather than a dot. `Pointer` now checks that the peg ring runs between the pin and the tip before deflecting: pegs deeper than the tip, or outside the pin, cannot touch the tongue, so it stays still and says so once instead of swinging from nothing. New `Pointer.tipRadius` and `Pointer.reaches(pegs)`, and `createTestWheel({ pegs })` in the test harness. The debug overlay's pointer mark is the pointer's real body too - pin to tip, swung by the deflection, with the rest axis behind it - instead of a short tick at the rim that made the art look like it pivoted somewhere else.
