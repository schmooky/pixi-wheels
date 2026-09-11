#!/usr/bin/env python3
"""Build the figures the disc-art and tongue recipes show inline.

Two kinds of output land under `apps/site/public/recipes/`:

* **SVG diagrams** - blueprints of the geometry a texture has to match:
  where the centre is, which edge is section 0, where the pin sits, how far
  a peg pushes the tongue. They are drawn on no background at all and paint
  themselves from the site's own theme tokens, because the page inlines
  them (see `Figure.astro`) instead of loading them as images. One idea per
  figure: the prose carries the lists, the drawing carries the geometry.
* **PNG example textures** - faces, bezels, plates, hubs, pegs, bulbs and
  tongues, drawn to the exact requirements the diagrams state, plus a zip.
  The recipes load these very files, so the picture in the prose and the
  art in the demo are the same bytes.

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

# The figures are inlined into the page, so they can use its tokens directly
# and follow the theme. The fallbacks are only for viewing a file on its own.
INK = "var(--fig-ink, #1a1a1e)"
MUTED = "var(--fig-muted, #6b7280)"
LINE = "var(--fig-line, #d6d8dd)"
WASH = "var(--fig-wash, rgba(20,22,28,0.05))"
KEY = "var(--fig-key, #b07d12)"

# One column of the docs page, so the figure renders at its own scale: no
# browser downscale, no 9 px text.
W = 800


class Svg:
    """A figure: no frame, no background, page type, a handful of labels."""

    def __init__(self, height: int, title: str, width: int = W):
        self.w, self.h = width, height
        self.parts = [
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" '
            f'width="100%" role="img" aria-label="{esc(title)}" '
            f'style="font-size:14px;fill:{INK}">',
            f"<title>{esc(title)}</title>",
        ]

    def add(self, markup: str) -> None:
        self.parts.append(markup)

    def text(self, x, y, s, fill=INK, size=14, anchor="start", weight="500", extra=""):
        self.add(
            f'<text x="{f(x)}" y="{f(y)}" fill="{fill}" font-size="{size}" '
            f'font-weight="{weight}" text-anchor="{anchor}"{extra}>{esc(s)}</text>'
        )

    def mono(self, x, y, s, fill=KEY, size=13.5, anchor="start", weight="500"):
        self.add(
            f'<text x="{f(x)}" y="{f(y)}" fill="{fill}" font-size="{size}" font-weight="{weight}" '
            f'text-anchor="{anchor}" font-family="ui-monospace, SFMono-Regular, Menlo, monospace">{esc(s)}</text>'
        )

    def line(self, x1, y1, x2, y2, stroke=LINE, width=1.6, dash=None):
        d = f' stroke-dasharray="{dash}"' if dash else ""
        self.add(
            f'<line x1="{f(x1)}" y1="{f(y1)}" x2="{f(x2)}" y2="{f(y2)}" stroke="{stroke}" '
            f'stroke-width="{width}"{d}/>'
        )

    def circle(self, cx, cy, r, fill="none", stroke=None, width=1.6, dash=None):
        s = f' stroke="{stroke}" stroke-width="{width}"' if stroke else ""
        d = f' stroke-dasharray="{dash}"' if dash else ""
        self.add(f'<circle cx="{f(cx)}" cy="{f(cy)}" r="{f(r)}" fill="{fill}"{s}{d}/>')

    def rect(self, x, y, w, h, fill="none", stroke=None, width=1.6, rx=0, dash=None):
        s = f' stroke="{stroke}" stroke-width="{width}"' if stroke else ""
        d = f' stroke-dasharray="{dash}"' if dash else ""
        self.add(
            f'<rect x="{f(x)}" y="{f(y)}" width="{f(w)}" height="{f(h)}" rx="{rx}" fill="{fill}"{s}{d}/>'
        )

    def path(self, d, fill="none", stroke=None, width=1.6, dash=None, extra=""):
        s = f' stroke="{stroke}" stroke-width="{width}"' if stroke else ""
        da = f' stroke-dasharray="{dash}"' if dash else ""
        self.add(f'<path d="{d}" fill="{fill}"{s}{da}{extra}/>')

    def arrow(self, x1, y1, x2, y2, stroke=KEY, width=1.8, both=False):
        self.add(
            f'<line x1="{f(x1)}" y1="{f(y1)}" x2="{f(x2)}" y2="{f(y2)}" stroke="{stroke}" '
            f'stroke-width="{width}" marker-end="url(#fig-head)"'
            + (' marker-start="url(#fig-tail)"' if both else "")
            + "/>"
        )

    def leader(self, x, y, tx, ty, label, fill=INK, anchor="start", size=14):
        """A dot on the thing, a hairline out to a label that has room."""
        self.circle(x, y, 3.5, fill=fill)
        self.line(x, y, tx, ty, LINE, 1.2)
        self.text(tx + (6 if anchor == "start" else -6), ty + 4.5, label, fill, size, anchor)

    def markers(self):
        self.parts.insert(
            1,
            f'<defs><marker id="fig-head" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" '
            f'markerHeight="7" orient="auto-start-reverse"><path d="M0,1 L9,5 L0,9 z" fill="{KEY}"/></marker>'
            f'<marker id="fig-tail" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="7" '
            f'markerHeight="7" orient="auto"><path d="M9,1 L0,5 L9,9 z" fill="{KEY}"/></marker></defs>',
        )

    def save(self, path: Path) -> None:
        self.parts.append("</svg>")
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text("".join(self.parts) + "\n", encoding="utf8")
        print(f"  {path.relative_to(ROOT)}")


def esc(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def f(n: float) -> str:
    return f"{n:.2f}".rstrip("0").rstrip(".")


def polar(cx, cy, r, deg):
    a = math.radians(deg)
    return cx + math.cos(a) * r, cy + math.sin(a) * r


def arc_path(cx, cy, r, a0, a1):
    x0, y0 = polar(cx, cy, r, a0)
    x1, y1 = polar(cx, cy, r, a1)
    large = 1 if abs(a1 - a0) > 180 else 0
    sweep = 1 if a1 > a0 else 0
    return f"M{f(x0)},{f(y0)} A{f(r)},{f(r)} 0 {large} {sweep} {f(x1)},{f(y1)}"


# ------------------------------------------------------------- disc diagrams

def fig_disc_layers():
    s = Svg(470, "The layers a wheel disc is built from")
    s.markers()
    cx, top, step = 300, 62, 60
    rx, ry = 190, 54
    layers = [
        ("face", "wedges"),
        ("plates", "sprites"),
        ("dividers and pegs", "lines"),
        ("labels", "text"),
        ("bezel", "fixed"),
        ("hub", "fixed"),
        ("pointer", "fixed"),
    ]
    for i, (name, _) in enumerate(layers):
        cy = top + i * step
        s.add(
            f'<ellipse cx="{cx}" cy="{f(cy)}" rx="{rx}" ry="{ry}" fill="{WASH}" '
            f'stroke="{LINE if i > 3 else KEY}" stroke-width="1.6"/>'
        )
        if name == "face":
            for k in range(12):
                x1, y1 = polar(cx, cy, rx * 0.30, k * 30)
                x2, y2 = polar(cx, cy, rx, k * 30)
                s.add(
                    f'<line x1="{f(x1)}" y1="{f(cy + (y1 - cy) * ry / rx)}" x2="{f(x2)}" '
                    f'y2="{f(cy + (y2 - cy) * ry / rx)}" stroke="{KEY}" stroke-width="0.9" opacity="0.5"/>'
                )
        if name == "dividers and pegs":
            for k in range(12):
                px, py = polar(cx, cy, rx * 0.9, k * 30)
                s.circle(px, cy + (py - cy) * ry / rx, 4, fill=KEY)
        if name == "labels":
            for k in range(12):
                px, py = polar(cx, cy, rx * 0.62, k * 30)
                ly = cy + (py - cy) * ry / rx
                s.line(px - 9, ly, px + 9, ly, KEY, 2.6)
        if name == "pointer":
            s.path(f"M{cx},{f(cy - 34)} L{cx + 15},{f(cy - 6)} L{cx - 15},{f(cy - 6)} z", fill=INK)
        s.line(cx + rx + 10, cy, 560, cy, LINE, 1.2, dash="3 4")
        s.text(572, cy + 5, name, INK, 15)

    split = top + 3.5 * step
    s.line(72, top - 40, 72, split - 10, KEY, 2.4)
    s.line(72, split + 10, 72, top + 6 * step + 40, LINE, 2.4)
    for y, label, color in (
        ((top - 40 + split - 10) / 2, "ctx.disc turns", KEY),
        ((split + 10 + top + 6 * step + 40) / 2, "ctx.overlay is fixed", MUTED),
    ):
        s.add(
            f'<text x="52" y="{f(y)}" fill="{color}" font-size="13.5" text-anchor="middle" '
            f'font-family="ui-monospace, SFMono-Regular, Menlo, monospace" '
            f'transform="rotate(-90 52 {f(y)})">{esc(label)}</text>'
        )
    s.save(DISC / "layers.svg")


def fig_face_template():
    s = Svg(400, "What a face texture has to match")
    s.markers()
    cx, cy, R = 400, 190, 150
    s.rect(cx - R, cy - R, 2 * R, 2 * R, stroke=LINE, width=1.6, dash="6 5")
    s.circle(cx, cy, R, fill=WASH, stroke=INK, width=2)
    for k in range(12):
        x, y = polar(cx, cy, R, k * 30)
        s.line(cx, cy, x, y, LINE, 1)
    s.line(cx, cy, *polar(cx, cy, R, 0), stroke=KEY, width=2.6)
    s.path(arc_path(cx, cy, 56, 0, 30), stroke=KEY, width=2)
    s.circle(cx, cy, 4.5, fill=KEY)

    s.text(cx + R + 16, cy + 5, "0 deg", KEY, 14)
    s.text(cx + 64, cy + 34, "section 0", KEY, 14)
    s.leader(cx, cy, cx - 118, cy - 118, "image centre", INK, "end")
    s.text(cx - R, cy - R - 14, "transparent corners", MUTED, 13.5)
    s.arrow(cx - R, cy + R + 34, cx + R, cy + R + 34, KEY, 1.8, both=True)
    s.text(cx, cy + R + 58, "width = 2 x outerRadius", KEY, 14, anchor="middle")
    s.save(DISC / "face-template.svg")


def fig_plate_sprite():
    s = Svg(332, "How a plate sprite is authored")
    s.markers()
    bx, by, bw, bh = 295, 30, 210, 240
    s.rect(bx, by, bw, bh, stroke=LINE, width=1.6, dash="6 5")
    top_w, bot_w = 166, 100
    cxp = bx + bw / 2
    s.path(
        f"M{f(cxp - top_w / 2)},{by + 20} L{f(cxp + top_w / 2)},{by + 20} "
        f"L{f(cxp + bot_w / 2)},{by + bh - 20} L{f(cxp - bot_w / 2)},{by + bh - 20} z",
        fill=WASH, stroke=INK, width=2.2,
    )
    s.line(cxp, by - 6, cxp, by + bh + 6, LINE, 1.2, dash="4 4")
    s.line(bx - 6, by + bh / 2, bx + bw + 6, by + bh / 2, LINE, 1.2, dash="4 4")
    s.circle(cxp, by + bh / 2, 5, fill=KEY)
    s.arrow(cxp, by + 62, cxp, by + 26, KEY, 1.8)
    s.text(cxp + 12, by + 48, "up is outward", KEY, 14)
    s.text(bx + bw + 24, by + bh / 2 + 5, "anchor 0.5, 0.5", INK, 14)
    s.text(cxp, by + bh + 34, "outer chord = 2 R sin(arc / 2)", MUTED, 13.5, anchor="middle")
    s.save(DISC / "plate-sprite.svg")


def fig_plate_placed():
    s = Svg(360, "Where the geometry puts each plate")
    s.markers()
    cx, cy, R = 420, 175, 150
    s.circle(cx, cy, R, stroke=LINE, width=1.4)
    s.circle(cx, cy, R * 0.32, stroke=LINE, width=1.4)
    for k in range(12):
        a = k * 30 - 90
        x, y = polar(cx, cy, R * 0.70, a)
        lead = k == 0
        s.add(
            f'<g transform="translate({f(x)},{f(y)}) rotate({f(a + 90)})">'
            f'<path d="M-27,-31 L27,-31 L16,31 L-16,31 z" fill="{WASH}" stroke="{KEY if lead else LINE}" '
            f'stroke-width="{2.2 if lead else 1.3}"/></g>'
        )
    s.line(cx, cy, *polar(cx, cy, R, -90), stroke=KEY, width=1.6, dash="4 4")
    s.text(cx, cy - R - 16, "midAngle", KEY, 14, anchor="middle")
    s.text(cx + R + 18, cy + 5, "radius x R", MUTED, 13.5)
    s.text(60, cy - 10, "rotation =", MUTED, 14)
    s.mono(60, cy + 12, "midAngle + 90", KEY, 13.5)
    s.save(DISC / "plate-placed.svg")


def fig_atlas():
    s = Svg(300, "Atlas regions: packed, trimmed, rotated")
    s.markers()
    titles = ["packed as drawn", "trimmed", "rotated 90 deg CCW"]
    for i, title in enumerate(titles):
        x = 20 + i * 262
        s.rect(x, 30, 224, 176, stroke=LINE, width=1.4, rx=8)
        if i == 0:
            s.rect(x + 42, 50, 140, 136, stroke=INK, width=2)
            s.path(f"M{x + 74},{172} L{x + 112},{66} L{x + 150},{172} z", fill=WASH, stroke=INK, width=1.6)
        elif i == 1:
            s.rect(x + 42, 50, 140, 136, stroke=LINE, width=1.3, dash="5 4")
            s.rect(x + 70, 62, 84, 112, stroke=KEY, width=2)
            s.path(f"M{x + 78},{168} L{x + 112},{68} L{x + 146},{168} z", fill=WASH, stroke=KEY, width=1.6)
            s.arrow(x + 42, 56, x + 70, 56, KEY, 1.5)
            s.text(x + 46, 46, "offset", KEY, 13)
        else:
            s.rect(x + 54, 58, 116, 120, stroke=KEY, width=2)
            s.add(
                f'<g transform="translate({x + 112},118) rotate(-90)">'
                f'<path d="M-44,50 L0,-46 L44,50 z" fill="{WASH}" stroke="{KEY}" stroke-width="1.6"/></g>'
            )
        s.text(x + 112, 232, title, INK, 14, anchor="middle")
    s.save(DISC / "atlas.svg")


def fig_label_slot():
    s = Svg(380, "The room a label has inside its wedge")
    s.markers()
    cx, cy, R = 380, 210, 160
    s.circle(cx, cy, R, fill=WASH, stroke=LINE, width=1.4)
    a0, a1 = -122, -58
    wx0, wy0 = polar(cx, cy, R, a0)
    wx1, wy1 = polar(cx, cy, R, a1)
    s.path(
        f"M{f(cx)},{f(cy)} L{f(wx0)},{f(wy0)} A{f(R)},{f(R)} 0 0 1 {f(wx1)},{f(wy1)} Z",
        fill="none", stroke=INK, width=2,
    )
    lr = R * 0.72
    x0, y0 = polar(cx, cy, lr, a0)
    x1, y1 = polar(cx, cy, lr, a1)
    s.line(x0, y0, x1, y1, KEY, 2.4)
    s.rect(x0, y0, x1 - x0, 52, stroke=KEY, width=1.8, dash="5 4")
    s.line(cx, cy, cx, cy - R, LINE, 1.3, dash="4 4")
    s.leader(x0, y0, 152, y0 - 48, "chordAt(radius)", KEY, "end")
    s.leader(x1, y0 + 52, 536, y0 + 84, "the slot a label is fitted into", KEY, "start")
    s.leader(cx, cy - lr * 0.5, 536, cy - 40, "labelRadius", MUTED, "start")
    s.save(DISC / "label-slot.svg")


# ----------------------------------------------------------- tongue diagrams

def fig_tongue_anatomy():
    s = Svg(380, "Where the tongue sits and what it touches")
    s.markers()
    cx, cy, R = 400, 720, 540
    s.circle(cx, cy, R, stroke=INK, width=2)
    peg_r = R - 42
    s.circle(cx, cy, peg_r, stroke=LINE, width=1.3, dash="5 5")
    for k in range(-5, 6):
        x, y = polar(cx, cy, peg_r, -90 + k * 8)
        s.circle(x, y, 11, fill=WASH, stroke=KEY, width=1.8)

    tipy = cy - (R - 22)
    piny = tipy - 104
    s.path(
        f"M{cx - 26},{f(piny)} C{cx - 28},{f(piny + 52)} {cx - 16},{f(tipy - 14)} {cx},{f(tipy)} "
        f"C{cx + 16},{f(tipy - 14)} {cx + 28},{f(piny + 52)} {cx + 26},{f(piny)} z",
        fill=WASH, stroke=INK, width=2.4,
    )
    s.circle(cx, piny, 8, fill=INK)

    s.leader(cx, piny, 548, piny - 26, "pin: the pivot", INK)
    s.leader(cx, tipy, 548, tipy + 52, "tip", INK)
    s.arrow(cx + 150, piny, cx + 150, tipy, KEY, 1.8, both=True)
    s.mono(cx + 162, (piny + tipy) / 2 + 5, "skin.length", KEY)
    s.arrow(cx - 150, tipy, cx - 150, cy - R, KEY, 1.8, both=True)
    s.mono(cx - 162, (tipy + cy - R) / 2 + 5, "tipInset", KEY, anchor="end")
    s.line(150, cy - R, 790, cy - R, LINE, 1.2, dash="4 4")
    s.text(14, cy - R + 5, "the rim", MUTED, 13.5)
    s.line(150, cy - peg_r, 790, cy - peg_r, LINE, 1.2, dash="4 4")
    s.mono(14, cy - peg_r + 5, "R - pegs.inset", MUTED, 13.5)
    px, py = polar(cx, cy, peg_r, -90)
    s.arrow(px - 34, py + 52, px + 34, py + 52, KEY, 1.8, both=True)
    s.text(cx, py + 76, "contact width 2c", KEY, 14, anchor="middle")
    s.save(TONGUE / "anatomy.svg")


def fig_tongue_art():
    s = Svg(330, "What pointer art has to declare")
    s.markers()
    bx, by, bw, bh = 250, 28, 200, 264
    s.rect(bx, by, bw, bh, stroke=LINE, width=1.6, dash="6 5")
    cxp = bx + bw / 2
    s.path(
        f"M{f(cxp)},{by + 16} C{f(cxp + 38)},{by + 118} {f(cxp + 44)},{by + 192} {f(cxp + 33)},{by + 232} "
        f"L{f(cxp - 33)},{by + 232} C{f(cxp - 44)},{by + 192} {f(cxp - 38)},{by + 118} {f(cxp)},{by + 16} z",
        fill=WASH, stroke=INK, width=2.4,
    )
    piny = by + bh * 0.85
    s.line(bx - 6, piny, bx + bw + 6, piny, LINE, 1.2, dash="4 4")
    s.line(cxp, by - 6, cxp, by + bh + 6, LINE, 1.2, dash="4 4")
    s.circle(cxp, piny, 6, fill=KEY)
    s.leader(cxp, piny, bx + bw + 30, piny + 4, "pin { x: 0.5, y: 0.85 }", KEY)
    s.leader(cxp, by + 16, bx + bw + 30, by + 18, "tip on the top edge: artDirection 'up'", INK)
    s.arrow(bx - 34, piny, bx - 34, by + 16, KEY, 1.8, both=True)
    s.mono(bx - 46, (piny + by) / 2 + 5, "length", KEY, anchor="end")
    s.save(TONGUE / "art.svg")


def fig_contact():
    s = Svg(330, "One peg going under the tongue")
    s.markers()
    x0, x1, base = 90, 740, 236

    def ux(u):
        return x0 + (u + 20) * (x1 - x0) / 56

    s.line(x0 - 20, base, x1 + 20, base, LINE, 1.6)
    marks = [
        (-13, "-c", "first touch", 0, "middle", 0),
        (0, "0", "the crown", 0, "middle", 0),
        (13, "c", "peg is through", 1, "end", -8),
        (17.6, "c(1+friction)", "let go", 0, "start", 8),
    ]
    for u, tag, note, row, anchor, dx in marks:
        s.line(ux(u), base - 168, ux(u), base + 8 + row * 26, LINE, 1.2, dash="4 4")
        s.mono(ux(u) + dx, base + 26 + row * 26, tag, KEY, 13.5, anchor=anchor)
        s.text(ux(u) + dx, base + 44 + row * 26, note, MUTED, 12.5, anchor=anchor)

    pts = []
    for i in range(0, 241):
        u = -20 + i * 56 / 240
        if u <= -13:
            d = 0.0
        elif u <= 0:
            d = math.atan((u + 13) / 40) / math.atan(13 / 40)
        elif u <= 17.6:
            d = 1.0
        else:
            t = (u - 17.6) / 12
            d = math.cos(t * 9) * math.exp(-t * 3.2)
        pts.append((ux(u), base - 150 * d))
    s.path("M" + " L".join(f"{f(x)},{f(y)}" for x, y in pts), stroke=INK, width=2.6)
    s.line(x0 - 20, base - 150, x1 + 20, base - 150, LINE, 1.2, dash="2 7")
    s.text(x0 - 20, base - 160, "crown deflection", MUTED, 13.5)
    s.text(x0 - 20, base - 190, "deflection", INK, 14.5)
    s.arrow(x0, base - 200, x1, base - 200, KEY, 1.6)
    s.text(x1, base - 210, "direction of travel", KEY, 13.5, anchor="end")
    s.save(TONGUE / "contact.svg")


def fig_spring():
    s = Svg(300, "How the tongue comes back after a peg lets go")
    s.markers()
    x0, x1, base = 150, 760, 200
    s.line(x0 - 10, base, x1, base, LINE, 1.6)
    s.line(x0, base - 130, x0, base + 46, LINE, 1.6)
    curves = [("stiff", "700 / 18", 700, 18, INK), ("default", "420 / 14", 420, 14, KEY), ("floppy", "140 / 5", 140, 5, MUTED)]
    for i, (name, nums, k, c, color) in enumerate(curves):
        d, v, pts = 1.0, 0.0, []
        steps = 400
        for j in range(steps):
            v += (-k * d - c * v) * (0.6 / steps)
            d += v * (0.6 / steps)
            pts.append((x0 + (x1 - x0) * (j / steps), base - 118 * d))
        s.path("M" + " L".join(f"{f(x)},{f(y)}" for x, y in pts), stroke=color, width=2.4)
        s.text(20, 52 + i * 40, name, color, 15)
        s.mono(20, 70 + i * 40, nums, MUTED, 13)
    s.text(x1, base + 34, "0.6 s", MUTED, 13.5, anchor="end")
    s.text(x0 - 12, base - 124, "deg", MUTED, 13.5, anchor="end")
    s.save(TONGUE / "spring.svg")


def fig_drag():
    s = Svg(262, "The arc a dragging tongue holds back")
    s.markers()
    x0, x1, base = 90, 740, 206

    def ux(u):
        return x0 + (u + 20) * (x1 - x0) / 56

    s.line(x0 - 20, base, x1 + 20, base, LINE, 1.6)
    for u, label in [(-13, "peg touches"), (0, "crown"), (13, "through")]:
        s.line(ux(u), base - 150, ux(u), base + 8, LINE, 1.2, dash="4 4")
        s.text(ux(u), base + 28, label, MUTED, 13.5, anchor="middle")
    pts = []
    for i in range(0, 241):
        u = -20 + i * 56 / 240
        h = 0.0 if u <= -13 else ((u + 13) / 13 if u <= 0 else math.exp(-u / 2.2))
        pts.append((ux(u), base - 130 * h))
    s.path("M" + " L".join(f"{f(x)},{f(y)}" for x, y in pts), stroke=KEY, width=2.8)
    s.line(x0 - 20, base - 130, x1 + 20, base - 130, LINE, 1.2, dash="2 7")
    s.text(x0 - 20, base - 140, "at most drag x c / pegRadius", MUTED, 13.5)
    s.text(x0 - 20, base - 170, "arc held back", INK, 14.5)
    s.text(ux(6), base - 108, "released at dragRelease", KEY, 13.5)
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
    fig_plate_sprite()
    fig_plate_placed()
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
