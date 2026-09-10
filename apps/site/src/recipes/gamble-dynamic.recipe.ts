// @ts-nocheck
// Injected globals: WheelBuilder, SpinPresets, app

// Red / green whose split moves after every spin. The odds live on the
// server; the arc is cosmetic and follows a step list. The pointer still
// lands on whichever colour the server said.
const wheel = new WheelBuilder()
  .radius(200, 26)
  .sections([
    { id: 'red', label: '', value: 'red', style: { fill: 0xd7263d } },
    { id: 'green', label: '', value: 'green', style: { fill: 0x1e9e5a } },
  ])
  .dynamic({
    steps: [
      { red: 1, green: 1 },
      { red: 3, green: 2 },
      { red: 2, green: 1 },
      { red: 3, green: 1 },
      { red: 5, green: 1 },
    ],
    durationMs: 600,
    ease: 'sine.inOut',
  })
  .skin({ type: 'graphics', dividers: { width: 5, color: 0xffffff }, hub: { radius: 26, color: 0x111111 } })
  .landing({ mode: 'random', margin: 0.1 })
  .speed('normal', SpinPresets.QUICK)
  .ticker(app.ticker)
  .build();

return {
  wheel,
  onSpin: async () => {
    const spin = wheel.spin();
    await new Promise((r) => setTimeout(r, 200));
    const won = Math.random() < 0.5;
    wheel.setResult({ value: won ? 'green' : 'red' });
    await spin;
    // Each win shrinks the green: the next step is the next state.
    await wheel.nextStep();
  },
};
