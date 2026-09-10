# ADR 008: Deterministic testing on a fake ticker

## Status: Accepted

## Context

Slot clients rarely test the presentation layer because it needs a renderer and a clock. A wheel that lands in the wrong section is exactly the bug a test should catch.

## Decision

Everything advances on `deltaMS`. `pixi-wheels/testing` ships `FakeTicker` (duck-compatible with `PIXI.Ticker`), `HeadlessRingSkin` and `HeadlessPointerSkin` (no pixels, no `Text`), `createTestWheel()` (a real `Wheel` on a fake ticker with a seeded RNG), `spinAndLand()`, `expectPointerOn()` and `captureEvents()`. `slamStop()` completes a spin synchronously for tests that do not care about the motion. `StopPlanner` and `resolveTarget` are pure and tested directly.

## Consequences

- The whole suite runs in well under a second in Node with no canvas.
- Anticipation, skip, settle, dynamic sections, rings and idle are all covered by tests that land a wheel and check the pointer.
- `Text` cannot be created in Node, so the headless skins never draw labels; the graphics skin is covered by the recipe pages in a browser instead.
