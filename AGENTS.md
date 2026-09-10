# AGENTS.md

Instructions for AI agents (Claude, Codex, Cursor, etc.) and human contributors working in this repo. Read the whole file before touching anything. It is short on purpose.

---

## 1. What this repo is

`pixi-wheels` is a **bonus wheel engine for PixiJS v8**. It animates a wheel that spins, is told where to land, and lands there, and it emits typed events describing that lifecycle. One monorepo with two surfaces:

```
packages/pixi-wheels/   <- the published library (npm: pixi-wheels)
apps/site/              <- the docs site (recipes, guides, API reference, studio)
```

The library builds to three entry points:
- `pixi-wheels`: core (builder, wheel, rings, planner, skins, events, debug).
- `pixi-wheels/spine`: Spine skins for the ring and the pointer.
- `pixi-wheels/testing`: the headless harness (fake ticker, headless skins, `createTestWheel`).

Site runtime code (`apps/site/src/runtime/`: the Playson skin, the Pragmatic loader, the mock server) is reference code, copy-pasteable, **not library API**.

---

## 2. What this repo is NOT

| Out of scope | Why | Where it belongs |
|---|---|---|
| Outcome selection, odds, RTP | Regulated money math | Server. `setResult(target)` is the inbound interface |
| Audio | Every exit path emits events; wire audio to those | Consumer audio layer |
| Bonus round state machines | The wheel is a primitive the feature is built from | Game code |
| UI / HUD | The wheel is a `PIXI.Container`. You place it | Consumer UI |
| Asset loading | PixiJS `Assets` does this. Skins receive textures / aliases | Consumer, or `apps/site/src/runtime/` as reference |

If a request lives in the right column, decline it and point at [ADR 004](./docs/adr/004-scope.md).

---

## 3. Repo layout

```
pixi-wheels/
├── packages/pixi-wheels/
│   ├── src/
│   │   ├── core/        Wheel, Ring, WheelBuilder, RingGeometry, WheelConfig, templates
│   │   ├── spin/        SpinController (state machine), StopPlanner (pure legs)
│   │   ├── adapter/     resolveTarget, createTargetAdapter
│   │   ├── pointer/     Pointer (crossings + flap), Graphics / Texture pointer skins
│   │   ├── skins/       RingSkin contract, Graphics / Debug / Texture / Headless skins, registry, labels (text or rich `content`)
│   │   ├── config/      types, SpinPresets, defaults
│   │   ├── events/      EventEmitter, WheelEvents
│   │   ├── utils/       Disposable, TickerRef, notify, angles, easing, fit (scaleToFit / fitContainer / fitText / labelSlot)
│   │   │          Disposable, TickerRef, angles, easing, notify
│   │   ├── debug/       debugSnapshot, debugArc, enableDebug, debugOverlay
│   │   ├── testing/     FakeTicker, createTestWheel        -> subpath
│   │   ├── spine/       SpineRingSkin, SpinePointerSkin    -> subpath
│   │   └── index.ts     the only public barrel
│   └── tests/           vitest (unit + integration)
├── apps/site/
│   ├── src/recipes/     one .recipe.ts per live demo (the /recipes pages embed them)
│   ├── src/content/     recipes / guides / docs MDX
│   ├── src/runtime/     asset loaders and site-only skins
│   └── src/components/  RecipeRunner, Studio, chrome
├── tools/               Spine 3.7 / 3.8 -> 4.2 converters
├── docs/adr/            architecture decision records
├── scripts/             lint guards, size check, release scripts
└── .github/             workflows + templates
```

---

## 4. Load-bearing invariants

