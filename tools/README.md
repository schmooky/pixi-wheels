# Tools

## Spine converters

`spine-3.8-to-4.2/` turns Spine 3.8 exports (binary `.skel` or JSON) into Spine 4.2 JSON that `@esotericsoftware/spine-pixi-v8` loads; `spine-3.7-to-4.2/` is the JSON-only sibling for 3.7 exports. Atlases and textures need no change.

```bash
python3 tools/spine-3.8-to-4.2/convert.py path/to/*.skel -o out/
node tools/spine-3.8-to-4.2/validate42.mjs out/*.json      # loads and plays every animation on spine-core 4.2
```

Use them on a studio's wheel skeleton, then point `SpineRingSkin` at the converted JSON and the original atlas.

## The Playson wheel on the docs site

The Four Charged Clovers: Super Wheel art under `apps/site/public/playson-wheel/` is the game's own atlas (converted to WebP). The game's Spine skeleton did not survive the capture the art came from (its binary was stored as text), so the docs site composes the wheel from the atlas parts in `apps/site/src/runtime/playsonWheel.ts` instead of converting a skeleton. When a clean `.skel` export is available, the converter above turns it into 4.2 JSON and `SpineRingSkin` takes it directly.
