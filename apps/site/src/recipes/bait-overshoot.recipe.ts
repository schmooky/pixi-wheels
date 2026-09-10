// @ts-nocheck
// Injected globals: WheelBuilder, SpinPresets, app

// Overshoot: the bait sits just AFTER the landing. The wheel passes the
// result, stops a few degrees into the jackpot, holds, and rolls back.
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
    // Clockwise the pointer meets grand BEFORE minor... so land on minor and
    // bait with grand? No: overshoot wants the bait AFTER the landing. The
    // pointer meets minor, then grand. Land minor, bait grand -> 'auto'
    // picks overshoot.
    wheel.setResult({ section: 'minor' }, { anticipation: { bait: 'grand', overshootDeg: 7, dwellMs: 700, returnMs: 900 } });
    await spin;
  },
};
