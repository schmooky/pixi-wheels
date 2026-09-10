// @ts-nocheck
// Injected globals: WheelBuilder, SpinPresets, app

// Overshoot: the bait sits just AFTER the landing. The wheel runs out of
// momentum with the pointer a few degrees past the line, into the jackpot,
// holds a beat, and rolls softly back over it. It rests on the result next to
// that line: "it was going to be GRAND". Every default is tuned for that
// beat; the wheel spins the same with no options at all.
const wheel = new WheelBuilder()
  .radius(240, 34)
  .sections([
    { id: 'mini', label: 'MINI', weight: 4, style: { fill: 0x2e86de } },
    { id: 'grand', label: 'GRAND', weight: 0.9, style: { fill: 0xf1c40f, labelColor: 0x2b1d00 } },
    { id: 'minor', label: 'MINOR', weight: 3, style: { fill: 0x10ac84 } },
    { id: 'mini2', label: 'MINI', weight: 4, style: { fill: 0x2e86de } },
    { id: 'major', label: 'MAJOR', weight: 1.5, style: { fill: 0xee5253 } },
    { id: 'minor2', label: 'MINOR', weight: 3, style: { fill: 0x10ac84 } },
  ])
  .speed('normal', SpinPresets.NORMAL)
  .ticker(app.ticker)
  .build();

return {
  wheel,
  onSpin: async () => {
    const spin = wheel.spin();
    await new Promise((r) => setTimeout(r, 300));
    // Clockwise the pointer meets minor, then grand: the bait comes AFTER the
    // landing, so 'auto' picks overshoot. Land minor, bait grand.
    wheel.setResult({ section: 'minor' }, { anticipation: { bait: 'grand' } });
    await spin;
  },
};
