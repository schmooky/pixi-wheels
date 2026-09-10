# pixi-wheels

[![npm version](https://img.shields.io/npm/v/pixi-wheels?color=cb3837&logo=npm)](https://www.npmjs.com/package/pixi-wheels)
[![CI](https://github.com/schmooky/pixi-wheels/actions/workflows/ci.yml/badge.svg)](https://github.com/schmooky/pixi-wheels/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://github.com/schmooky/pixi-wheels/blob/main/LICENSE)
[![PixiJS v8](https://img.shields.io/badge/PixiJS-v8-e91e63)](https://pixijs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

`pixi-wheels` is a bonus wheel engine for [PixiJS v8](https://pixijs.com/). It ships the wheel and nothing else: sections with unequal arcs, a spin that starts before the server answers and lands exactly where the server says, planned decelerations with no velocity jerk, three near-miss styles, dynamic sectors, rings, pointers with flap physics, idle spin, painted / textured / Spine skins, typed events, and a headless testing harness. Outcome math, RTP and audio live in your code.

Install:

```bash
pnpm add pixi-wheels pixi.js
```

Docs, live recipes and the studio at [pixi-wheels.schmooky.dev](https://pixi-wheels.schmooky.dev). Agent-facing instructions are in [AGENTS.md](./AGENTS.md).

## Quick start

```ts
import { Application } from 'pixi.js';
import { WheelBuilder, SpinPresets } from 'pixi-wheels';

const app = new Application();
await app.init({ width: 800, height: 600, background: '#0b0d12' });
document.body.appendChild(app.canvas);

const wheel = new WheelBuilder()
  .radius(240, 36)
  .sections([
    { id: 'x2',  label: 'x2',  value: 2,  weight: 3 },
    { id: 'x5',  label: 'x5',  value: 5,  weight: 2 },
    { id: 'x10', label: 'x10', value: 10, weight: 1 },
    { id: 'x50', label: 'x50', value: 50, weight: 0.5, style: { fill: 0xf1c40f } },
  ])
  .speed('normal', SpinPresets.NORMAL)
  .ticker(app.ticker)
  .build();

wheel.position.set(400, 300);
app.stage.addChild(wheel);

const spin = wheel.spin();                                  // wind up and cruise
const response = await api.spinWheel();                     // your server decides
wheel.setResult({ value: response.multiplier }, {
  anticipation: { bait: 'x50' },                           // almost the big one...
});
const result = await spin;                                  // ...lands on the result
```

## Core API at a glance

```ts
wheel.spin(): Promise<WheelSpinResult>        // start; resolves on spin:complete
wheel.setResult(target, options?)             // { section } | { index } | { value } | { angle } | { position }
wheel.skip() / wheel.requestSkip()            // fast-forward to the landing / queue the press
wheel.slamStop()                              // snap to the final position now
wheel.setWeights({ grand: 2 }, { durationMs }) // dynamic sectors
wheel.setStep(i) / wheel.nextStep()           // dynamic steps from the builder
wheel.idle.start() / wheel.idle.stop()        // slow rotation between features
wheel.setSpeed('turbo')                       // switch spin profile
wheel.ring('inner').spin()                    // rings
wheel.events.on('pointer:tick', (info) => ...) // every event names its ring
wheel.destroy()
```

## What is in the box

| | |
|---|---|
| **Planned stops** | The deceleration begins at the cruise speed and lands on the centre, a random spot, or an exact angle. Then `center` glide or `bounce`. |
| **Anticipation** | `creep` past the jackpot, `stutter` on its edge, `overshoot` and roll back, or `auto`. Protected skips let the tease play. |
| **Dynamic sectors** | Weights animate; labels re-centre; the landing never moves. Step lists or direct `setWeights`. |
| **Rings** | Several rings around one centre, each with its own direction and pointers. An outer ring can trigger an inner one. |
| **Pointers** | Any angle, inward or outward, several per ring, spring flap, `pointer:tick` per divider with the speed. |
| **Skins** | `GraphicsRingSkin` (default), `DebugRingSkin`, `TextureRingSkin`, `SpineRingSkin` (`pixi-wheels/spine`), or yours. |
| **Configs** | `builder.toConfig()` / `WheelBuilder.fromConfig()`; templates; a studio that exports JSON and a runnable project. |
| **Testing** | `createTestWheel` + `FakeTicker` run whole spins in Node. `pixi-wheels/testing`. |
| **Debug** | `enableDebug()`, `debugOverlay()`, `debugArc()`: angles, legs and state in text and lines. |

## Spine (optional subpath)

```ts
import 'pixi-wheels/spine';
import { SpineRingSkin, SpinePointerSkin } from 'pixi-wheels/spine';
```

Install the peer: `pnpm add @esotericsoftware/spine-pixi-v8`. Spine 3.8 exports convert with `tools/spine-3.8-to-4.2/`.

## Debug mode

```ts
import { enableDebug } from 'pixi-wheels';
enableDebug(wheel);
```

```
__PIXI_WHEELS_DEBUG.log()       // ASCII arc + state
__PIXI_WHEELS_DEBUG.snapshot()  // full JSON state
__PIXI_WHEELS_DEBUG.trace()     // log every event
__PIXI_WHEELS_DEBUG.overlay()   // dividers, angles, landing marker, HUD
```

## Recipes and studio

Thirty live demos under [`/recipes`](https://pixi-wheels.schmooky.dev/recipes/), each with its source beside it: gamble wheels, stopping modes, every anticipation style, dynamic sectors, rings, idle wheels, textured and Spine skins with studio art, server adapters, sound hooks, the debug view. The [studio](https://pixi-wheels.schmooky.dev/studio/) edits a wheel in forms, takes your assets, and exports a config or a project.

```bash
pnpm site:dev     # the whole thing, locally
```

## Studio art

The textured and Spine wheels on the docs site use production art provided by [Playson](https://playson.com) (Four Charged Clovers: Super Wheel) and [Pragmatic Play](https://www.pragmaticplay.com) (Wheel of Happiness), with permission. That art belongs to its studio and is not covered by this repository's MIT licence.

## Peer dependencies

- `pixi.js` ^8.18.1
- `@esotericsoftware/spine-pixi-v8` ~4.2.110 (optional, only for the Spine skins)

## Contributing

PRs welcome. [CONTRIBUTING.md](./CONTRIBUTING.md) covers the workflow, changesets and the style rules the lint guards enforce.

## License

MIT.
