// @ts-nocheck
// Injected globals: WheelBuilder, SpinPresets, app

// Stutter: like creep, but the crawl all but stalls a hair short of the line,
// still moving at two degrees a second while everyone leans in, then slips
// over it onto the result. The wheel never stops until it rests: the segment
// it stops on is the result.
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
    wheel.setResult({ section: 'mini' }, { anticipation: { bait: 'grand', style: 'stutter', dwellMs: 700 } });
    await spin;
  },
};
