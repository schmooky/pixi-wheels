// @ts-nocheck
// Injected globals: WheelBuilder, SpinPresets, app

// Press the button again while the wheel turns to skip. This wheel refuses
// a skip in its first 1200 ms and takes 300 ms to land when it accepts one.
// A press made before the server answered is queued with requestSkip().
const wheel = new WheelBuilder()
  .radius(220, 30)
  .sections(Array.from({ length: 8 }, (_, i) => ({ id: `s${i}`, label: `${i + 1}` })))
  .skip({ allowed: true, minimumSpinTime: 1200 })
  .speed('normal', { ...SpinPresets.CINEMATIC, skipDuration: 300 })
  .ticker(app.ticker)
  .build();

wheel.events.on('skip:requested', () => console.log('[skip] accepted'));
wheel.events.on('skip:completed', () => console.log('[skip] landed'));
wheel.events.on('spin:complete', (r) => console.log('[skip] complete, skipped =', r.wasSkipped));

return {
  wheel,
  onSpin: async () => {
    const spin = wheel.spin();
    await new Promise((r) => setTimeout(r, 900)); // a slow server
    wheel.setResult({ index: Math.floor(Math.random() * 8) });
    await spin;
  },
  onSkip: () => {
    // Before the result: queue. After: land now.
    try { wheel.skip(); } catch { wheel.requestSkip(); }
  },
};
