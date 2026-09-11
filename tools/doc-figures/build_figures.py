#!/usr/bin/env python3
"""Build the figures the disc-art and tongue recipes show inline.

Two kinds of output land under `apps/site/public/recipes/`:

* **SVG diagrams** - blueprints of the geometry a texture has to match:
  where the centre is, which edge is section 0, where the pin sits, how far
  a peg pushes the tongue. They carry their own dark panel so they read the
  same in the light and the dark site theme.
* **PNG example textures** - a face, a bezel, a plate, a hub and a tongue,
  drawn to the exact requirements the diagrams state. The recipes load these
  very files, so the picture in the prose and the art in the demo are the
  same bytes.

Run:  python3 tools/doc-figures/build_figures.py
Needs: Pillow (`pip install pillow`).
"""
from __future__ import annotations

import math
import os
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "apps" / "site" / "public" / "recipes"
DISC = OUT / "disc-art"
TONGUE = OUT / "tongue"

# Blueprint palette. Explicit, opaque, theme-independent.
BG = "#0d1117"
PANEL = "#161b22"
GRID = "#20293a"
INK = "#e6edf3"
MUTED = "#8b98a9"
CYAN = "#5ec8f2"
GOLD = "#f0c040"
PINK = "#ff6ac1"
GREEN = "#7ee787"
RED = "#f4664a"

FONT = "ui-monospace, SFMono-Regular, Menlo, monospace"


# ---------------------------------------------------------------- svg helpers

class Svg:
    def __init__(self, w: int, h: int, title: str):
        self.w, self.h = w, h
        self.parts: list[str] = []
        self.parts.append(
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" '
            f'width="{w}" height="{h}" role="img" aria-label="{esc(title)}">'
        )
        self.parts.append(f'<title>{esc(title)}</title>')
        self.parts.append(f'<rect width="{w}" height="{h}" rx="14" fill="{BG}"/>')
        self.parts.append(
            f'<rect x="0.5" y="0.5" width="{w - 1}" height="{h - 1}" rx="14" fill="none" stroke="{GRID}"/>'
        )

    def add(self, markup: str) -> None:
        self.parts.append(markup)

    def text(self, x, y, s, fill=INK, size=13, anchor="start", weight="400", style=""):
        self.add(
            f'<text x="{f(x)}" y="{f(y)}" fill="{fill}" font-family="{FONT}" font-size="{size}" '
            f'font-weight="{weight}" text-anchor="{anchor}"{style}>{esc(s)}</text>'
        )

    def line(self, x1, y1, x2, y2, stroke=MUTED, width=1.2, dash=None, extra=""):
        d = f' stroke-dasharray="{dash}"' if dash else ""
        self.add(
            f'<line x1="{f(x1)}" y1="{f(y1)}" x2="{f(x2)}" y2="{f(y2)}" stroke="{stroke}" '
            f'stroke-width="{width}"{d}{extra}/>'
        )

    def circle(self, cx, cy, r, fill="none", stroke=None, width=1.2, dash=None, opacity=None):
        s = f' stroke="{stroke}" stroke-width="{width}"' if stroke else ""
        d = f' stroke-dasharray="{dash}"' if dash else ""
        o = f' opacity="{opacity}"' if opacity is not None else ""
        self.add(f'<circle cx="{f(cx)}" cy="{f(cy)}" r="{f(r)}" fill="{fill}"{s}{d}{o}/>')

    def rect(self, x, y, w, h, fill="none", stroke=None, width=1.2, rx=0, dash=None, opacity=None):
        s = f' stroke="{stroke}" stroke-width="{width}"' if stroke else ""
        d = f' stroke-dasharray="{dash}"' if dash else ""
        o = f' opacity="{opacity}"' if opacity is not None else ""
        self.add(f'<rect x="{f(x)}" y="{f(y)}" width="{f(w)}" height="{f(h)}" rx="{rx}" fill="{fill}"{s}{d}{o}/>')

    def path(self, d, fill="none", stroke=None, width=1.2, dash=None, opacity=None, extra=""):
        s = f' stroke="{stroke}" stroke-width="{width}"' if stroke else ""
        da = f' stroke-dasharray="{dash}"' if dash else ""
        o = f' opacity="{opacity}"' if opacity is not None else ""
        self.add(f'<path d="{d}" fill="{fill}"{s}{da}{o}{extra}/>')

    def arrow(self, x1, y1, x2, y2, stroke=GOLD, width=1.4, both=False):
        self.add(
            f'<line x1="{f(x1)}" y1="{f(y1)}" x2="{f(x2)}" y2="{f(y2)}" stroke="{stroke}" '
            f'stroke-width="{width}" marker-end="url(#head-{key(stroke)})"'
            + (f' marker-start="url(#tail-{key(stroke)})"' if both else "")
            + "/>"
        )

    def markers(self, colors):
        defs = ['<defs>']
        for c in colors:
            k = key(c)
            defs.append(
                f'<marker id="head-{k}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" '
                f'markerHeight="6" orient="auto-start-reverse"><path d="M0,1 L9,5 L0,9 z" fill="{c}"/></marker>'
            )
            defs.append(
                f'<marker id="tail-{k}" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="6" '
                f'markerHeight="6" orient="auto"><path d="M9,1 L0,5 L9,9 z" fill="{c}"/></marker>'
            )
        defs.append("</defs>")
        self.parts.insert(1, "".join(defs))

    def save(self, path: Path) -> None:
        self.parts.append("</svg>")
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text("".join(self.parts) + "\n", encoding="utf8")
        print(f"  {path.relative_to(ROOT)}")


