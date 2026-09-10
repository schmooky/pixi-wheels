// @ts-nocheck
// Injected globals: WheelBuilder, SpinPresets, TexturePointerSkin, loadPragmaticWheel, app, PIXI

// Studio art on a painted face: the golden ring frame, the pointer and the
// logo from Pragmatic Play's Wheel of Happiness (used with permission), on a
// red-and-gold graphics face. The frame is a fixed sprite on the overlay; the
// pointer is the game's own stopper as a TexturePointerSkin.
const art = await loadPragmaticWheel();

const RED = 0x9b111e, DARK = 0x5c0a12, GOLD = 0xf3c15a;
const values = [50, 100, 200, 500, 100, 50, 1000, 100, 200, 50, 500, 100];
const wheel = new WheelBuilder()
  .radius(240, 46)
  .sections(values.map((v, i) => ({
    id: `p${i}`, label: String(v), value: v,
    style: { fill: i % 2 ? DARK : RED, labelColor: GOLD, labelSize: 30, labelWeight: '800' },
  })))
  .pointer({ angle: -90, tipInset: 26, skin: new TexturePointerSkin({ texture: art.pointer, artDirection: 'down', pin: { x: 0.5, y: 0.1 }, scale: 0.7 }) })
  .skin({ type: 'graphics', dividers: { width: 2, color: GOLD, alpha: 0.9 }, rim: false, hub: false, shading: true })
  .landing({ settle: 'center', mode: 'random' })
  .speed('normal', SpinPresets.NORMAL)
  .ticker(app.ticker)
  .build();

// Frame and hub from the art set, fixed on the overlay.
const frame = new PIXI.Sprite(art.bigRing);
frame.anchor.set(0.5);
frame.scale.set((2 * 262) / frame.texture.width);
const hub = new PIXI.Sprite(art.goldRing);
hub.anchor.set(0.5);
hub.scale.set(110 / hub.texture.width);
const coin = new PIXI.Sprite(art.coin);
coin.anchor.set(0.5);
coin.scale.set(0.9);
wheel.main.overlay.addChildAt(frame, 0);
wheel.main.overlay.addChild(hub, coin);

const logo = new PIXI.Sprite(art.logo);
logo.anchor.set(0.5, 1);
logo.scale.set(0.55);
logo.position.set(0, -285);
const stage = new PIXI.Container();
stage.addChild(wheel, logo);

return {
  wheel,
  stage,
  onSpin: async () => {
    const spin = wheel.spin();
    await new Promise((r) => setTimeout(r, 300));
    wheel.setResult({ value: values[Math.floor(Math.random() * values.length)] }, { anticipation: { bait: 'p6' } });
    await spin;
  },
};