- **No default exports.** Always named.
- **`.js` extensions in imports.** Even from `.ts`. Node ESM resolution requires it.
- **Only `src/index.ts` is a barrel.** The `spine/index.ts` and `testing/index.ts` subpath barrels are the exceptions.
- **`Disposable` on anything that allocates.** `destroy()` + `isDestroyed`, wired into `Wheel.destroy()`.
- **`TickerRef`, never `ticker.add()` directly.**
- **Events use colon namespacing**: `spin:start`, `pointer:tick`, `sections:changed`. Every payload names its `ring`.
- **The stop is planned, not tweened.** `StopPlanner` is pure and produces legs; `SpinController` plays them off `deltaMS`. Nothing in the engine depends on wall-clock time or `requestAnimationFrame`, which is what lets `FakeTicker` reproduce a spin frame for frame.
- **The landing angle is fixed at `setResult()`.** A tease chooses it next to the divider the result shares with the bait (`rest`), still inside the result; after that, dynamic-section changes, skips and anticipation never move it.
- **A stop plan has no reverse leg and no stop before the rest.** The wheel comes to rest exactly once, on the result. A tease that halts on the bait and moves on, or overshoots and rolls back, reads as a glitch; the planner must not produce one.
- **Angles are degrees, clockwise positive, wheel-local on the disc.** A clockwise spin sweeps *decreasing* local angles under a pointer. `RingGeometry.entryAngle()` encodes this; do not re-derive it.
- **Anticipation never fakes geometry.** A bait that is not a neighbour of the landing is dropped with a warning; the wheel still lands.
- **ASCII punctuation.** No smart quotes. `scripts/check-no-fancy-unicode.mjs` runs in CI and pre-commit.

---

## 5. House style

- Simplicity first. If 200 lines could be 50, rewrite.
- Surgical changes. Every changed line traces to the task.
- Comments explain why. The code says what.
- One logical change per PR.
- Fail loud: no swallowed errors, no silent fallbacks for missing config. Throw with a message that names the fix.
- Tests are named after behaviour.

---

## 6. Common tasks

### Add a skin
1. `src/skins/MySkin.ts` implementing `RingSkin` (`attach`, `layout`, `destroy`, optional `syncRotation`, `highlight`, `onSpinStart`, `onLanded`).
2. `registerRingSkin('mine', factory)` at the bottom if it should be reachable from configs.
3. Export from `src/index.ts`.
4. A recipe under `apps/site/src/recipes/` and a line in the matching MDX page.

### Add an anticipation style
1. Extend `AnticipationStyle` in `config/types.ts`.
2. Plan its legs in `spin/StopPlanner.ts`; mark `baitAtStart` and `landsAtEnd`.
3. Decide it in `SpinController._resolveAnticipation`.
4. Unit test the legs in `tests/unit/StopPlanner.test.ts`, then an integration test that lands.

### Add a recipe
1. `apps/site/src/recipes/<slug>.recipe.ts` with `// @ts-nocheck` and the globals comment. Return `{ wheel, onSpin? }`.
2. `<RecipeDemo code="<slug>" />` in the right `apps/site/src/content/recipes/*.mdx`.
3. `pnpm check:recipe-syntax`.

### Add a template
`src/core/templates.ts`, then a test asserting it builds (`tests/integration/builder.test.ts` iterates them).

---

## 7. Before you declare done

```bash
pnpm check:lint                          # unicode guard, unused imports, recipe globals + syntax, API surface
pnpm --filter pixi-wheels typecheck
pnpm --filter pixi-wheels test
pnpm --filter @pixi-wheels/site build
```

Library change? Add a changeset (`pnpm changeset`). See `.changeset/README.md`.

---

## 8. Debugging a canvas you cannot see

```ts
import { enableDebug } from 'pixi-wheels';
enableDebug(wheel);   // window.__PIXI_WHEELS_DEBUG
```

`.log()` prints the ASCII arc and state, `.snapshot()` the JSON, `.trace()` every event, `.overlay()` the geometry. The recipe runner and the studio call `enableDebug` for you.

---

## 9. The four behavioural rules

1. Think before coding. State assumptions; ask when unclear.
2. Simplicity first. Nothing speculative.
3. Surgical changes. Touch only what you must.
4. Goal-driven execution. Every task becomes a verifiable goal; loop until green.
