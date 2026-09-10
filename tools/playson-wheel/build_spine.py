#!/usr/bin/env python3
"""Author the Playson "Four Charged Clovers: Super Wheel" wheel as Spine 4.2.

The game's own skeleton did not survive the capture the art came from (its
binary was stored as text), but its atlas did, with every plate, bezel piece,
bulb, glow and frame sequence the skeleton used. This script rebuilds a
skeleton over that atlas so `SpineRingSkin` can drive the real art with the
real effects:

  wheel-skeleton.json    root > wheel (the bone the engine turns) > sector_00..11
                         plates, bevels, clover icons, tier titles, dividers on the
                         wheel; bezel, bulbs, hub glow on the root.
                         idle: bulbs alternate, hub glow breathes.
                         spin: bulb chase, back glow up.
                         win_00..win_11: sector sweep frames, sector glow, gold
                         sparkle (coins) or title/clover glow (tiers, features),
                         rainbow shockwave over the plate, bulbs strobe.
  stopper-skeleton.json  root > stopper: the game's stopper with a `tick` swing.

Both use the shipped `wheel.atlas` unchanged. Region sizes are read from it.

  python3 tools/playson-wheel/build_spine.py
  node tools/spine-3.8-to-4.2/validate42.mjs apps/site/public/playson-wheel/*-skeleton.json
"""
import json
import math
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ATLAS = os.path.join(ROOT, "apps/site/public/playson-wheel/wheel.atlas")
OUT = os.path.join(ROOT, "apps/site/public/playson-wheel")

# The plates are 297 px tall with their apex on the hub: that is the authored radius.
R = 297.0
BEZEL_R1, BEZEL_R2 = 282.4, 316.8
BULB_R = (BEZEL_R1 + BEZEL_R2) / 2
FPS = 30.0

# The game's section order, clockwise from twelve o'clock.
ORDER = ["mini", "coin", "collect", "coin", "minor", "coin", "mystery", "coin", "major", "coin", "multi", "coin"]

# Plates were exported with the apex at the top ('up') or the bottom ('down') of the image.
PLATES = {
    "mini": {"base": "wheel/mini/mini_sector", "apex": "up", "title": "wheel/mini/mini_title", "title_glow": "wheel/mini/mini_title_glow_add"},
    "minor": {"base": "wheel/minor/minor_sector", "apex": "down", "title": "wheel/minor/minor_title", "title_glow": "wheel/minor/minor_title_glow_add"},
    "major": {"base": "wheel/major/major_sector", "apex": "down", "title": "wheel/major/major_title", "title_glow": "wheel/major/major_title_glow_add"},
    "coin": {"base": "wheel/coin_sector_1", "apex": "down"},
    "collect": {"base": "wheel/collect/collect_sector_bg", "apex": "up", "bevel": "wheel/collect/collect_sector_bavel", "bevel_apex": "up", "icon": "wheel/collect/collect_sector_bg_clover", "icon_glow": "wheel/collect/collect_sector_bg_clover_glow"},
    "multi": {"base": "wheel/multi/multi_sector_bg", "apex": "down", "bevel": "wheel/multi/multi_sector_bavel", "bevel_apex": "down", "icon": "wheel/multi/multi_sector_bg_clover", "icon_glow": "wheel/multi/multi_sector_bg_clover_glow"},
    "mystery": {"base": "wheel/mystery/mystery_sector_bg", "apex": "down", "bevel": "wheel/mystery/mystery_sector_bavel", "bevel_apex": "down", "icon": "wheel/mystery/mystery_sector_bg_clover", "icon_glow": "wheel/mystery/mystery_sector_bg_clover_glow"},
}
# Effect wedges. The sweep frames were exported wide end up (apex at the bottom of
# the image); the sector glow and the small gold cone have their apex at the top.
SWEEP_APEX = "down"
GLOW_APEX = "up"
GOLD_APEX = "up"


