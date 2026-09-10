// @ts-nocheck
// Injected globals: WheelBuilder, SpinPresets, app

// The classic near-miss. The server says x2; the wheel slows to a crawl as
// the pointer enters the x50 sliver right before it, keeps slowing across
// it, and barely crosses the line into x2, resting right next to it. Bait
// must sit just BEFORE the landing in the spin direction; the engine checks
// and tells you if not.
const wheel = new WheelBuilder()
  .radius(240, 34)
  .sections([
    { id: 'x2a', label: 'x2', value: 2, weight: 3 },
    { id: 'x50', label: 'x50', value: 50, weight: 0.8, style: { fill: 0xf1c40f, labelColor: 0x2b1d00 } },
    { id: 'x5', label: 'x5', value: 5, weight: 2 },
    { id: 'x3', label: 'x3', value: 3, weight: 2.5 },
    { id: 'x10', label: 'x10', value: 10, weight: 1 },
    { id: 'x2b', label: 'x2', value: 2, weight: 3 },
    { id: 'x8', label: 'x8', value: 8, weight: 1.2 },
  ])
  .speed('normal', SpinPresets.NORMAL)
  .ticker(app.ticker)
  .build();

wheel.events.on('anticipation:start', ({ bait, style }) => console.log(`[bait] teasing ${bait.id} (${style})`));
wheel.events.on('anticipation:bait', () => console.log('[bait] pointer on the bait...'));
wheel.events.on('anticipation:end', () => console.log('[bait] ...and past it'));

return {
  wheel,
  onSpin: async () => {
    const spin = wheel.spin();
    await new Promise((r) => setTimeout(r, 300));
    // Clockwise, the pointer meets x50 just before x2a: creep.
    wheel.setResult({ section: 'x2a' }, { anticipation: { bait: 'x50', creepSpeed: 45 } });
    await spin;
  },
};
