# pixi-wheels

## 0.1.0

First public release. The entries below are the changesets that accumulated on the way to it; nothing before 0.1.0 was published, so a removal listed here undoes something that never shipped.

### Minor Changes

- [`a0eecc0`](https://github.com/schmooky/pixi-wheels/commit/a0eecc08be3f416445b6b9f537e39d7e7c4a298d) Thanks [@igaming-bulochka](https://github.com/igaming-bulochka)! - Audit fixes across the package.
  
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
  - `FakeTicker.add()` is typed with the exported `TickerCallback` instead of a private twin of it.

- [`76905f7`](https://github.com/schmooky/pixi-wheels/commit/76905f7105eec4823e7e225906a99adbcfda2861) Thanks [@igaming-bulochka](https://github.com/igaming-bulochka)! - Readable debug overlay. The HUD is a screen-space panel in a corner of the canvas (`hud`: `'top-left'` by default, or another corner with `screen: app.screen`, or `{ x, y }`, or `false`) instead of a plate drawn over the wheel. Section ids and angles, the pointer's local angle and the target sit on upright pills just inside the rim at a constant screen size whatever the wheel's scale; `fontSize` sets it. The `'inside'` / `'below'` HUD options are gone.

- [`b473ae9`](https://github.com/schmooky/pixi-wheels/commit/b473ae90b861b1171d37b1609b18cd41c6d122f6) Thanks [@igaming-bulochka](https://github.com/igaming-bulochka)! - Anticipation reworked so the wheel comes to rest exactly once, on the result.
  
  - Every tease rests the pointer just inside the target, next to the divider it shares with the bait (`rest`: 0.22 of the arc after crossing the line, 0.15 when it died short of it). `rest: 'keep'` leaves the landing mode in charge; explicit offsets, angle / position targets and `mode: 'exact'` are never moved. Add `settle: 'center'` to glide to the middle afterwards.
  - New style `stall` replaces `overshoot`: the pointer enters the result, crawls toward the bait's line as if it will cross, and dies just short of it. No stop inside the bait, no roll back. `auto` picks it when the bait follows the target.
  - `stutter` no longer halts: the crawl slows to `hesitateSpeed` (2 deg/s) for `dwellMs` (600) a hair short of the line, then slips over it in `pushMs` (700) on a curve that takes over at the crawl speed.
  - Removed `overshootDeg` and `returnMs`; added `hesitateSpeed` and `approachDeg` (stall crawl length, default the target's arc, at most 45). New leg kind `hesitate`; `return` is gone. New exports `DEFAULT_ANTICIPATION` and `hermiteStopEase`.

- [`68306dc`](https://github.com/schmooky/pixi-wheels/commit/68306dc7172940c61872f59122bfe80b53309117) Thanks [@igaming-bulochka](https://github.com/igaming-bulochka)! - Rich labels and fit helpers.
  
  - A section can carry `content`: any PixiJS container (a `Text`, a `Sprite`, a `BitmapText`, a Spine instance, a group), or a factory that builds one from a `LabelContext`. The label layer places, rotates and fits it like a text label and re-fits it whenever the geometry changes. `toConfig()` keeps the text `label` and drops `content`.
  - New label orientation `'tangential-in'`: the top of the label toward the hub, for wheels read from six o'clock.
  - New `labelFit` style (`'contain'`, `'cover'`, `'width'`, `'height'`, `'none'`) and the helpers behind it: `scaleToFit`, `fitContainer`, `fitText`, `labelSlot`, `chordAt`.
  - `SpineRingSkin` gains `labels: true` to draw section labels or content on the disc above the skeleton, and a `labels` getter.
  - `SectionLabels.get()` now returns the label view (text or content); `text()` returns the `Text` of a plain label.
  - The debug overlay HUD sits inside the ring's bounding square by default (`hud: 'inside'`), so a canvas fitted to the wheel never crops it; `hud: 'below'` keeps the old placement.

- [`7c45d1f`](https://github.com/schmooky/pixi-wheels/commit/7c45d1fbd12c0a750370d24c6dcce41d9c71ef6b) Thanks [@igaming-bulochka](https://github.com/igaming-bulochka)! - The tongue and the pegs are now two solids that may not overlap. The blade is a triangle hinged at the pin - `tipWidth` across at its base, tapering to a point at the tip - and the peg is a circle; each frame the contact solves for the smallest swing that keeps the circle outside the triangle. So the tongue yields exactly as far as the peg needs, never cuts through one at any speed or frame rate, and does not fall until the peg has actually gone: on the way down the spring only moves it into clear air. The old model pushed the tip along a curve that had no idea where the peg's edge was, which showed as the blade clipping straight through pegs.
  
  Falling out of that: `pegs.inset` now defaults to `tipInset + size - 2` (the peg ring just inside the first tongue's tip, a 2 px bite) instead of a flat 9, since pegs out past the tip force the blade to lift clear over them - a much bigger flap. `DEFAULT_FLAP.maxAngle` is 45, up from 28, so the default geometry has room to clear; a `maxAngle` below what the geometry needs is reported once. `elasticity` now means "how far past the minimum", clamped at 1, because yielding less than the geometry is a blade drawn through a peg. `friction` is a fatter peg: a bigger swing, held longer.
  
  The contact is solved from where the blade already stands, not from rest: a blade shoved past a peg cannot get home the way it came, and a solver looking for "the smallest swing from zero" hands it an answer on the wrong side. While a peg carries the blade it has no velocity of its own, so the release is one clean swing instead of a flung overshoot chattering against the peg it just cleared. `elasticity` and `friction` are both padding on the peg now - a fatter peg swings the blade wider and holds it longer - which keeps them from fighting the contact. A wheel standing still with a peg under the tongue leans the tongue off it instead of leaving it sitting inside.
  
  Pegs on the rim work as well as pegs inside the tip, and the two read very differently. A peg sitting deep under the tip cannot slip past sideways, so the blade rides up until its tip lifts clear over it - a 40 to 60 degree swing, the carnival clack - where a shallow bite is a 10 to 20 degree ratchet. The only thing to get right is `maxAngle`, and when a cap is below what the geometry needs the warning now names the angle it needs.

- [`5dbe904`](https://github.com/schmooky/pixi-wheels/commit/5dbe904f6784f33476b7cb3a53f14a9a31e3009b) Thanks [@igaming-bulochka](https://github.com/igaming-bulochka)! - `flap.drag`: the tongue can hold the ring back. While a peg climbs the tip, the disc is drawn up to one contact width of arc behind itself, and springs forward at `dragRelease` once the peg is over the crown, so a wheel crawling to a stop visibly fights every peg. The hold is drawn only: `rotationDeg`, the crossings and the landing never see it, and it relaxes to zero whenever the ring is not moving, so the wheel still comes to rest exactly on its result. New: `FlapConfig.drag` (0 by default) and `FlapConfig.dragRelease`, `Ring.visualRotationDeg`, `Ring.dragDeg`, `Pointer.dragDeg`, and a `drag` field on the debug snapshot. The debug HUD prints the held arc while it is non-zero.

- [`0268993`](https://github.com/schmooky/pixi-wheels/commit/02689933c582b11f87f21bedd6a8c18f60d065c9) Thanks [@igaming-bulochka](https://github.com/igaming-bulochka)! - The tongue is drawn and pushed like something actually hung on a pin. `GraphicsPointerSkin` builds every shape from one body - a boss around the pin, tapering to the tip, with the tip's far edge exactly `length` from the pin - instead of a free-hand curve that ignored both. New `pinRadius` option sizes the pin; the boss grows to clear it, and the pin is drawn as a cap with a hole rather than a dot. `Pointer` now checks that the peg ring runs between the pin and the tip before deflecting: pegs deeper than the tip, or outside the pin, cannot touch the tongue, so it stays still and says so once instead of swinging from nothing. New `Pointer.tipRadius` and `Pointer.reaches(pegs)`, and `createTestWheel({ pegs })` in the test harness. The debug overlay's pointer mark is the pointer's real body too - pin to tip, swung by the deflection, with the rest axis behind it - instead of a short tick at the rim that made the art look like it pivoted somewhere else.

- [`a6a7d21`](https://github.com/schmooky/pixi-wheels/commit/a6a7d21d53b23d880fd0ff908f8ba9f3b041bb8e) Thanks [@igaming-bulochka](https://github.com/igaming-bulochka)! - A physical tongue on pegs.
  
  - Every ring has pegs: small circles on the disc, one per divider by default (`.pegs({ size, inset, angles })`, `.pegs(false)` for none), following dynamic sections. `ring.pegs` exposes them, `RingSkinContext.pegs` hands them to skins, `GraphicsRingSkin` draws them with `pegs: true`, and the debug overlay's new `pegs` layer draws them with the peg being ridden and each tongue's contact zone.
  - The flap is now contact physics: a peg pushes the tongue aside along its rim as it comes through (scaled by `elasticity`), carries it on its crown until the peg is through plus `friction` of the contact width, then lets go into the spring (`stiffness`, `damping`, `maxAngle`). `tipWidth` sets how early a peg starts pushing. At speed a peg that passes within one frame flicks the tongue to the crown. `kick` and `referenceSpeed` are gone.
  - `Pointer` exposes `deflection`, `engagedPeg`, `flap`, `pinRadius` and `contactHalfWidth()`; the HUD prints the first tongue's deflection. The studio gets Pegs and flap fields; `RingConfig.pegs` round-trips.

### Patch Changes

- [`cf98db8`](https://github.com/schmooky/pixi-wheels/commit/cf98db816c8ee50be5841a63c7429f0c31f108ae) Thanks [@igaming-bulochka](https://github.com/igaming-bulochka)! - Speed presets ask for stops they can reach. `NORMAL` allows a single turn (its 4.2 s stop needed two turns of 5.3 s before), `TURBO` asks for 2.0 s, `CINEMATIC` asks for 8 s over one to six turns (it asked for 6.5 s with a three-turn minimum of 12 s). A unit test holds every preset's `stopDuration` inside its turn range. Demos on the docs site spin in five to eight seconds instead of nine to seventeen.