def esc(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def f(n: float) -> str:
    return f"{n:.2f}".rstrip("0").rstrip(".")


def key(color: str) -> str:
    return color.lstrip("#")


def polar(cx, cy, r, deg):
    a = math.radians(deg)
    return cx + math.cos(a) * r, cy + math.sin(a) * r


def arc_path(cx, cy, r, a0, a1):
    x0, y0 = polar(cx, cy, r, a0)
    x1, y1 = polar(cx, cy, r, a1)
    large = 1 if abs(a1 - a0) > 180 else 0
    sweep = 1 if a1 > a0 else 0
    return f"M{f(x0)},{f(y0)} A{f(r)},{f(r)} 0 {large} {sweep} {f(x1)},{f(y1)}"


def caption(s: Svg, lines):
    y = s.h - 14 - 16 * (len(lines) - 1)
    for ln in lines:
        s.text(18, y, ln, MUTED, 12)
        y += 16


# ------------------------------------------------------------- disc diagrams

def fig_disc_layers():
    s = Svg(880, 560, "The layers a wheel disc is built from")
    s.markers([GOLD, CYAN])
    s.text(24, 34, "One disc, seven layers", INK, 16, weight="600")
    s.text(24, 54, "Bottom of the draw order first. Everything above the bezel line is on ctx.disc and turns.", MUTED, 12)

    layers = [
        ("face", "the painted disc, one texture", CYAN, "TextureRingSkin({ face })"),
        ("plates", "one sprite per section, placed by geometry", CYAN, "decorations[] / your own skin"),
        ("dividers + pegs", "the lines and the studs the tongue rides", GOLD, "dividers, .pegs({ size, inset })"),
        ("labels", "text, icons, containers, fitted per wedge", GOLD, "sections[].label / .content"),
        ("bezel", "the fixed frame and bulbs: does not turn", PINK, "TextureRingSkin({ frame })"),
        ("hub", "the cap over the centre", PINK, "hub / your own sprite"),
        ("pointer", "the tongue, on the overlay", GREEN, ".pointer({ angle, skin, flap })"),
    ]
    cx, top, step = 250, 120, 58
    rx, ry = 150, 46
    for i, (name, note, color, api) in enumerate(layers):
        cy = top + i * step
        s.add(
            f'<ellipse cx="{cx}" cy="{f(cy)}" rx="{rx}" ry="{ry}" fill="{PANEL}" stroke="{color}" '
            f'stroke-width="1.4" opacity="0.95"/>'
        )
        if name == "face":
            for k in range(12):
                x1, y1 = cx + math.cos(math.radians(k * 30)) * rx * 0.32, cy + math.sin(math.radians(k * 30)) * ry * 0.32
                x2, y2 = cx + math.cos(math.radians(k * 30)) * rx, cy + math.sin(math.radians(k * 30)) * ry
                s.line(x1, y1, x2, y2, color, 0.7)
        if name == "dividers + pegs":
            for k in range(12):
                px, py = cx + math.cos(math.radians(k * 30)) * rx * 0.88, cy + math.sin(math.radians(k * 30)) * ry * 0.88
                s.circle(px, py, 3, fill=color)
        if name == "pointer":
            s.path(f"M{cx},{f(cy - 30)} L{cx + 13},{f(cy - 6)} L{cx - 13},{f(cy - 6)} z", fill=color)
        s.line(cx + rx + 6, cy, 560, cy, GRID, 1, dash="3 3")
        s.text(572, cy - 3, name, INK, 13, weight="600")
        s.text(572, cy + 13, note, MUTED, 11)
        s.text(572, cy + 27, api, color, 11)
    split = top + 3.5 * step + 29
    s.line(46, top - 40, 46, split - 8, CYAN, 1.6)
    s.line(46, split + 8, 46, top + 6.5 * step + 40, PINK, 1.6)
    s.add(f'<text x="30" y="{f((top - 40 + split - 8) / 2)}" fill="{CYAN}" font-family="{FONT}" font-size="11" '
          f'text-anchor="middle" transform="rotate(-90 30 {f((top - 40 + split - 8) / 2)})">ctx.disc turns</text>')
    s.add(f'<text x="30" y="{f((split + 8 + top + 6.5 * step + 40) / 2)}" fill="{PINK}" font-family="{FONT}" font-size="11" '
          f'text-anchor="middle" transform="rotate(-90 30 {f((split + 8 + top + 6.5 * step + 40) / 2)})">ctx.overlay is fixed</text>')
    s.save(DISC / "layers.svg")


def fig_face_template():
    s = Svg(880, 470, "What a face texture has to match")
    s.markers([GOLD, CYAN, PINK])
    s.text(24, 34, "The face texture", INK, 16, weight="600")
    s.text(24, 54, "Square, centred, transparent outside the disc. One image, the whole wheel.", MUTED, 12)

    cx, cy, R = 210, 250, 150
    s.rect(cx - R, cy - R, 2 * R, 2 * R, fill="none", stroke=PINK, width=1.2, dash="5 4")
    s.circle(cx, cy, R, fill=PANEL, stroke=CYAN, width=1.6)
    for k in range(12):
        x, y = polar(cx, cy, R, k * 30)
        s.line(cx, cy, x, y, GRID, 1)
    # section 0 edge and sweep
    s.line(cx, cy, *polar(cx, cy, R, 0), stroke=GOLD, width=2)
    s.path(arc_path(cx, cy, 44, 0, 30), stroke=GOLD, width=1.6)
    s.text(cx + 52, cy + 22, "section 0", GOLD, 11)
    s.circle(cx, cy, 3, fill=GOLD)
    s.line(cx - R - 14, cy, cx + R + 14, cy, GRID, 1, dash="2 4")
    s.line(cx, cy - R - 14, cx, cy + R + 14, GRID, 1, dash="2 4")
    s.arrow(cx - R, cy + R + 26, cx + R, cy + R + 26, GOLD, 1.3, both=True)
    s.text(cx, cy + R + 44, "width = 2 x outerRadius", GOLD, 11, anchor="middle")
    s.text(cx + R + 8, cy - 6, "0 deg", CYAN, 11)
    s.text(cx - R - 6, cy - R - 8, "transparent", PINK, 11)

    notes = [
        ("square, power of two", "1024 x 1024 is plenty for a 300 px wheel on a 2x screen"),
        ("centre = image centre", "the sprite is anchored 0.5, 0.5 and never moved"),
        ("0 deg is three o'clock", "angles grow clockwise, the way the wheel turns"),
        ("section 0 starts where you say", "art drawn from twelve o'clock needs faceRotation: -90"),
        ("corners transparent", "a frame or a bezel goes on the fixed overlay, not here"),
        ("no labels if they change", "server-driven values are rich labels on top"),
    ]
    y = 120
    for head, note in notes:
        s.circle(432, y - 4, 3, fill=CYAN)
        s.text(446, y, head, INK, 12.5, weight="600")
        s.text(446, y + 16, note, MUTED, 11)
        y += 44
    s.save(DISC / "face-template.svg")


def fig_plate_template():
    s = Svg(880, 420, "What a per-section plate sprite has to match")
    s.markers([GOLD, CYAN, GREEN])
    s.text(24, 34, "One plate per section", INK, 16, weight="600")
    s.text(24, 54, "When the art is per wedge, ship one sprite and let the geometry place twelve of them.", MUTED, 12)

    # left: the plate in its own sprite box
    bx, by, bw, bh = 60, 110, 190, 240
    s.rect(bx, by, bw, bh, fill=PANEL, stroke=PINK, width=1.1, dash="5 4")
    top_w, bot_w = 150, 92
    cxp = bx + bw / 2
    s.path(
        f"M{f(cxp - top_w / 2)},{by + 18} L{f(cxp + top_w / 2)},{by + 18} "
        f"L{f(cxp + bot_w / 2)},{by + bh - 18} L{f(cxp - bot_w / 2)},{by + bh - 18} z",
        fill="#3a1220", stroke=GOLD, width=2,
    )
    s.line(cxp, by, cxp, by + bh, CYAN, 1, dash="3 3")
    s.line(bx, by + bh / 2, bx + bw, by + bh / 2, CYAN, 1, dash="3 3")
    s.circle(cxp, by + bh / 2, 4, fill=CYAN)
    s.text(cxp + 10, by + bh / 2 - 8, "anchor 0.5, 0.5", CYAN, 11)
    s.arrow(cxp, by + 46, cxp, by + 6, GREEN, 1.4)
    s.text(cxp + 8, by + 30, "outward", GREEN, 11)
    s.arrow(cxp - top_w / 2, by + 8, cxp + top_w / 2, by + 8, GOLD, 1.2, both=True)
    s.text(cxp, by - 4, "chord at the outer edge", GOLD, 11, anchor="middle")

    # right: where it lands
    cx, cy, R = 560, 240, 130
    s.circle(cx, cy, R, fill="none", stroke=GRID, width=1.2)
    s.circle(cx, cy, R * 0.32, fill="none", stroke=GRID, width=1.2)
    for k in range(12):
        a = k * 30 - 90
        x, y = polar(cx, cy, R * 0.72, a)
        s.add(
            f'<g transform="translate({f(x)},{f(y)}) rotate({f(a + 90)})">'
            f'<path d="M-22,-26 L22,-26 L13,26 L-13,26 z" fill="#3a1220" stroke="{GOLD}" stroke-width="1.2" '
            f'opacity="{0.95 if k == 0 else 0.45}"/></g>'
        )
    s.line(cx, cy, *polar(cx, cy, R, -90), stroke=CYAN, width=1.2, dash="3 3")
    s.text(cx, cy - R - 12, "midAngle of the section", CYAN, 11, anchor="middle")
    s.text(cx + R + 10, cy + 4, "radius 0.72 x R", MUTED, 11)
    caption(s, [
        "sprite.rotation = midAngle + 90 deg, so the art's up points at the rim; radius is a fraction of outerRadius.",
        "Weights move the plates: TextureRingSkin re-places them from layout(), a custom skin re-reads ctx.geometry.",
    ])
    s.save(DISC / "plate-template.svg")


def fig_atlas():
    s = Svg(880, 360, "Atlas regions: trimmed, rotated, padded")
    s.markers([GOLD, PINK, CYAN])
    s.text(24, 34, "Three things an atlas does to your art", INK, 16, weight="600")
    s.text(24, 54, "All three are normal. All three move the pivot if you read the rect and forget the rest.", MUTED, 12)
    cases = [
        ("packed as drawn", CYAN, ["frame is the whole sprite;", "the pivot is its centre"]),
        ("trimmed", GOLD, ["transparent edges cut off:", "add the offsets back or it drifts"]),
        ("rotated", PINK, ["stored 90 deg CCW: PixiJS", "rotate 6, width and height swap"]),
    ]
    for i, (title, color, note) in enumerate(cases):
        x = 40 + i * 280
        s.rect(x, 100, 220, 150, fill=PANEL, stroke=GRID, width=1.2, rx=8)
        if i == 0:
            s.rect(x + 40, 120, 140, 110, fill="none", stroke=color, width=1.6)
            s.path(f"M{x + 70},{215} L{x + 110},{135} L{x + 150},{215} z", fill="#243b53", stroke=color, width=1.2)
        elif i == 1:
            s.rect(x + 40, 120, 140, 110, fill="none", stroke=GRID, width=1.2, dash="4 4")
            s.rect(x + 66, 132, 88, 86, fill="none", stroke=color, width=1.6)
            s.path(f"M{x + 74},{212} L{x + 110},{138} L{x + 146},{212} z", fill="#243b53", stroke=color, width=1.2)
            s.arrow(x + 40, 126, x + 66, 126, color, 1.1)
            s.text(x + 46, 118, "offset", color, 10)
        else:
            s.rect(x + 52, 126, 116, 98, fill="none", stroke=color, width=1.6)
            s.add(
                f'<g transform="translate({x + 110},175) rotate(-90)">'
                f'<path d="M-36,40 L0,-38 L36,40 z" fill="#243b53" stroke="{color}" stroke-width="1.2"/></g>'
            )
            s.text(x + 110, 244, "90 deg CCW", color, 10, anchor="middle")
        s.text(x + 110, 278, title, INK, 12.5, anchor="middle", weight="600")
        for j, ln in enumerate(note):
            s.text(x + 110, 296 + j * 15, ln, MUTED, 10.5, anchor="middle")
    s.save(DISC / "atlas.svg")


def fig_label_slot():
    s = Svg(880, 400, "The room a label has inside its wedge")
    s.markers([GOLD, CYAN, GREEN])
    s.text(24, 34, "labelSlot: the box a label is fitted into", INK, 16, weight="600")
    s.text(24, 54, "Width is the chord at the label radius; height is how much of the radius the label may eat.", MUTED, 12)
    cx, cy, R = 250, 240, 145
    s.circle(cx, cy, R, fill=PANEL, stroke=GRID, width=1.2)
    a0, a1 = -125, -55
    s.path(
        f"M{f(cx)},{f(cy)} L{f(polar(cx, cy, R, a0)[0])},{f(polar(cx, cy, R, a0)[1])} "
        + arc_path(cx, cy, R, a0, a1)[1:].replace("M", "L", 1)
        + " z",
        fill="#132033", stroke=CYAN, width=1.4,
    )
    lr = R * 0.72
    x0, y0 = polar(cx, cy, lr, a0)
    x1, y1 = polar(cx, cy, lr, a1)
    s.line(x0, y0, x1, y1, GOLD, 1.8)
    s.line(x0, y0, x0 - 40, y0 - 26, GOLD, 1, dash="3 3")
    s.text(x0 - 44, y0 - 28, "chordAt(radius)", GOLD, 11, anchor="end")
    s.rect(x0, y0, x1 - x0, 46, fill="none", stroke=GREEN, width=1.4, dash="4 3")
    s.line(x1, y0 + 46, x1 + 34, y0 + 62, GREEN, 1, dash="3 3")
    s.text(x1 + 38, y0 + 66, "the slot", GREEN, 11)
    s.line(cx, cy, cx, cy - R, CYAN, 1, dash="3 3")
    s.text(cx - 8, cy - 62, "labelRadius", CYAN, 11, anchor="end")

    modes = [
        ("fit", "scale down only, keep the aspect"),
        ("fill", "scale up too, so short text grows"),
        ("width", "only the chord matters"),
        ("none", "place it, do not touch the scale"),
    ]
    y = 120
    s.text(470, y - 24, "labelFit", INK, 13, weight="600")
    for name, note in modes:
        s.text(470, y, name, GOLD, 12, weight="600")
        s.text(534, y, note, MUTED, 11)
        y += 26
    orients = [
        ("radial", "reads out from the hub"),
        ("tangential", "along the arc, top out"),
        ("tangential-in", "along the arc, top toward the hub"),
        ("upright", "never rotates, for icons and faces"),
    ]
    y += 20
    s.text(470, y - 10, "orientation", INK, 13, weight="600")
    for name, note in orients:
        s.text(470, y + 14, name, CYAN, 12, weight="600")
        s.text(590, y + 14, note, MUTED, 11)
        y += 26
    s.save(DISC / "label-slot.svg")


# ----------------------------------------------------------- tongue diagrams

def fig_tongue_anatomy():
    s = Svg(880, 460, "Where the tongue sits and what it touches")
    s.markers([GOLD, CYAN, GREEN, PINK])
    s.text(24, 34, "The tongue and the pegs", INK, 16, weight="600")
    s.text(24, 54, "Everything is measured from the hub. The tongue pivots at its pin and never moves off it.", MUTED, 12)

    cx, cy, R = 330, 620, 380
    s.circle(cx, cy, R, fill="none", stroke=GRID, width=1.6)
    peg_r = R - 34
    s.circle(cx, cy, peg_r, fill="none", stroke=GRID, width=1, dash="4 4")
    for k in range(-4, 5):
        x, y = polar(cx, cy, peg_r, -90 + k * 9)
        s.circle(x, y, 8, fill="#2b3550", stroke=CYAN, width=1.3)
    # the tongue
    tipy = cy - (R - 18)
    piny = cy - (R - 18) - 78
    s.path(
        f"M{cx - 20},{f(piny)} C{cx - 22},{f(piny + 40)} {cx - 12},{f(tipy - 10)} {cx},{f(tipy)} "
        f"C{cx + 12},{f(tipy - 10)} {cx + 22},{f(piny + 40)} {cx + 20},{f(piny)} z",
        fill="#f6f7fb", stroke="#20293a", width=2,
    )
    s.circle(cx, piny, 7, fill="#20293a")
    s.circle(cx, piny, 3, fill="#f6f7fb")

    def mark(x, y, label, color, dx=14, dy=0):
        s.circle(x, y, 3.5, fill=color)
        s.text(x + dx, y + dy, label, color, 11)

    mark(cx, piny, "pin", GOLD, 12, -8)
    mark(cx, tipy, "tip", GREEN, 16, 4)
    s.arrow(cx - 120, tipy, cx - 120, cy - R, PINK, 1.3, both=True)
    s.text(cx - 132, (tipy + cy - R) / 2 + 4, "tipInset", PINK, 11, anchor="end")
    s.arrow(cx + 120, piny, cx + 120, tipy, GOLD, 1.3, both=True)
    s.text(cx + 132, (piny + tipy) / 2 + 4, "skin.length", GOLD, 11)
    s.line(cx - 190, cy - R, cx + 190, cy - R, GRID, 1, dash="3 3")
    s.text(cx - 196, cy - R + 4, "rim R", MUTED, 11, anchor="end")
    s.line(cx - 190, cy - peg_r, cx + 190, cy - peg_r, GRID, 1, dash="3 3")
    s.text(cx - 196, cy - peg_r + 4, "R - pegs.inset", MUTED, 11, anchor="end")
    px, py = polar(cx, cy, peg_r, -90)
    s.arrow(px - 26, py + 34, px + 26, py + 34, CYAN, 1.2, both=True)
    s.text(px, py + 50, "contact width 2c = 2 x (pegs.size + tipWidth / 2)", CYAN, 11, anchor="middle")

    rows = [
        ("angle", "-90 is twelve o'clock, 90 is six"),
        ("facing", "inward from the rim, or outward"),
        ("tipInset", "how far the tip reaches past the rim"),
        ("skin.length", "pin to tip: pinRadius is the sum"),
        ("pegs.inset", "peg centres inside the rim"),
        ("pegs.size", "peg radius, half the contact width"),
        ("pegs.angles", "every divider unless you say otherwise"),
    ]
    y = 104
    for name, note in rows:
        s.text(600, y, name, GOLD, 12, weight="600")
        s.text(600, y + 15, note, MUTED, 10.5)
        y += 40
    s.save(TONGUE / "anatomy.svg")


def fig_tongue_art():
    s = Svg(880, 380, "What pointer art has to declare")
    s.markers([GOLD, CYAN, GREEN])
    s.text(24, 34, "Pointer art: tip direction and pin", INK, 16, weight="600")
    s.text(24, 54, "The engine rotates the art so the tip points at the hub, around the pin. Both are yours to state.", MUTED, 12)

    bx, by, bw, bh = 60, 96, 180, 250
    s.rect(bx, by, bw, bh, fill=PANEL, stroke=PINK, width=1.1, dash="5 4")
    cxp = bx + bw / 2
    s.path(
        f"M{f(cxp)},{by + 16} C{f(cxp + 34)},{by + 110} {f(cxp + 40)},{by + 180} {f(cxp + 30)},{by + 218} "
        f"L{f(cxp - 30)},{by + 218} C{f(cxp - 40)},{by + 180} {f(cxp - 34)},{by + 110} {f(cxp)},{by + 16} z",
        fill="#f0c040", stroke="#8a6a10", width=2,
    )
    piny = by + bh * 0.85
    s.line(bx, piny, bx + bw, piny, CYAN, 1, dash="3 3")
    s.line(cxp, by, cxp, by + bh, CYAN, 1, dash="3 3")
    s.circle(cxp, piny, 5, fill=CYAN)
    s.text(cxp, by + bh + 22, "pin { x: 0.5, y: 0.85 }", CYAN, 11, anchor="middle")
    s.arrow(cxp - 66, piny, cxp - 66, by + 16, GOLD, 1.3, both=True)
    s.text(cxp - 74, (piny + by) / 2, "length", GOLD, 11, anchor="end")
    s.text(cxp, by - 8, "tip on the top edge: artDirection 'up'", GREEN, 11, anchor="middle")

    rows = [
        ("artDirection", "'up' | 'right' | 'down' | 'left': where the tip is in the source image"),
        ("pin", "fractions of the image; the pivot the flap swings around"),
        ("length", "pin to tip after scaling; sets where the tip lands on the rim"),
        ("scale", "uniform; art is usually authored larger than it is drawn"),
        ("padding", "leave a few transparent px at the tip so a trim cannot clip it"),
        ("deflection", "the sprite rotates; the pin never moves"),
    ]
    y = 108
    for name, note in rows:
        s.text(300, y, name, GOLD, 12, weight="600")
        s.text(300, y + 15, note, MUTED, 10.5)
        y += 40
    s.text(300, y + 4, "SpinePointerSkin takes the same length, plus idle and tick animation names.", CYAN, 11)
    s.save(TONGUE / "art.svg")


def fig_contact():
    s = Svg(880, 420, "One peg going under the tongue")
    s.markers([GOLD, CYAN, GREEN, PINK])
    s.text(24, 34, "One peg, start to finish", INK, 16, weight="600")
    s.text(24, 54, "u is the peg's position along its own rim, in px, measured against the tongue's rest axis.", MUTED, 12)

    x0, x1, base = 80, 800, 300
    s.line(x0, base, x1, base, GRID, 1.4)
    # u positions
    def ux(u):  # u in px, -13 .. 26
        return x0 + (u + 20) * (x1 - x0) / 56

    marks = [(-13, "-c  first touch", CYAN, 0), (0, "0  the crown", GOLD, 0), (13, "c  peg is through", GREEN, 0), (17.6, "c(1+friction)  let go", PINK, 1)]
    for u, label, color, row in marks:
        s.line(ux(u), base - 170, ux(u), base + 10 + row * 18, color, 1, dash="3 4")
        s.text(ux(u), base + 28 + row * 18, label, color, 10.5, anchor="middle")
    s.arrow(x0 + 10, base + 58, x1 - 10, base + 58, MUTED, 1.2)
    s.text(x1 - 10, base + 50, "direction of travel", MUTED, 11, anchor="end")

    # deflection curve
    pts = []
    for i in range(0, 201):
        u = -20 + i * 56 / 200
        if u <= -13:
            d = 0.0
        elif u <= 0:
            d = math.atan(((u + 13)) / 40) / math.atan(13 / 40)
        elif u <= 17.6:
            d = 1.0
        else:
            t = (u - 17.6) / 12
            d = math.cos(t * 9) * math.exp(-t * 3.2)
        pts.append((ux(u), base - 150 * d))
    s.path("M" + " L".join(f"{f(x)},{f(y)}" for x, y in pts), stroke=GOLD, width=2.2)
    s.text(x0, base - 162, "deflection", GOLD, 11)
    s.line(x0, base - 150, x1, base - 150, GRID, 1, dash="2 6")
    s.text(x1, base - 156, "crown deflection = elasticity x atan(c / D)", MUTED, 10.5, anchor="end")

    caption(s, [
        "c = pegs.size + tipWidth / 2. D is the pin-to-peg gap, so a long tongue bends less.",
        "After the release the spring takes over: stiffness pulls back, damping ends the ringing.",
        "At speed a peg clears the zone inside one frame and the tongue is flicked to the crown.",
    ])
    s.save(TONGUE / "contact.svg")


def fig_spring():
    s = Svg(880, 340, "How the tongue comes back after a peg lets go")
    s.markers([GOLD])
    s.text(24, 34, "stiffness and damping", INK, 16, weight="600")
    s.text(24, 54, "The release is a spring. Same push, three materials.", MUTED, 12)
    x0, x1, base = 70, 830, 250
    s.line(x0, base, x1, base, GRID, 1.2)
    s.line(x0, base - 120, x0, base + 60, GRID, 1.2)
    s.text(x0 - 8, base - 116, "deg", MUTED, 10.5, anchor="end")
    s.text(x1, base + 24, "0.6 s", MUTED, 10.5, anchor="end")
    curves = [
        ("stiff 700 / damp 18", GOLD, 700, 18),
        ("default 420 / damp 14", CYAN, 420, 14),
        ("floppy 140 / damp 5", GREEN, 140, 5),
    ]
    for i, (label, color, k, c) in enumerate(curves):
        d, v = 1.0, 0.0
        pts = []
        steps = 360
        for j in range(steps):
            t = j / steps * 0.6
            v += (-k * d - c * v) * (0.6 / steps)
            d += v * (0.6 / steps)
            pts.append((x0 + (x1 - x0) * (t / 0.6), base - 110 * d))
        s.path("M" + " L".join(f"{f(x)},{f(y)}" for x, y in pts), stroke=color, width=2)
        s.text(x0 + 12, 104 + i * 20, label, color, 11.5)
    caption(s, [
        "maxAngle clamps the whole thing; a tongue that hits its limit every peg reads as rigid, not as fast.",
    ])
    s.save(TONGUE / "spring.svg")


def fig_drag():
    s = Svg(880, 380, "flap.drag: the tongue holding the ring back")
    s.markers([GOLD, CYAN, GREEN])
    s.text(24, 34, "drag: the peg has to push the ring past the tongue", INK, 16, weight="600")
    s.text(24, 54, "The hold is drawn, not planned: it always relaxes to zero, so the wheel rests on its result.", MUTED, 12)
    x0, x1, base = 80, 800, 250

    def ux(u):
        return x0 + (u + 20) * (x1 - x0) / 56

    s.line(x0, base, x1, base, GRID, 1.4)
    for u, label, color in [(-13, "peg touches", CYAN), (0, "crown", GOLD), (13, "through", GREEN)]:
        s.line(ux(u), base - 130, ux(u), base + 8, color, 1, dash="3 4")
        s.text(ux(u), base + 26, label, color, 10.5, anchor="middle")
    pts = []
    for i in range(0, 201):
        u = -20 + i * 56 / 200
        if u <= -13:
            h = 0.0
        elif u <= 0:
            h = (u + 13) / 13
        else:
            h = math.exp(-u / 2.2)
        pts.append((ux(u), base - 110 * h))
    s.path("M" + " L".join(f"{f(x)},{f(y)}" for x, y in pts), stroke=GOLD, width=2.2)
    s.text(x0, base - 124, "arc held back, degrees", GOLD, 11)
    s.line(x0, base - 110, x1, base - 110, GRID, 1, dash="2 6")
    s.text(x1, base - 116, "at most drag x c / pegRadius", MUTED, 10.5, anchor="end")
    caption(s, [
        "Up the ramp the ring is drawn behind itself. Over the crown the hold goes at dragRelease.",
        "Fast: a shimmer nobody can name. Slow: the wheel visibly fights every peg.",
        "rotationDeg, the ticks and the landing never see it; ring.visualRotationDeg does.",
    ])
    s.save(TONGUE / "drag.svg")


# ------------------------------------------------------------ png textures
#
# A sample pack, not decoration: every file below is drawn to the
# requirements the diagrams state, so it can be dropped straight into a
# project. Generated art, MIT like the rest of the repo, no attribution
# needed. Rebuild or restyle by editing this file.

SS = 3  # supersample factor, downscaled at the end for clean edges

MANIFEST: list[tuple[Path, str]] = []  # (path, one-line description) for the zip README

GOLD_DARK = (150, 110, 26, 255)
GOLD_MID = (198, 150, 40, 255)
GOLD_LIT = (247, 214, 118, 255)


def _new(size):
    return Image.new("RGBA", (size[0] * SS, size[1] * SS), (0, 0, 0, 0))


def _save(img, size, path: Path, note: str):
    out = img.resize(size, Image.LANCZOS)
    path.parent.mkdir(parents=True, exist_ok=True)
    out.save(path, "PNG", optimize=True)
    MANIFEST.append((path, note))
    print(f"  {path.relative_to(ROOT)}  {size[0]}x{size[1]}  {os.path.getsize(path) // 1024} KB")


def _circle_mask(size, inset=0):
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).ellipse((inset, inset, size[0] - 1 - inset, size[1] - 1 - inset), fill=255)
    return m


