// @ts-nocheck
// Injected globals: WheelBuilder, SpinPresets, TexturePointerSkin, loadPragmaticWheel, PragmaticWheelSkin, PRAGMATIC_SECTIONS, PRAGMATIC_RADIUS, pragmaticPlateLabel, app, PIXI

// Pragmatic Play's Wheel of Happiness (used with permission), as the game
// shows it: twelve gold-framed plates round the golden dragon hub, WILD WINS
// in red and FREE SPINS in green, read from six o'clock by the gem-tipped
// pointer. Each label is rich content: two lines of gold text with the top
// toward the hub, plus the game's bitmap `+`, fitted into the plate. On
// landing the losing plates dim and the game's own Spine effects play: the
// ring flare round the hub at spin start, the selection frames pulsing on the
// winner.
const art = await loadPragmaticWheel();
const R = 262;
const k = R / PRAGMATIC_RADIUS.outer;

const wheel = new WheelBuilder()
  .radius(R, PRAGMATIC_RADIUS.hub * k)
  .sections(PRAGMATIC_SECTIONS.map((s) => ({
    ...s,
    content: pragmaticPlateLabel(art),
    style: { labelOrientation: 'tangential-in', labelRadius: (PRAGMATIC_RADIUS.hub + PRAGMATIC_RADIUS.plate * 0.5) / PRAGMATIC_RADIUS.outer },
  })))
  .pointer({
    angle: 90,
    tipInset: 40 * k,
    skin: new TexturePointerSkin({ texture: art.pointer, artDirection: 'up', pin: { x: 0.5, y: 0.86 }, scale: k * 1.35 }),
    flap: { maxAngle: 10, stiffness: 500, damping: 18 },
  })
  .skin(new PragmaticWheelSkin({ art }))
  .landing({ mode: 'center', settle: 'none' })
  .speed('normal', SpinPresets.NORMAL)
  .ticker(app.ticker)
  .build();

const logo = new PIXI.Sprite(art.logo);
logo.anchor.set(0.5, 1);
logo.scale.set(0.5);
logo.position.set(0, -R - 6);
const stage = new PIXI.Container();
stage.addChild(wheel, logo);

return {
  wheel,
  stage,
  onSpin: async () => {
    const spin = wheel.spin();
    await new Promise((r) => setTimeout(r, 300));
    const i = Math.floor(Math.random() * PRAGMATIC_SECTIONS.length);
    // Tease the neighbouring plate of the other colour, then land.
    const bait = PRAGMATIC_SECTIONS[(i + 1) % 12].id;
    wheel.setResult({ section: PRAGMATIC_SECTIONS[i].id }, { anticipation: { bait } });
    await spin;
  },
};
