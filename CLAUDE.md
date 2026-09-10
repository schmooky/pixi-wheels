# CLAUDE.md

Read [AGENTS.md](./AGENTS.md) first; it is the contract. This file adds the Claude-specific working notes.

## Verify before you say done

- `pnpm --filter pixi-wheels typecheck` then `pnpm --filter pixi-wheels test` then `pnpm check:lint`. In that order, every time.
- A behaviour visible on a running wheel gets checked on the docs site (`pnpm site:dev`) with `__PIXI_WHEELS_DEBUG.log()` / `.trace()`. The canvas is opaque to you; the debug handle is not.
- If you cannot verify something end to end (no browser, no Spine asset), say so in the PR.

## Read state, do not remember it

Re-read a file before editing it. Grep for a signature before calling it. The engine is small; re-reading is cheaper than guessing.

## Architecture in one picture

```
WheelBuilder ── build() ──> Wheel (Container)
                              ├── events: EventEmitter<WheelEvents>   (one for all rings)
                              └── Ring[] (Container each)
                                    ├── RingGeometry     sections -> arcs (pure)
                                    ├── SpinController   idle | starting | cruising | stopping | settling
                                    │     └── StopPlanner  legs: decel, creep, dwell, push, return, skip, settle
                                    ├── Pointer[]        crossings -> pointer:tick, flap spring
                                    ├── RingSkin         disc (rotates) + overlay (fixed)
                                    └── TickerRef        update(deltaMS)
```

Spin: `spin()` -> `spin:start` -> accelerate -> `spin:cruise` -> `setResult()` resolves the landing angle -> once the minimum times pass, `planStop()` -> `spin:stopping` -> legs play -> `spin:landing` -> settle legs -> `spin:complete`.

## Gotchas

- Clockwise rotation sweeps decreasing local angles under the pointer. Bait "before" the landing means the pointer meets it first, which in layout order is the section *after* the target. `RingGeometry.entryAngle()` is the source of truth.
- The stop ease must be an ease-out with a finite start slope. `inOut` curves are clamped with a one-time warning.
- `Text` needs a canvas; the test harness uses `HeadlessRingSkin` so no `Text` is created in Node.
- Recipes are `@ts-nocheck` strings; `pnpm check:recipe-syntax` is the only thing that parses them before a browser does.
- The site always builds against this checkout's library source (vite aliases), never against npm.