def parse_atlas(path):
    regions, page, cur = {}, None, None
    for line in open(path).read().split("\n"):
        if re.match(r"^\S+\.(png|webp)$", line):
            page, cur = line.strip(), None
            continue
        if line and not line.startswith(" ") and ":" not in line:
            cur = {"page": page}
            regions[line.strip()] = cur
            continue
        if cur and ":" in line:
            k, v = line.strip().split(":", 1)
            cur[k.strip()] = v.strip()
    out = {}
    for name, r in regions.items():
        w, h = (int(t) for t in r["orig"].split(","))
        out[name] = (w, h)
    return out


REGIONS = parse_atlas(ATLAS)


def size(name):
    if name not in REGIONS:
        raise SystemExit(f"region {name!r} is not in {ATLAS}")
    return REGIONS[name]


def frames(prefix, count, fmt="{prefix}_{i:02d}"):
    """Frame region names that exist and are not 1x1 placeholders; None where a frame is blank."""
    out = []
    for i in range(count):
        name = fmt.format(prefix=prefix, i=i)
        if name in REGIONS and REGIONS[name] != (1, 1):
            out.append(name)
        else:
            out.append(None)
    return out


def pixi_to_spine(x, y):
    """Screen space (y down, clockwise) to Spine space (y up, counter-clockwise)."""
    return (round(x, 2), round(-y, 2))


def polar(pixi_deg, r):
    return pixi_to_spine(math.cos(math.radians(pixi_deg)) * r, math.sin(math.radians(pixi_deg)) * r)


