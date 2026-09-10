// @ts-nocheck
// Injected globals: WheelBuilder, SpinPresets, app

// The outer ring decides whether the inner one spins at all. Landing on a
// SPIN sector starts the inner ring from the landing event; anything else
// ends the round. The inner pointer sits on the outer ring's inner edge
// pointing inward.
const wheel = new WheelBuilder()
  .radius(280, 190)
  .sections([
    { id: 'spin', label: 'SPIN', style: { fill: 0x8e44ad } },
    { id: 'c50', label: '50', value: 50, style: { fill: 0x1e9e5a } },
    { id: 'c100', label: '100', value: 100, style: { fill: 0x10ac84 } },
    { id: 'spin2', label: 'SPIN', style: { fill: 0x8e44ad } },
    { id: 'c200', label: '200', value: 200, style: { fill: 0x2e86de } },
    { id: 'c75', label: '75', value: 75, style: { fill: 0x1e9e5a } },
  ])
  .skin({ type: 'graphics', hub: false })
  .ring('inner', (r) =>
    r
      .radius(176, 40)
      .pointer({ angle: -90, facing: 'inward', tipInset: 10, skin: { type: 'graphics', shape: 'triangle', color: 0xffd166, length: 44, width: 28 } })
      .sections([
        { id: 'x2', label: 'x2', value: 2 },
        { id: 'x5', label: 'x5', value: 5 },
        { id: 'x3', label: 'x3', value: 3 },
        { id: 'x10', label: 'x10', value: 10, weight: 0.6, style: { fill: 0xf1c40f, labelColor: 0x2b1d00 } },
      ])
      .skin({ type: 'graphics', rim: { width: 6 } }),
  )
  .speed('normal', SpinPresets.TURBO)
  .ticker(app.ticker)
  .build();

return {
  wheel,
  onSpin: async () => {
    const outer = wheel.spin();
    await new Promise((r) => setTimeout(r, 250));
    const outcome = ['spin', 'c50', 'c100', 'spin2', 'c200', 'c75'][Math.floor(Math.random() * 6)];
    wheel.setResult({ section: outcome });
    const result = await outer;
    if (!result.section.id.startsWith('spin')) return;
    const inner = wheel.spin({ ring: 'inner' });
    await new Promise((r) => setTimeout(r, 250));
    wheel.setResult({ value: [2, 3, 5, 10][Math.floor(Math.random() * 4)] }, { ring: 'inner' });
    await inner;
  },
};
