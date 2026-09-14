---
"pixi-wheels": minor
---

Audit fixes across the package.

- `SpinProfile`: only `spinSpeed` is required. Every other field falls back to the new `DEFAULT_PROFILE` (`accelerationMs` 900, `minimumSpinTime` 0, `minCruiseMs` 0, `stopDuration` 4200, `minTurns` 1, `maxTurns` 8, `skipDuration` 450, the two eases). `builder.speed()` and `ring.addSpeed()` both fill and validate; `ring.profile` and `speed:changed` carry a `ResolvedSpinProfile`.
- `ring.idle.isActive` reports the ring's idle state instead of always `false`.
- `requestSkip()` holds a press made before `skip.minimumSpinTime` and skips the frame it becomes legal, instead of dropping it.
- A skip pressed during the wind-up or the cruise emits `spin:stopping` (with the fast-forward's turns and duration) before `skip:completed`, so slow-down cues fire on every path.
- `WheelBuilder.fromConfig()` keeps the id of a first ring that is not called `main` instead of renaming it.
- A weight change after `setResult()` that leaves a different section under the fixed landing angle warns at landing (`landing-moved`).
- `build()` rejects a `dynamic.initialStep` outside the step list, and two wheels built from one builder no longer share a profile table.
- `Pointer.update()` drops its unused `direction` parameter; the crossing direction comes from the rotation delta.
- `DebugRingSkin` reuses its labels across layouts instead of re-creating them every frame of a transition.
- `DEFAULT_ANTICIPATION.maxDistanceDeg` (150) replaces a hard-coded default.
