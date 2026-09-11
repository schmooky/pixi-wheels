// @ts-nocheck
// Injected globals: WheelBuilder, SpinPresets, TexturePointerSkin, app, PIXI

// Three tongues, three art pipelines, one set of pegs. Top: drawn with
// Graphics, no asset at all. Right: a PNG through TexturePointerSkin, tip on
// the top edge of the image and the pin at 85% down it. Bottom left: the
// gem-tipped stopper from Pragmatic Play's Wheel of Happiness, the same art
// the game uses, declared the same way. A Spine stopper is the fourth option
// and the Playson recipe runs one.
const [tongueArt, gameArt] = await Promise.all([
  PIXI.Assets.load('/recipes/tongue/tongue.png'),
  PIXI.Assets.load('/pragmatic-wheel/pointer.webp'),
]);

const wheel = new WheelBuilder()
  .radius(190, 26)
  .sections(Array.from({ length: 12 }, (_, i) => ({ id: `s${i}`, label: `${i + 1}` })))
  .pegs({ size: 7 })
  .pointer({
    id: 'drawn',
    angle: -90,
    skin: { type: 'graphics', shape: 'tongue', color: 0xfff2cc, length: 70, width: 32 },
  })
  .pointer({
    id: 'png',
    angle: 30,
    skin: new TexturePointerSkin({ texture: tongueArt, artDirection: 'up', pin: { x: 0.5, y: 0.85 }, scale: 0.34 }),
    flap: { elasticity: 1.2, stiffness: 300, damping: 8 },
  })
  .pointer({
    id: 'studio',
    angle: 150,
    skin: new TexturePointerSkin({ texture: gameArt, artDirection: 'up', pin: { x: 0.5, y: 0.86 }, scale: 0.45 }),
    flap: { elasticity: 0.8, stiffness: 520, damping: 16 },
  })
  .skin({ type: 'graphics', dividers: { width: 2 }, pegs: true })
  .speed('normal', SpinPresets.NORMAL)
  .ticker(app.ticker)
  .build();

// Each pointer ticks on its own dividers, so a sound hook needs the id.
wheel.events.on('pointer:tick', ({ pointer, speed }) => {
  if (pointer === 'drawn' && speed > 300) return;
  if (pointer === 'drawn') console.log(`[tick] ${pointer} at ${Math.round(speed)} deg/s`);
});

return {
  wheel,
  onSpin: async () => {
    const spin = wheel.spin();
    await new Promise((r) => setTimeout(r, 200));
    wheel.setResult({ index: Math.floor(Math.random() * 12) });
    await spin;
  },
};