def _knockout(img, mask):
    """Keep only what the mask allows, alpha-wise."""
    img.putalpha(Image.composite(img.getchannel("A"), Image.new("L", img.size, 0), mask))


# ---- faces ---------------------------------------------------------------

FACE_PALETTES = {
    "face.png": ([(122, 18, 48, 255), (19, 42, 74, 255)], 12, "12 crimson and navy wedges, gold dividers"),
    "face-8.png": (
        [(38, 70, 83, 255), (42, 157, 143, 255), (233, 196, 106, 255), (231, 111, 81, 255)],
        8,
        "8 wedges in a softer four-colour palette",
    ),
    "face-24.png": ([(26, 32, 54, 255), (46, 56, 92, 255)], 24, "24 fine wedges for a ratchet-heavy wheel"),
}


def tex_face(name, fills, sections, note, size=1024):
    img = _new((size, size))
    d = ImageDraw.Draw(img)
    S = size * SS
    R = S / 2
    box = (0, 0, S - 1, S - 1)
    arc = 360 / sections
    for i in range(sections):
        d.pieslice(box, i * arc, i * arc + arc, fill=fills[i % len(fills)])
    d.ellipse((R * 0.10, R * 0.10, S - R * 0.10, S - R * 0.10), outline=(0, 0, 0, 44), width=int(R * 0.10))
    d.ellipse((R * 0.62, R * 0.62, S - R * 0.62, S - R * 0.62), outline=(255, 255, 255, 16), width=int(R * 0.22))
    for i in range(sections):
        a = math.radians(i * arc)
        d.line([(R, R), (R + math.cos(a) * R, R + math.sin(a) * R)], fill=GOLD_LIT[:3] + (235,), width=max(2, int(S * 0.006)))
    d.ellipse(box, outline=GOLD_LIT, width=max(3, int(S * 0.012)))
    _knockout(img, _circle_mask((S, S)))
    _save(img, (size, size), DISC / name, note)


