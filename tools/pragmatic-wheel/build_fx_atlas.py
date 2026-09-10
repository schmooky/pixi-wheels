#!/usr/bin/env python3
"""Rebuild a Spine atlas for a skeleton whose regions live in NGUI UIAtlas sheets.

Some HTML5 builds ship Spine skeletons as JSON but pack their images into the
game's general UI atlases (NGUI `spriteList` rectangles with `paddingX` trim
values) instead of a Spine atlas. This script collects every attachment path
the skeleton names, cuts the sprites out of the UI sheets, packs them onto a
fresh page and writes a Spine-format `.atlas` next to a WebP page, so
`@esotericsoftware/spine-pixi-v8` can load the skeleton unchanged.

Inputs:
  skeleton   Spine 4.2 JSON (after tools/spine-3.7-to-4.2/convert.py)
  named      JSON map  "s_<path>" -> [[texture_guid, rect, ...]] where rect has
             x, y, width, height, optional rotate, paddingLeft/Top/Right/Bottom
  textures   directory of "Texture__<guid>.png" sheets
  out        output directory
  name       atlas / page base name

Options:
  --scale S   downscale the art (0.5 halves retina sheets). Attachment sizes in
              the skeleton are unaffected: they are draw sizes, not texel sizes.
  --width W   page width (default 2048). Height grows to fit.

Usage:
  python3 tools/pragmatic-wheel/build_fx_atlas.py skel.json named.json textures/ out/ whh_wheel_fx --scale 0.5
"""
import argparse
import json
import os
import sys

from PIL import Image


def collect_paths(skel):
    paths = set()
    for skin in skel.get("skins", []):
        for slot, atts in (skin.get("attachments") or {}).items():
            for name, a in atts.items():
                if a.get("type", "region") != "region":
                    continue
                paths.add(a.get("path") or name)
    return sorted(paths)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("skeleton")
    ap.add_argument("named")
    ap.add_argument("textures")
    ap.add_argument("out")
    ap.add_argument("name")
    ap.add_argument("--scale", type=float, default=1.0)
    ap.add_argument("--width", type=int, default=2048)
    ap.add_argument("--prefix", default="s_", help="sprite-name prefix in the named map")
    args = ap.parse_args()

    skel = json.load(open(args.skeleton))
    named = json.load(open(args.named))
    sheets = {}
    for fn in os.listdir(args.textures):
        if fn.startswith("Texture__") and fn.endswith(".png"):
            sheets[fn.split("__")[1].split(".")[0]] = os.path.join(args.textures, fn)
    pages = {}

    def sheet(guid):
        if guid not in pages:
            pages[guid] = Image.open(sheets[guid]).convert("RGBA")
        return pages[guid]

    items = []
    for path in collect_paths(skel):
        key = args.prefix + path
        if key not in named:
            print(f"warning: no sprite for attachment path {path!r}", file=sys.stderr)
            continue
        guid, rect, *_ = named[key][0]
        im = sheet(guid)
        x, y, w, h = rect.get("x", 0), rect.get("y", 0), rect["width"], rect["height"]
        if rect.get("rotate"):
            # NGUI stores rotated sprites turned 90 degrees counter-clockwise; turning
            # clockwise restores the authored orientation.
            crop = im.crop((x, y, x + h, y + w)).rotate(-90, expand=True)
        else:
            crop = im.crop((x, y, x + w, y + h))
        pl, pt = rect.get("paddingLeft", 0), rect.get("paddingTop", 0)
        pr, pb = rect.get("paddingRight", 0), rect.get("paddingBottom", 0)
        s = args.scale
        if s != 1.0:
            crop = crop.resize((max(1, round(crop.width * s)), max(1, round(crop.height * s))), Image.LANCZOS)
        items.append(
            {
                "path": path,
                "im": crop,
                "orig": (round((w + pl + pr) * s), round((h + pt + pb) * s)),
                # Spine offsets count from the bottom-left of the original image.
                "offset": (round(pl * s), round(pb * s)),
            }
        )

    # Shelf packing, tallest first, 2px gutters.
    items.sort(key=lambda it: (-it["im"].height, -it["im"].width))
    W = args.width
    gutter = 2
    x = y = shelf_h = gutter
    placed = []
    for it in items:
        w, h = it["im"].size
        if w + gutter > W:
            raise SystemExit(f"{it['path']} is wider than the page ({w} > {W}); raise --width or lower --scale")
        if x + w + gutter > W:
            x = gutter
            y += shelf_h + gutter
            shelf_h = 0
        it["xy"] = (x, y)
        placed.append(it)
        x += w + gutter
        shelf_h = max(shelf_h, h)
    H = y + shelf_h + gutter
    page = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    for it in placed:
        page.paste(it["im"], it["xy"])

    os.makedirs(args.out, exist_ok=True)
    page_file = f"{args.name}.webp"
    page.save(os.path.join(args.out, page_file), "WEBP", quality=90, method=6, exact=True)
    lines = ["", page_file, f"size: {W},{H}", "format: RGBA8888", "filter: Linear,Linear", "repeat: none"]
    for it in placed:
        w, h = it["im"].size
        lines += [
            it["path"],
            "  rotate: false",
            f"  xy: {it['xy'][0]}, {it['xy'][1]}",
            f"  size: {w}, {h}",
            f"  orig: {it['orig'][0]}, {it['orig'][1]}",
            f"  offset: {it['offset'][0]}, {it['offset'][1]}",
            "  index: -1",
        ]
    open(os.path.join(args.out, f"{args.name}.atlas"), "w").write("\n".join(lines) + "\n")
    print(f"{len(placed)} regions on {W}x{H} -> {args.out}/{args.name}.atlas + {page_file}")


if __name__ == "__main__":
    main()
