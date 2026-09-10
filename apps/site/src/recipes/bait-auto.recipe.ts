// @ts-nocheck
// Injected globals: WheelBuilder, SpinPresets, app

// 'auto' (the default style) reads the geometry: bait before the landing
// creeps, bait after it stalls, bait far away is dropped with a console
// warning and the wheel just lands. Every spin here lands on a random
// section and baits with the jackpot next to it.
const wheel = new WheelBuilder()
  .radius(240, 34)
  .sections([
    { id: 'x2', label: 'x2', value: 2, weight: 3 },
    { id: 'jackpot', label: 'JACKPOT', weight: 0.9, style: { fill: 0xf1c40f, labelColor: 0x2b1d00 } },
    { id: 'x5', label: 'x5', value: 5, weight: 2 },
    { id: 'x3', label: 'x3', value: 3, weight: 2.5 },
    { id: 'x10', label: 'x10', value: 10, weight: 1 },
    { id: 'x8', label: 'x8', value: 8, weight: 1.2 },
  ])
  .landing({ anticipation: { bait: 'jackpot' } })
  .speed('normal', SpinPresets.NORMAL)
  .ticker(app.ticker)
  .build();

wheel.events.on('anticipation:start', ({ style }) => console.log('[auto] style:', style));

return {
  wheel,
  onSpin: async () => {
    const spin = wheel.spin();
    await new Promise((r) => setTimeout(r, 300));
    // x2 (before the jackpot, clockwise) creeps; x5 (after it) stalls; x3 is too far.
    const pick = ['x2', 'x5', 'x3'][Math.floor(Math.random() * 3)];
    wheel.setResult({ section: pick });
    await spin;
  },
};
