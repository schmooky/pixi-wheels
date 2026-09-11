// @ts-nocheck
// Injected globals: WheelBuilder, SpinPresets, TextureRingSkin, app, PIXI

// The same art without writing a skin. TextureRingSkin takes one painted
// face, one fixed frame and a list of per-section decorations, and keeps the
// decorations on their sections when the weights move. `faceRotation` lines
// the painting up with section 0: this face is painted from three o'clock,
// the wheel starts at twelve, so it turns by -90.
const base = '/recipes/disc-art/';
const [face, bezel, plate] = await Promise.all(
  ['face.png', 'bezel.png', 'plate.png'].map((n) => PIXI.Assets.load(base + n)),
);

const VALUES = ['x2', 'x5', 'MINI', 'x3', 'x10', 'MINOR', 'x2', 'x50', 'MAJOR', 'x3', 'x5', 'GRAND'];
const sections = VALUES.map((v, i) => ({ id: `s${i}`, label: v, style: { labelColor: 0xfff2cc } }));

const wheel = new WheelBuilder()
  .radius(190)
  .startAngle(-90)
  .sections(sections)
  .skin(
    new TextureRingSkin({
      face,
      faceRotation: -90,
      frame: bezel,
      frameScale: (190 * 2 * 1.085) / bezel.width,
      labels: true,
      decorations: sections.map((s) => ({ section: s.id, texture: plate, radius: 0.655, scale: 0.335 })),
    }),
  )
  .pointer({ angle: -90, skin: { type: 'graphics', shape: 'tongue', color: 0xfff2cc, length: 66, width: 30 } })
  .speed('normal', SpinPresets.NORMAL)
  .ticker(app.ticker)
  .build();

// Weights move the boundaries; the plates and the labels follow, the painted
// face does not. That is the trade: one texture is cheap and fixed, sprites
// per section cost more and stay honest.
let wide = false;
return {
  wheel,
  onSpin: async () => {
    wide = !wide;
    await wheel.main.setWeights(wide ? { s8: 2.6, s2: 2.2 } : { s8: 1, s2: 1 });
    const spin = wheel.spin();
    await new Promise((r) => setTimeout(r, 200));
    wheel.setResult({ index: Math.floor(Math.random() * VALUES.length) });
    await spin;
  },
};