# ---- bezels --------------------------------------------------------------

def tex_bezel(name, outer, inner, bulb_fill, bulb_edge, bulbs, note, size=1152):
    img = _new((size, size))
    d = ImageDraw.Draw(img)
    S = size * SS
    R = S / 2
    d.ellipse((0, 0, S - 1, S - 1), outline=outer, width=int(S * 0.052))
    d.ellipse((S * 0.016, S * 0.016, S - S * 0.016, S - S * 0.016), outline=inner, width=int(S * 0.014))
    for i in range(bulbs):
        a = math.radians(i * 360 / bulbs - 90)
        x, y = R + math.cos(a) * R * 0.955, R + math.sin(a) * R * 0.955
        rad = S * 0.0125
        d.ellipse((x - rad, y - rad, x + rad, y + rad), fill=bulb_fill, outline=bulb_edge, width=int(S * 0.003))
    hole = Image.new("L", (S, S), 255)
    ImageDraw.Draw(hole).ellipse((S * 0.088, S * 0.088, S - S * 0.088, S - S * 0.088), fill=0)
    _knockout(img, hole)
    _save(img, (size, size), DISC / name, note)


# ---- plates --------------------------------------------------------------

def tex_plate(name, fill, frame, inner, note, size=(256, 320), glow=None):
    img = _new(size)
    d = ImageDraw.Draw(img)
    w, h = size[0] * SS, size[1] * SS
    top, bot, pad = w * 0.94, w * 0.58, h * 0.04
    poly = [((w - top) / 2, pad), ((w + top) / 2, pad), ((w + bot) / 2, h - pad), ((w - bot) / 2, h - pad)]
    if glow:
        for k in range(6, 0, -1):
            spread = k * w * 0.012
            wide = [(x + (w / 2 - x) * -spread / w, y + (h / 2 - y) * -spread / h) for x, y in poly]
            d.polygon(wide, outline=glow[:3] + (int(glow[3] * (0.16 - k * 0.02)),), width=int(w * 0.03))
    d.polygon(poly, fill=fill, outline=frame, width=int(w * 0.028))
    d.polygon([(x + (w / 2 - x) * 0.12, y + (h / 2 - y) * 0.12) for x, y in poly], outline=inner, width=int(w * 0.01))
    _save(img, size, DISC / name, note)


