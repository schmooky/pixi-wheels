// @ts-nocheck
// Injected globals: WheelBuilder, SpinPresets, TexturePointerSkin, loadPlaysonWheel, PlaysonWheelSkin, PLAYSON_SECTIONS, app

// Playson's Four Charged Clovers: Super Wheel (used with permission). The
// twelve authored wedge plates, the bezel, dividers, bulbs and hub come from
// the game's own atlas; the stopper is the game's stopper. The engine only
// knows twelve equal sections and where they are.
const art = await loadPlaysonWheel();

const wheel = new WheelBuilder()
  .radius(250)
  .sections(PLAYSON_SECTIONS)
  .pointer({
    angle: -90,
    tipInset: 14,
    skin: new TexturePointerSkin({ texture: art.textures['wheel/stopper'], artDirection: 'down', pin: { x: 0.5, y: 0.3 }, scale: 250 / 297 }),
    flap: { maxAngle: 45, stiffness: 600, damping: 16 },
  })
  .skin(new PlaysonWheelSkin({ art }))
  .landing({ mode: 'random', margin: 0.15 })
  .speed('normal', SpinPresets.NORMAL)
  .ticker(app.ticker)
  .build();

wheel.events.on('spin:landing', ({ section }) => console.log('[playson] landed', section.id));

return {
  wheel,
  onSpin: async () => {
    const spin = wheel.spin();
    await new Promise((r) => setTimeout(r, 300));
    const i = Math.floor(Math.random() * PLAYSON_SECTIONS.length);
    // Bait with the neighbouring plate; 'auto' creeps past it or stalls short of it depending on the side.
    wheel.setResult({ section: PLAYSON_SECTIONS[i].id }, { anticipation: { bait: PLAYSON_SECTIONS[(i + 11) % 12].id } });
    await spin;
  },
};
