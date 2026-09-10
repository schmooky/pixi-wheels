// @ts-nocheck
// Injected globals: WheelBuilder, SpinPresets, app

// The studio brief: jackpot sectors whose size changes step by step, as a
// purely cosmetic state. Solid fills, no decoration on the moving borders,
// and the titles slide to the middle of whatever arc they own. The step
// advances after every spin here; a real game drives it from its feature
// state. The spin's landing is decided by the server and never by the arcs.
const wheel = new WheelBuilder()
  .radius(250, 44)
  .sections([
    { id: 'mini', label: 'MINI', style: { fill: 0x2e86de } },
    { id: 'minor', label: 'MINOR', style: { fill: 0x10ac84 } },
    { id: 'mini2', label: 'MINI', style: { fill: 0x2e86de } },
    { id: 'major', label: 'MAJOR', style: { fill: 0xee5253 } },
    { id: 'mini3', label: 'MINI', style: { fill: 0x2e86de } },
    { id: 'minor2', label: 'MINOR', style: { fill: 0x10ac84 } },
    { id: 'grand', label: 'GRAND', style: { fill: 0xf1c40f, labelColor: 0x2b1d00 } },
  ])
  .dynamic({
    steps: [
      { mini: 5, minor: 3, mini2: 5, major: 1.5, mini3: 5, minor2: 3, grand: 0.6 },
      { mini: 4, minor: 3.5, mini2: 4, major: 2, mini3: 4, minor2: 3.5, grand: 1 },
      { mini: 3, minor: 4, mini2: 3, major: 3, mini3: 3, minor2: 4, grand: 1.6 },
      { mini: 2, minor: 4, mini2: 2, major: 4, mini3: 2, minor2: 4, grand: 2.5 },
    ],
    durationMs: 700,
    ease: 'sine.inOut',
  })
  .skin({ type: 'graphics', dividers: { width: 2, color: 0xffffff, alpha: 0.5 }, shading: false, bulbs: { count: 28 } })
  .speed('normal', SpinPresets.NORMAL)
  .ticker(app.ticker)
  .build();

wheel.events.on('sections:changed', ({ step }) => console.log('[dynamic] now on step', step));

return {
  wheel,
  onSpin: async () => {
    const spin = wheel.spin();
    await new Promise((r) => setTimeout(r, 300));
    const tiers = ['mini', 'minor', 'major', 'grand'];
    wheel.setResult({ section: tiers[Math.floor(Math.random() * tiers.length)] });
    await spin;
    await wheel.nextStep();
  },
};