# ---- hubs ----------------------------------------------------------------

def tex_hub(name, body, rim, motif, note, size=320):
    img = _new((size, size))
    d = ImageDraw.Draw(img)
    S = size * SS
    d.ellipse((0, 0, S - 1, S - 1), fill=body, outline=rim, width=int(S * 0.06))
    d.ellipse((S * 0.14, S * 0.14, S - S * 0.14, S - S * 0.14), outline=rim[:3] + (160,), width=int(S * 0.018))
    if motif == "star":
        pts = []
        for i in range(10):
            a = math.radians(i * 36 - 90)
            rad = S * 0.3 if i % 2 == 0 else S * 0.14
            pts.append((S / 2 + math.cos(a) * rad, S / 2 + math.sin(a) * rad))
        d.polygon(pts, fill=rim)
    elif motif == "cap":
        d.ellipse((S * 0.34, S * 0.34, S * 0.66, S * 0.66), fill=rim)
    _save(img, (size, size), DISC / name, note)


# ---- pegs, bulbs, glow ---------------------------------------------------

def tex_peg(size=48):
    img = _new((size, size))
    d = ImageDraw.Draw(img)
    S = size * SS
    d.ellipse((S * 0.06, S * 0.06, S * 0.94, S * 0.94), fill=GOLD_LIT, outline=(107, 74, 6, 255), width=int(S * 0.07))
    d.ellipse((S * 0.26, S * 0.2, S * 0.6, S * 0.5), fill=(255, 252, 236, 190))
    _save(img, (size, size), DISC / "peg.png", "a single peg stud, for skins that draw their own")


