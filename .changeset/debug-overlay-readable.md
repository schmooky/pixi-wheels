---
"pixi-wheels": minor
---

Readable debug overlay. The HUD is a screen-space panel in a corner of the canvas (`hud`: `'top-left'` by default, or another corner with `screen: app.screen`, or `{ x, y }`, or `false`) instead of a plate drawn over the wheel. Section ids and angles, the pointer's local angle and the target sit on upright pills just inside the rim at a constant screen size whatever the wheel's scale; `fontSize` sets it. The `'inside'` / `'below'` HUD options are gone.
