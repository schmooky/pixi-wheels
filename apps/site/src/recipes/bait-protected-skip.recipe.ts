// @ts-nocheck
// Injected globals: WheelBuilder, SpinPresets, app

// A tease the player cannot skip past without seeing: the first press jumps
// to the bait and lets the crawl play; the second press lands.
const wheel = new WheelBuilder()
  .radius(240, 34)
  .sections([
    { id: 'x2', label: 'x2', value: 2, weight: 3 },
    { id: 'jackpot', label: 'JACKPOT', weight: 1, style: { fill: 0xf1c40f, labelColor: 0x2b1d00 } },
    { id: 'x5', label: 'x5', value: 5, weight: 2 },
    { id: 'x3', label: 'x3', value: 3, weight: 2.5 },
    { id: 'x10', label: 'x10', value: 10, weight: 1 },
  ])
  .skip({ protectAnticipation: true })
  .speed('normal', SpinPresets.CINEMATIC)
  .ticker(app.ticker)
  .build();

wheel.events.on('skip:requested', ({ protectedByAnticipation }) =>
  console.log(protectedByAnticipation ? '[skip] first press: jump to the bait' : '[skip] second press: land'),
);

return {
  wheel,
  onSpin: async () => {
    const spin = wheel.spin();
    await new Promise((r) => setTimeout(r, 300));
    wheel.setResult({ section: 'x2' }, { anticipation: { bait: 'jackpot', style: 'creep', creepSpeed: 35 } });
    await spin;
  },
};
