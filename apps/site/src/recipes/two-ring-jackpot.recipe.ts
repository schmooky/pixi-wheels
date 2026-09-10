// @ts-nocheck
// Injected globals: WheelBuilder, SpinPresets, app

// An outer ring of tiers and an inner ring read by its own pointer at three
// o'clock, facing inward. The two spin independently and share one event
// stream; every payload says which ring it came from.
const wheel = new WheelBuilder()
  .radius(280, 190)
  .sections([
    { id: 'mini', label: 'MINI', style: { fill: 0x2e86de } },
    { id: 'major', label: 'MAJOR', style: { fill: 0xee5253 } },
    { id: 'minor', label: 'MINOR', style: { fill: 0x10ac84 } },
    { id: 'minor2', label: 'MINOR', style: { fill: 0x10ac84 } },
    { id: 'major2', label: 'MAJOR', style: { fill: 0xee5253 } },
    { id: 'mini2', label: 'MINI', style: { fill: 0x2e86de } },
    { id: 'minor3', label: 'MINOR', style: { fill: 0x10ac84 } },
    { id: 'major3', label: 'MAJOR', style: { fill: 0xee5253 } },
  ])
  .skin({ type: 'graphics', hub: false })
  .ring('inner', (r) =>
    r
      .radius(175, 50)
      .direction('ccw')
      .pointer({ angle: 0, facing: 'inward', tipInset: 12, skin: { type: 'graphics', shape: 'triangle', color: 0xffd166, length: 48, width: 30 } })
      .sections([
        { id: 'grand', label: 'GRAND', weight: 0.7, style: { fill: 0xf1c40f, labelColor: 0x2b1d00 } },
        { id: 'minor', label: 'MINOR', style: { fill: 0x10ac84 } },
        { id: 'major', label: 'MAJOR', style: { fill: 0xee5253 } },
        { id: 'minor2', label: 'MINOR', style: { fill: 0x10ac84 } },
        { id: 'major2', label: 'MAJOR', style: { fill: 0xee5253 } },
        { id: 'minor3', label: 'MINOR', style: { fill: 0x10ac84 } },
      ])
      .skin({ type: 'graphics', rim: { width: 6 } }),
  )
  .speed('normal', SpinPresets.NORMAL)
  .ticker(app.ticker)
  .build();

wheel.events.on('spin:landing', ({ ring, section }) => console.log(`[rings] ${ring} landed ${section.id}`));

return {
  wheel,
  onSpin: async () => {
    const outer = wheel.spin();
    const inner = wheel.spin({ ring: 'inner' });
    await new Promise((r) => setTimeout(r, 300));
    wheel.setResult({ index: Math.floor(Math.random() * 8) });
    wheel.setResult({ index: Math.floor(Math.random() * 6) }, { ring: 'inner' });
    await Promise.all([outer, inner]);
  },
};
