// @ts-nocheck
// Injected globals: WheelBuilder, SpinPresets, SpineRingSkin, SpinePointerSkin, loadPlaysonSpine, PLAYSON_SECTIONS, loadPlaysonAudio, app, PIXI

// The Super Wheel as a Spine skeleton (Playson, used with permission), with
// the game's own effects: bulbs that alternate at rest and chase during the
// spin, and on landing the sector sweep, the sector glow, the gold sparkle on
// coin plates, the rainbow shockwave and a bulb strobe. The engine turns the
// `wheel` bone; everything else is the skeleton's animation, picked by name
// per section. The stopper is its own skeleton with a `tick` swing per divider.
// The coin values the skeleton cannot know are rich labels on the disc.
const [spine, audio] = await Promise.all([loadPlaysonSpine(), loadPlaysonAudio()]);
const R = 250;
const k = R / spine.radius;

const gold = new PIXI.FillGradient({
  type: 'linear', start: { x: 0, y: 0 }, end: { x: 0, y: 1 }, textureSpace: 'local',
  colorStops: [{ offset: 0, color: 0xfff1a8 }, { offset: 0.5, color: 0xffcf3d }, { offset: 1, color: 0xe08a12 }],
});
const coinValue = (ctx) => {
  const t = new PIXI.Text({
    text: `x${ctx.section.value}`,
    style: { fontFamily: 'Roboto Condensed, Arial Narrow, sans-serif', fontSize: 64, fontWeight: '900', fill: gold, stroke: { color: 0x3a2200, width: 7, join: 'round' } },
  });
  t.anchor.set(0.5);
  ctx.fit(t, { padding: 0.1 });
  return t;
};

const wheel = new WheelBuilder()
  .radius(R)
  .sections(PLAYSON_SECTIONS.map((s) => (s.tags.includes('coin')
    ? { ...s, content: coinValue, style: { labelOrientation: 'tangential', labelRadius: 0.5 } }
    : { ...s, label: '' })))
  .pointer({
    angle: -90,
    tipInset: 14,
    skin: new SpinePointerSkin({ skeleton: spine.stopper, atlas: spine.atlas, length: spine.stopperLength * k, scale: k, artDirection: 'down', flapRotates: false }),
  })
  .skin(new SpineRingSkin({
    skeleton: spine.skeleton, atlas: spine.atlas, bone: spine.bone, scale: k, labels: true,
    animations: { idle: 'idle', spin: 'spin', winBySection: spine.winBySection },
  }))
  .landing({ mode: 'random', margin: 0.15 })
  .speed('normal', SpinPresets.NORMAL)
  .ticker(app.ticker)
  .build();

audio.attach(wheel);

return {
  wheel,
  onSpin: async () => {
    await audio.unlock();
    const spin = wheel.spin();
    await new Promise((r) => setTimeout(r, 300));
    const i = Math.floor(Math.random() * PLAYSON_SECTIONS.length);
    // Bait with the plate just before the target, so the tease creeps past it or stalls just short of it.
    wheel.setResult({ section: PLAYSON_SECTIONS[i].id }, { anticipation: { bait: PLAYSON_SECTIONS[(i + 11) % 12].id } });
    await spin;
  },
};