def tex_bulb(name, lit, note, size=64):
    img = _new((size, size))
    d = ImageDraw.Draw(img)
    S = size * SS
    body = (255, 246, 214, 255) if lit else (92, 84, 62, 255)
    d.ellipse((S * 0.1, S * 0.1, S * 0.9, S * 0.9), fill=body, outline=GOLD_DARK, width=int(S * 0.06))
    if lit:
        d.ellipse((S * 0.28, S * 0.22, S * 0.58, S * 0.5), fill=(255, 255, 255, 220))
    _save(img, (size, size), DISC / name, note)


def tex_glow(size=256):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    px = img.load()
    c = size / 2
    for y in range(size):
        for x in range(size):
            r = math.hypot(x - c, y - c) / c
            if r >= 1:
                continue
            a = int(255 * (1 - r) ** 2.2)
            px[x, y] = (255, 236, 176, a)
    img.save(DISC / "glow.png", "PNG", optimize=True)
    MANIFEST.append((DISC / "glow.png", "soft radial glow, additive, for the winning wedge"))
    print(f"  {(DISC / 'glow.png').relative_to(ROOT)}  {size}x{size}  {os.path.getsize(DISC / 'glow.png') // 1024} KB")


# ---- tongues -------------------------------------------------------------
#
# All of them: 160 x 260, tip on the top edge (artDirection 'up'), pin at
# { x: 0.5, y: 0.85 }. Swapping one for another needs no other change.

