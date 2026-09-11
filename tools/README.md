# Tools

## Spine converters

`spine-3.8-to-4.2/` turns Spine 3.8 exports (binary `.skel` or JSON) into Spine 4.2 JSON that `@esotericsoftware/spine-pixi-v8` loads; `spine-3.7-to-4.2/` is the JSON-only sibling for 3.7 exports. Atlases and textures need no change.

```bash
python3 tools/spine-3.8-to-4.2/convert.py path/to/*.skel -o out/
node tools/spine-3.8-to-4.2/validate42.mjs out/*.json      # loads and plays every animation on spine-core 4.2
```

Use them on a studio's wheel skeleton, then point `SpineRingSkin` at the converted JSON and the original atlas.

## The Playson wheel on the docs site

The Four Charged Clovers: Super Wheel art under `apps/site/public/playson-wheel/` is the game's own atlas (converted to WebP). The game's Spine skeleton did not survive the capture the art came from (its binary was stored as text), so the docs site does two things with the atlas:

- `apps/site/src/runtime/playsonWheel.ts` composes the wheel from the atlas parts as a custom ring skin.
- `playson-wheel/build_spine.py` authors Spine 4.2 skeletons over the atlas: `wheel-skeleton.json` (the `wheel` bone the engine turns, plates, bezel, bulbs; `idle`, `spin` and one `win_NN` per sector with the game's sector sweep, glow, gold sparkle and shockwave frames) and `stopper-skeleton.json` (the stopper with a `tick` swing). `SpineRingSkin` and `SpinePointerSkin` load them with the unchanged `wheel.atlas`.

```bash
python3 tools/playson-wheel/build_spine.py
node tools/spine-3.8-to-4.2/validate42.mjs apps/site/public/playson-wheel/*-skeleton.json
```

The wheel's sounds under `apps/site/public/playson-wheel/audio/` are the game's own, played through `@schmooky/zvuk` in the sound hooks and Spine recipes.

## The Pragmatic wheel on the docs site

Pragmatic Play's Wheel of Happiness ships its `whh_wheel_fx` effects skeleton as Spine 3.7 JSON with its frames packed into the game's NGUI UI atlases. `spine-3.7-to-4.2/convert.py` converts the JSON; `pragmatic-wheel/build_fx_atlas.py` cuts the attachment regions out of the UI sheets by their sprite rectangles (trim paddings become Spine offsets) and writes a Spine atlas over a fresh WebP page:

```bash
python3 tools/spine-3.7-to-4.2/convert.py <dump>/spine <out>
python3 tools/pragmatic-wheel/build_fx_atlas.py <out>/<skeleton>/spineJSON.json <dump>/named.json <dump>/textures apps/site/public/pragmatic-wheel/spine whh_wheel_fx --scale 0.5
```

The plates, hub, pointer and the gold bitmap font next to it are the game's sprites, cut the same way.

## Recipe figures and the sample texture pack

`doc-figures/build_figures.py` draws everything the [disc](https://pixi-wheels.schmooky.dev/recipes/disc-art/) and [tongue](https://pixi-wheels.schmooky.dev/recipes/tongue/) recipes show inline, straight into `apps/site/public/recipes/`:

- **SVG blueprints** of the geometry a texture has to match: the layer stack, the face template, the plate template, atlas trim and rotation, the label slot, the tongue's anatomy, one peg's contact, the release spring and the drag hold. They carry their own dark panel, so they read the same in both site themes.
- **PNG sample textures** drawn to those exact requirements - three faces, two bezels, six plate colours and states, two hubs, a peg, two bulbs, a glow and four tongues - plus `pixi-wheels-textures.zip` with a README naming every file. The recipes load these very bytes, so the picture in the prose is the art in the demo. Generated, MIT, no attribution.

```bash
python3 tools/doc-figures/build_figures.py    # needs Pillow
```

Edit the palette constants at the top to restyle the whole set at once.
