// @ts-nocheck
// Injected globals: WheelBuilder, SpinPresets, app

// The most common wheel there is: a coin flip with a rim. Two sections,
// random landing so the pointer never sits on the divider, quick profile
// because a gamble is spun over and over.
const wheel = new WheelBuilder()
  .radius(200, 26)
  .sections([
    { id: 'red', label: '', value: 'red', style: { fill: 0xd7263d } },
    { id: 'green', label: '', value: 'green', style: { fill: 0x1e9e5a } },
  ])
  .skin({ type: 'graphics', dividers: { width: 5, color: 0xffffff }, hub: { radius: 26, color: 0x111111 } })
  .landing({ mode: 'random', margin: 0.08 })
  .speed('normal', SpinPresets.QUICK)
  .ticker(app.ticker)
  .build();

let balance = 100;
wheel.events.on('spin:landing', ({ section }) => {
  balance = section.id === 'green' ? balance * 2 : 100;
  console.log(`[gamble] ${section.id} -> ${section.id === 'green' ? `balance ${balance}` : 'bust, back to 100'}`);
});

return {
  wheel,
  onSpin: async () => {
    const spin = wheel.spin();
    await new Promise((r) => setTimeout(r, 200));
    wheel.setResult({ value: Math.random() < 0.5 ? 'red' : 'green' });
    await spin;
  },
};