def _pin_cap(d, w, h, pin_y, dark, light):
    cap = w * 0.20
    d.ellipse((w / 2 - cap, pin_y - cap, w / 2 + cap, pin_y + cap), fill=dark)
    d.ellipse((w / 2 - cap * 0.42, pin_y - cap * 0.42, w / 2 + cap * 0.42, pin_y + cap * 0.42), fill=light)


def tex_tongue_gold(size=(160, 260)):
    img = _new(size)
    d = ImageDraw.Draw(img)
    w, h = size[0] * SS, size[1] * SS
    tip, pin_y = h * 0.045, h * 0.85
    d.polygon(
        [(w / 2, tip), (w * 0.80, h * 0.42), (w * 0.86, pin_y), (w * 0.14, pin_y), (w * 0.20, h * 0.42)],
        fill=GOLD_LIT, outline=(120, 84, 12, 255), width=int(w * 0.035),
    )
    d.polygon([(w / 2, tip + h * 0.06), (w * 0.66, h * 0.45), (w * 0.34, h * 0.45)], fill=(255, 244, 206, 235))
    _pin_cap(d, w, h, pin_y, (56, 40, 10, 255), GOLD_LIT)
    _save(img, size, TONGUE / "tongue.png", "the default gold tongue, tip up, pin at 0.5 / 0.85")


