// @ts-nocheck
// Injected globals: WheelBuilder, SpinPresets, app, PIXI

// A disc, assembled one layer at a time, then spun. Every layer is a real
// texture from the recipe's own art folder: the painted face, a plate per
// section, the dividers and pegs, the labels, the fixed bezel and the hub.
// The engine never looks at any of it - it knows twelve sections and where
// they are, and hands the skin two containers: `disc`, which turns, and
// `overlay`, which does not.
const base = '/recipes/disc-art/';
const [face, plate, hub, bezel] = await Promise.all(
  ['face.png', 'plate.png', 'hub.png', 'bezel.png'].map((n) => PIXI.Assets.load(base + n)),
);

const VALUES = ['x2', 'x5', 'MINI', 'x3', 'x10', 'MINOR', 'x2', 'x50', 'MAJOR', 'x3', 'x5', 'GRAND'];
const STEPS = [
  'face            TextureRingSkin({ face })',
  'plates          one sprite per section',
  'dividers, pegs  the studs the tongue rides',
  'labels          text over the art',
  'bezel           fixed: ctx.overlay',
  'hub             fixed: ctx.overlay',
];

class LayeredDisc {
  constructor(art) {
    this.art = art;
    this.layers = [];
    this._destroyed = false;
  }

  attach(ctx) {
    this.ctx = ctx;
    const R = ctx.outerRadius;
    const layer = (parent) => {
      const c = new PIXI.Container();
      c.alpha = 0;
      parent.addChild(c);
      this.layers.push(c);
      return c;
    };
    const sprite = (texture, width) => {
      const s = new PIXI.Sprite(texture);
      s.anchor.set(0.5);
      s.scale.set(width / s.texture.width);
      return s;
    };
    layer(ctx.disc).addChild(sprite(this.art.face, 2 * R));
    this.plates = layer(ctx.disc);
    this.lines = new PIXI.Graphics();
    layer(ctx.disc).addChild(this.lines);
    this.labels = layer(ctx.disc);
    layer(ctx.overlay).addChild(sprite(this.art.bezel, 2 * R * 1.085));
    layer(ctx.overlay).addChild(sprite(this.art.hub, R * 0.52));
    this.layout();
  }

  // Called on attach and again whenever the weights move a boundary.
  layout() {
    const ctx = this.ctx;
    const R = ctx.outerRadius;
    this.plates.removeChildren();
    this.labels.removeChildren();
    this.lines.clear();
    ctx.geometry.sections.forEach((s, i) => {
      const mid = (s.midAngle * Math.PI) / 180;
      const p = new PIXI.Sprite(this.art.plate);
      p.anchor.set(0.5);
      p.height = R * 0.62;
      p.width = (p.height * this.art.plate.width) / this.art.plate.height;
      p.position.set(Math.cos(mid) * R * 0.63, Math.sin(mid) * R * 0.63);
      p.rotation = mid + Math.PI / 2;
      this.plates.addChild(p);

      const t = new PIXI.Text({
        text: VALUES[i % VALUES.length],
        style: { fill: 0xfff2cc, fontFamily: 'Arial', fontSize: 22, fontWeight: '700' },
      });
      t.anchor.set(0.5);
      t.position.set(Math.cos(mid) * R * 0.66, Math.sin(mid) * R * 0.66);
      t.rotation = mid + Math.PI / 2;
      this.labels.addChild(t);

      const a = (s.startAngle * Math.PI) / 180;
      this.lines.moveTo(Math.cos(a) * R * 0.3, Math.sin(a) * R * 0.3).lineTo(Math.cos(a) * R, Math.sin(a) * R);
    });
    this.lines.stroke({ color: 0x2b1808, width: 3, alpha: 0.65 });
    for (const a of ctx.pegs?.angles ?? []) {
      const rad = (a * Math.PI) / 180;
      this.lines.circle(Math.cos(rad) * ctx.pegs.radius, Math.sin(rad) * ctx.pegs.radius, ctx.pegs.size);
    }
    this.lines.fill({ color: 0xfff2cc }).stroke({ color: 0x6b4a06, width: 2 });
  }

  get isDestroyed() {
    return this._destroyed;
  }

  destroy() {
    this._destroyed = true;
    for (const l of this.layers) l.destroy({ children: true });
  }
}

const skin = new LayeredDisc({ face, plate, hub, bezel });
const wheel = new WheelBuilder()
  .radius(190)
  .sections(VALUES.map((v, i) => ({ id: `s${i}`, label: v })))
  .pegs({ size: 6 })
  .pointer({ angle: -90, skin: { type: 'graphics', shape: 'tongue', color: 0xfff2cc, length: 66, width: 30 } })
  .skin(skin)
  .speed('normal', SpinPresets.NORMAL)
  .ticker(app.ticker)
  .build();

const caption = new PIXI.Text({
  text: '',
  style: { fill: 0x9fb0c3, fontFamily: 'Menlo, Consolas, monospace', fontSize: 13 },
});
caption.anchor.set(0.5, 0);
caption.position.set(0, 212);

const stage = new PIXI.Container();
stage.addChild(wheel, caption);

// Reveal one layer every 900 ms, hold the finished disc, start over.
let shown = 0;
let ms = 0;
const reveal = (t) => {
  if (wheel.isSpinning) {
    for (const l of skin.layers) l.alpha = 1;
    caption.text = 'all six layers + the pointer on the overlay';
    shown = skin.layers.length;
    ms = 0;
    return;
  }
  ms += t.deltaMS;
  if (shown < skin.layers.length) {
    skin.layers[shown].alpha = Math.min(1, skin.layers[shown].alpha + t.deltaMS / 260);
    caption.text = `${shown + 1} / ${skin.layers.length}   ${STEPS[shown]}`;
    if (ms > 900) {
      skin.layers[shown].alpha = 1;
      shown++;
      ms = 0;
    }
  } else if (ms > 2600) {
    for (const l of skin.layers) l.alpha = 0;
    shown = 0;
    ms = 0;
  }
};
app.ticker.add(reveal);

return {
  wheel,
  stage,
  cleanup: () => app.ticker.remove(reveal),
  onSpin: async () => {
    const spin = wheel.spin();
    await new Promise((r) => setTimeout(r, 200));
    wheel.setResult({ index: Math.floor(Math.random() * VALUES.length) });
    await spin;
  },
};