def arc_bounds(r1, r2, a0, a1):
    pts = []
    for r in (r1, r2):
        for a in (a0, a1):
            pts.append((math.cos(math.radians(a)) * r, math.sin(math.radians(a)) * r))
        for axis in (-360, -270, -180, -90, 0, 90, 180, 270, 360):
            if a0 < axis < a1:
                pts.append((math.cos(math.radians(axis)) * r, math.sin(math.radians(axis)) * r))
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    return (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2


class Skeleton:
    def __init__(self, name):
        self.name = name
        self.bones = [{"name": "root"}]
        self.slots = []
        self.attachments = {}
        self.animations = {}

    def bone(self, name, parent="root", **kw):
        self.bones.append({"name": name, "parent": parent, **kw})

    def slot(self, name, bone, attachment=None, blend=None, color=None):
        s = {"name": name, "bone": bone}
        if attachment:
            s["attachment"] = attachment
        if blend:
            s["blend"] = blend
        if color:
            s["color"] = color
        self.slots.append(s)
        self.attachments.setdefault(name, {})

    def region(self, slot, name, path, x=0.0, y=0.0, rotation=0.0, scale=1.0, scale_y=None):
        w, h = size(path)
        a = {"path": path, "width": w, "height": h}
        if x:
            a["x"] = round(x, 2)
        if y:
            a["y"] = round(y, 2)
        if rotation:
            a["rotation"] = round(rotation, 2)
        if scale != 1.0:
            a["scaleX"] = round(scale, 4)
            a["scaleY"] = round(scale_y if scale_y is not None else scale, 4)
        self.attachments[slot][name] = a

    def anim(self, name):
        return self.animations.setdefault(name, {"slots": {}, "bones": {}})

    def to_json(self, extent):
        return {
            "skeleton": {"hash": self.name, "spine": "4.2.43", "x": -extent, "y": -extent, "width": 2 * extent, "height": 2 * extent, "images": "./", "audio": ""},
            "bones": self.bones,
            "slots": self.slots,
            "skins": [{"name": "default", "attachments": self.attachments}],
            "animations": {k: {kk: vv for kk, vv in v.items() if vv} for k, v in self.animations.items()},
        }


def wedge(sk, slot, name, path, apex, r_center, scale=1.0):
    """Seat a wedge image on a sector bone: apex at the hub, wide end outward along the bone's +x."""
    rotation = -90 if apex == "down" else 90  # image up outward, or image down outward
    sk.region(slot, name, path, x=r_center, rotation=rotation, scale=scale)


def attachment_keys(frame_names, start, fps=FPS, end_null=True):
    keys = []
    for i, n in enumerate(frame_names):
        keys.append({"time": round(start + i / fps, 4), "name": n})
    if end_null:
        keys.append({"time": round(start + len(frame_names) / fps, 4), "name": None})
    return keys


def rgba_keys(points):
    out = []
    for t, alpha in points:
        a = max(0, min(255, round(alpha * 255)))
        out.append({"time": round(t, 4), "color": f"ffffff{a:02x}"})
    return out


def build_wheel():
    sk = Skeleton("playson-super-wheel")
    sk.bone("wheel", "root")
    mids = []
    for i in range(12):
        mid = -90 + 30 * i + 15  # screen degrees, clockwise
        mids.append(mid)
        sk.bone(f"sector_{i:02d}", "wheel", rotation=-mid, length=R)

    # Behind everything: the additive back glow, then the shadow ring the game keeps under the wheel.
    sk.slot("back_glow", "root", "glow", blend="additive", color="ffffff99")
    sk.region("back_glow", "glow", "wheel/wheel_back_glow_1_add", scale=(2 * R * 1.12) / size("wheel/wheel_back_glow_1_add")[0])

    # Plates: every slot holds all seven plates so a consumer can re-seat the wheel with setAttachment().
    for i, kind in enumerate(ORDER):
        b = f"sector_{i:02d}"
        sk.slot(f"plate_{i:02d}", b, kind)
        for k, d in PLATES.items():
            wedge(sk, f"plate_{i:02d}", k, d["base"], d["apex"], size(d["base"])[1] / 2)
    for i, kind in enumerate(ORDER):
        b = f"sector_{i:02d}"
        d = PLATES[kind]
        sk.slot(f"bevel_{i:02d}", b, kind if "bevel" in d else None)
        for k, dd in PLATES.items():
            if "bevel" in dd:
                wedge(sk, f"bevel_{i:02d}", k, dd["bevel"], dd["bevel_apex"], size(dd["bevel"])[1] / 2)
    # Dividers on every boundary, on the wheel bone.
    for i in range(12):
        a = -90 + 30 * i
        sk.slot(f"divider_{i:02d}", "wheel", "divider")
        x, y = polar(a, R * 0.98 + size("wheel/divider")[1] / 2)
        sk.region(f"divider_{i:02d}", "divider", "wheel/divider", x=x, y=y, rotation=-a - 90)
    # Icons and titles.
    for i, kind in enumerate(ORDER):
        b = f"sector_{i:02d}"
        d = PLATES[kind]
        sk.slot(f"icon_{i:02d}", b, kind if "icon" in d else None)
        for k, dd in PLATES.items():
            if "icon" in dd:
                sk.region(f"icon_{i:02d}", k, dd["icon"], x=R * 0.64, rotation=-90, scale=0.9)
        sk.slot(f"title_{i:02d}", b, kind if "title" in d else None)
        for k, dd in PLATES.items():
            if "title" in dd:
                sk.region(f"title_{i:02d}", k, dd["title"], x=R * 0.66, rotation=-90, scale=0.95)

    # Effects per sector, hidden in the setup pose.
    sweep = frames("wheel/sector_sweep/sector_sweep", 20)
    sweep_names = [n for n in sweep if n]
    gold = [n for n in frames("gold_sec_fx/gold_sec_fx", 30) if n]
    shock = [n for n in frames("shockwave_rainbow_fx/shockwave_rainbow_fx", 30) if n]
    for i, kind in enumerate(ORDER):
        b = f"sector_{i:02d}"
        d = PLATES[kind]
        # Additive so the glow lights the plate instead of painting over it.
        sk.slot(f"glow_{i:02d}", b, "glow", blend="additive", color="ffffff00")
        wedge(sk, f"glow_{i:02d}", "glow", "wheel/sector_glow", GLOW_APEX, R / 2)
        sk.slot(f"sweep_{i:02d}", b, None, blend="additive")
        for n in sweep_names:
            wedge(sk, f"sweep_{i:02d}", n.rsplit("/", 1)[1], n, SWEEP_APEX, R / 2)
        sk.slot(f"gold_{i:02d}", b, None, blend="additive")
        for n in gold:
            wedge(sk, f"gold_{i:02d}", n.rsplit("/", 1)[1], n, GOLD_APEX, R * 0.45, scale=1.6)
        sk.slot(f"title_glow_{i:02d}", b, kind if "title_glow" in d else None, blend="additive", color="ffffff00")
        for k, dd in PLATES.items():
            if "title_glow" in dd:
                sk.region(f"title_glow_{i:02d}", k, dd["title_glow"], x=R * 0.66, rotation=-90, scale=0.95)
        sk.slot(f"icon_glow_{i:02d}", b, kind if "icon_glow" in d else None, blend="additive", color="ffffff00")
        for k, dd in PLATES.items():
            if "icon_glow" in dd:
                sk.region(f"icon_glow_{i:02d}", k, dd["icon_glow"], x=R * 0.64, rotation=-90, scale=0.9)
        sk.slot(f"burst_{i:02d}", b, None, blend="additive")
        for n in shock:
            sk.region(f"burst_{i:02d}", n.rsplit("/", 1)[1], n, x=R * 0.6, scale=1.7)

    # Fixed parts on the root: bezel pieces, bulbs, hub.
    for i in range(12):
        name = f"wheel/frame_parts/frame_back_{i + 1:02d}"
        if name not in REGIONS:
            continue
        center = -90 + i * 30
        cx, cy = arc_bounds(BEZEL_R1, BEZEL_R2, center - 15, center + 15)
        x, y = pixi_to_spine(cx, cy)
        sk.slot(f"bezel_{i:02d}", "root", "piece")
        sk.region(f"bezel_{i:02d}", "piece", name, x=x, y=y)
    for i in range(24):
        a = -90 + 15 * i
        x, y = polar(a, BULB_R)
        sk.slot(f"bulb_{i:02d}", "root", "on" if i % 2 == 0 else "off")
        sk.region(f"bulb_{i:02d}", "on", "wheel/bulb_active", x=x, y=y)
        sk.region(f"bulb_{i:02d}", "off", "wheel/bulb", x=x, y=y)
    sk.slot("hub_glow", "root", "glow", blend="additive", color="ffffff88")
    sk.region("hub_glow", "glow", "wheel/center_outer_glow_1_add2", scale=1.6)
    sk.slot("hub", "root", "center")
    sk.region("hub", "center", "wheel/center")

    # --- animations -------------------------------------------------------
    def bulbs(anim, keys_for):
        """keys_for(i) -> list of (time, 'on'|'off')."""
        for i in range(24):
            anim["slots"][f"bulb_{i:02d}"] = {"attachment": [{"time": round(t, 4), "name": n} for t, n in keys_for(i)]}

    idle = sk.anim("idle")  # 1.0 s loop
    bulbs(idle, lambda i: [(0, "on" if i % 2 == 0 else "off"), (0.5, "off" if i % 2 == 0 else "on"), (1.0, "on" if i % 2 == 0 else "off")])
    idle["slots"]["hub_glow"] = {"rgba": rgba_keys([(0, 0.45), (0.5, 0.85), (1.0, 0.45)])}
    idle["slots"]["back_glow"] = {"rgba": rgba_keys([(0, 0.55), (0.5, 0.7), (1.0, 0.55)])}

    spin = sk.anim("spin")  # 0.36 s loop, three-phase chase
    step = 0.12
    bulbs(spin, lambda i: [(k * step, "on" if (i + k) % 3 == 0 else "off") for k in range(3)] + [(3 * step, "on" if i % 3 == 0 else "off")])
    spin["slots"]["back_glow"] = {"rgba": rgba_keys([(0, 0.95)])}
    spin["slots"]["hub_glow"] = {"rgba": rgba_keys([(0, 0.95)])}

    for i, kind in enumerate(ORDER):
        win = sk.anim(f"win_{i:02d}")  # 2.4 s
        d = PLATES[kind]
        win["slots"][f"glow_{i:02d}"] = {"rgba": rgba_keys([(0, 0), (0.15, 0.75), (0.6, 0.45), (1.0, 0.75), (1.4, 0.45), (1.9, 0.7), (2.4, 0)])}
        win["slots"][f"sweep_{i:02d}"] = {"attachment": attachment_keys([n.rsplit("/", 1)[1] for n in sweep_names], 0.0)}
        win["slots"][f"burst_{i:02d}"] = {"attachment": attachment_keys([n.rsplit("/", 1)[1] for n in shock], 0.05)}
        if kind == "coin":
            win["slots"][f"gold_{i:02d}"] = {"attachment": attachment_keys([n.rsplit("/", 1)[1] for n in gold], 0.5)}
        if "title_glow" in d:
            win["slots"][f"title_glow_{i:02d}"] = {"rgba": rgba_keys([(0, 0), (0.3, 1), (0.8, 0.2), (1.2, 1), (1.7, 0.2), (2.1, 1), (2.4, 0)])}
        if "icon_glow" in d:
            win["slots"][f"icon_glow_{i:02d}"] = {"rgba": rgba_keys([(0, 0), (0.3, 1), (0.8, 0.2), (1.2, 1), (1.7, 0.2), (2.1, 1), (2.4, 0)])}
        # Bulbs strobe together, then settle into the idle parity.
        def strobe(j):
            keys = []
            t = 0.0
            on = True
            while t < 1.2:
                keys.append((t, "on" if on else "off"))
                on = not on
                t += 0.1
            keys.append((1.2, "on" if j % 2 == 0 else "off"))
            keys.append((2.4, "on" if j % 2 == 0 else "off"))
            return keys
        bulbs(win, strobe)
        win["slots"]["back_glow"] = {"rgba": rgba_keys([(0, 1), (0.4, 0.6), (0.8, 1), (2.4, 0.6)])}
        win["slots"]["hub_glow"] = {"rgba": rgba_keys([(0, 1), (2.4, 0.5)])}

    return sk.to_json(340)


def build_stopper():
    sk = Skeleton("playson-super-wheel-stopper")
    # The bone points down (Spine -y); the pin is its origin, 30% down the stopper image.
    sk.bone("stopper", "root", rotation=-90, length=100)
    w, h = size("wheel/stopper")
    pin = 0.3 * h
    sk.slot("shadow", "stopper", "shadow", color="ffffffaa")
    sk.region("shadow", "shadow", "wheel/stopper_shadow", x=pin * 0.6, y=-6, rotation=90)
    sk.slot("stopper", "stopper", "stopper")
    sk.region("stopper", "stopper", "wheel/stopper", x=h / 2 - pin, rotation=90)
    idle = sk.anim("idle")
    idle["bones"]["stopper"] = {"rotate": [{"time": 0, "value": 0}]}
    tick = sk.anim("tick")
    tick["bones"]["stopper"] = {
        "rotate": [
            {"time": 0, "value": 0},
            {"time": 0.04, "value": -14},
            {"time": 0.12, "value": 7},
            {"time": 0.2, "value": 0},
        ]
    }
    return sk.to_json(160)


def main():
    wheel = build_wheel()
    stopper = build_stopper()
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, "wheel-skeleton.json"), "w") as f:
        json.dump(wheel, f, separators=(",", ":"))
    with open(os.path.join(OUT, "stopper-skeleton.json"), "w") as f:
        json.dump(stopper, f, separators=(",", ":"))
    n_att = sum(len(v) for v in wheel["skins"][0]["attachments"].values())
    print(f"wheel-skeleton.json: {len(wheel['bones'])} bones, {len(wheel['slots'])} slots, {n_att} attachments, animations {sorted(wheel['animations'])}")
    print(f"stopper-skeleton.json: animations {sorted(stopper['animations'])}")


if __name__ == "__main__":
    main()