def tex_tongue_rubber(size=(160, 260)):
    img = _new(size)
    d = ImageDraw.Draw(img)
    w, h = size[0] * SS, size[1] * SS
    tip, pin_y = h * 0.05, h * 0.85
    d.polygon(
        [(w / 2, tip), (w * 0.88, h * 0.30), (w * 0.92, h * 0.72), (w * 0.80, pin_y),
         (w * 0.20, pin_y), (w * 0.08, h * 0.72), (w * 0.12, h * 0.30)],
        fill=(198, 48, 56, 255), outline=(92, 16, 22, 255), width=int(w * 0.04),
    )
    d.polygon([(w * 0.5, tip + h * 0.05), (w * 0.72, h * 0.36), (w * 0.5, h * 0.30), (w * 0.28, h * 0.36)],
              fill=(238, 110, 104, 210))
    _pin_cap(d, w, h, pin_y, (44, 10, 14, 255), (238, 110, 104, 255))
    _save(img, size, TONGUE / "tongue-rubber.png", "a soft red flapper: pair with low stiffness and low damping")


def tex_tongue_needle(size=(160, 260)):
    img = _new(size)
    d = ImageDraw.Draw(img)
    w, h = size[0] * SS, size[1] * SS
    tip, pin_y = h * 0.04, h * 0.85
    d.polygon([(w / 2, tip), (w * 0.60, h * 0.80), (w * 0.40, h * 0.80)], fill=(214, 222, 232, 255),
              outline=(88, 100, 118, 255), width=int(w * 0.028))
    d.polygon([(w / 2, tip + h * 0.04), (w * 0.535, h * 0.78), (w / 2, h * 0.78)], fill=(255, 255, 255, 190))
    _pin_cap(d, w, h, pin_y, (58, 66, 80, 255), (214, 222, 232, 255))
    _save(img, size, TONGUE / "tongue-needle.png", "a steel needle: high stiffness, high damping, small maxAngle")


def tex_tongue_arrow(size=(160, 260)):
    img = _new(size)
    d = ImageDraw.Draw(img)
    w, h = size[0] * SS, size[1] * SS
    tip, pin_y = h * 0.05, h * 0.85
    d.polygon(
        [(w / 2, tip), (w * 0.95, h * 0.40), (w * 0.70, h * 0.40), (w * 0.70, pin_y),
         (w * 0.30, pin_y), (w * 0.30, h * 0.40), (w * 0.05, h * 0.40)],
        fill=(250, 250, 252, 255), outline=(26, 26, 26, 255), width=int(w * 0.05),
    )
    _pin_cap(d, w, h, pin_y, (26, 26, 26, 255), (250, 250, 252, 255))
    _save(img, size, TONGUE / "tongue-arrow.png", "a chunky cartoon arrow with a heavy outline")


# ---- the pack ------------------------------------------------------------

README = """pixi-wheels sample textures
===========================

Generated art, MIT licensed like the library. Use them anywhere, change
them, ship them. Rebuilt by tools/doc-figures/build_figures.py in the
pixi-wheels repo.

Every file is transparent PNG, drawn to the requirements the recipes state:

  https://pixi-wheels.schmooky.dev/recipes/disc-art/
  https://pixi-wheels.schmooky.dev/recipes/tongue/

Discs are square with transparent corners and are centred on the image
centre; angles start at three o'clock and grow clockwise. Plates are
authored upright with their outward edge at the top and are anchored dead
centre. Tongues have their tip on the top edge (artDirection: 'up') and
their pin at { x: 0.5, y: 0.85 }, so any one can replace any other.

Files
-----
"""


def write_pack():
    import zipfile

    target = OUT / "pixi-wheels-textures.zip"
    lines = [README]
    for path, note in sorted(MANIFEST, key=lambda m: str(m[0])):
        rel = path.relative_to(OUT)
        im = Image.open(path)
        lines.append(f"  {str(rel):34s} {im.size[0]:>5} x {im.size[1]:<5}  {note}")
    lines.append("")
    with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("README.txt", "\n".join(lines))
        for path, _ in sorted(MANIFEST, key=lambda m: str(m[0])):
            z.write(path, str(path.relative_to(OUT)))
    print(f"  {target.relative_to(ROOT)}  {len(MANIFEST)} files  {os.path.getsize(target) // 1024} KB")


def main():
    print("SVG diagrams")
    fig_disc_layers()
    fig_face_template()
    fig_plate_template()
    fig_atlas()
    fig_label_slot()
    fig_tongue_anatomy()
    fig_tongue_art()
    fig_contact()
    fig_spring()
    fig_drag()

    print("PNG textures")
    for name, (fills, sections, note) in FACE_PALETTES.items():
        tex_face(name, fills, sections, note)
    tex_bezel("bezel.png", GOLD_MID, GOLD_LIT, (255, 246, 214, 255), GOLD_DARK, 24, "gold bezel with 24 bulbs")
    tex_bezel("bezel-steel.png", (128, 138, 152, 255), (206, 214, 226, 255), (236, 244, 255, 255), (76, 86, 100, 255), 32,
              "brushed-steel bezel with 32 smaller bulbs")
    tex_plate("plate.png", (122, 18, 48, 255), GOLD_LIT, (247, 214, 118, 190), "the default crimson plate")
    tex_plate("plate-green.png", (22, 92, 66, 255), GOLD_LIT, (247, 214, 118, 190), "green plate, same silhouette")
    tex_plate("plate-blue.png", (24, 60, 118, 255), GOLD_LIT, (247, 214, 118, 190), "blue plate, same silhouette")
    tex_plate("plate-gold.png", (196, 148, 36, 255), (255, 244, 206, 255), (255, 255, 255, 150), "gold plate for the top prize")
    tex_plate("plate-dim.png", (44, 30, 38, 255), (120, 96, 44, 255), (150, 122, 60, 140), "the dimmed loser state")
    tex_plate("plate-win.png", (168, 32, 66, 255), (255, 244, 206, 255), (255, 255, 255, 190), "the lit winner state",
              glow=(255, 236, 176, 255))
    tex_hub("hub.png", (18, 26, 42, 255), GOLD_LIT, "star", "the default hub cap")
    tex_hub("hub-plain.png", (22, 26, 34, 255), (206, 214, 226, 255), "cap", "a plain steel hub cap")
    tex_peg()
    tex_bulb("bulb-on.png", True, "a lit rim bulb")
    tex_bulb("bulb-off.png", False, "the same bulb, dark")
    tex_glow()
    tex_tongue_gold()
    tex_tongue_rubber()
    tex_tongue_needle()
    tex_tongue_arrow()

    print("pack")
    write_pack()


if __name__ == "__main__":
    main()
