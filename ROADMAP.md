# Roadmap

Wheel mechanics and presentation features, scored against what ships. Status: [done] ships, [partial] recipe or workaround, [todo] not yet.

## Motion

| Mechanic | Status | Notes |
|---|---|---|
| Velocity-matched planned stop | [done] | `StopPlanner`; turn count picked to hit `stopDuration` |
| Landing: center / random / exact offset / exact angle / position | [done] | |
| Settle: center glide, bounce | [done] | |
| Anticipation: creep, stutter, overshoot, auto | [done] | |
| Protected skip (tease survives first press) | [done] | |
| Idle rotation with ramp, spin from idle, auto-resume | [done] | |
| Result timeout guard | [done] | `spin({ resultTimeoutMs })` |
| Reverse-direction landing (spin back) | [todo] | a leg that reverses mid-stop for a "rewind" reveal |
| Multi-stop rounds (land, re-spin from rest without wind-up) | [partial] | call `spin()` again; a `respin` profile without acceleration would read better |

## Shape

| Mechanic | Status | Notes |
|---|---|---|
| Unequal arcs | [done] | |
| Dynamic sections (weights, steps, transitions) | [done] | |
| Rings / subwheels, inward and outward pointers | [done] | |
| Several pointers per ring | [done] | |
| Sections that appear / disappear (weight to zero) | [todo] | zero weight is rejected today; a `hidden` flag would keep ids stable |
| Non-circular wheels (ellipse, polygon) | [todo] | geometry is circular |

## Presentation

| Mechanic | Status | Notes |
|---|---|---|
| Graphics, debug, texture skins | [done] | |
| Spine ring skin and Spine pointer | [done] | `pixi-wheels/spine` |
| Pointer flap physics | [done] | |
| Authored studio wheels | [partial] | Playson composed from atlas; Pragmatic textures; Spine skeleton authored from the Playson atlas is on the list |
| Section highlight / win pulse | [partial] | `highlight(id)` on the skins; a built-in pulse loop is not |
| Particles on landing | [todo] | recipe territory |

## Tooling

| Mechanic | Status | Notes |
|---|---|---|
| Configs round-trip, templates | [done] | |
| Studio with export | [done] | JSON + runnable project |
| Headless harness | [done] | |
| Debug overlay, ASCII arc, window handle | [done] | |
| Playwright coverage of the recipe pages | [todo] | |
