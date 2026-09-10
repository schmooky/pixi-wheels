---
"pixi-wheels": minor
---

Rich labels and fit helpers.

- A section can carry `content`: any PixiJS container (a `Text`, a `Sprite`, a `BitmapText`, a Spine instance, a group), or a factory that builds one from a `LabelContext`. The label layer places, rotates and fits it like a text label and re-fits it whenever the geometry changes. `toConfig()` keeps the text `label` and drops `content`.
- New label orientation `'tangential-in'`: the top of the label toward the hub, for wheels read from six o'clock.
- New `labelFit` style (`'contain'`, `'cover'`, `'width'`, `'height'`, `'none'`) and the helpers behind it: `scaleToFit`, `fitContainer`, `fitText`, `labelSlot`, `chordAt`.
- `SpineRingSkin` gains `labels: true` to draw section labels or content on the disc above the skeleton, and a `labels` getter.
- `SectionLabels.get()` now returns the label view (text or content); `text()` returns the `Text` of a plain label.
- The debug overlay HUD sits inside the ring's bounding square by default (`hud: 'inside'`), so a canvas fitted to the wheel never crops it; `hud: 'below'` keeps the old placement.
