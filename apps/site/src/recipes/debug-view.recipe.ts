// @ts-nocheck
// Injected globals: WheelBuilder, SpinPresets, DebugRingSkin, debugArc, debugOverlay, app

// The plain skin plus the live overlay: dividers with their angles, the
// pointer line, the planned landing angle in yellow, and a HUD with the
// state, speed and current leg. debugArc() prints the same as text; it is
// what an agent reads when it cannot see the canvas. Open the console.
const wheel = new WheelBuilder()
  .radius(230, 40)
  .sections([
    { id: 'a', label: 'A', weight: 3 },
    { id: 'b', label: 'B', weight: 1 },
    { id: 'c', label: 'C', weight: 2 },
    { id: 'd', label: 'D', weight: 1.5 },
    { id: 'e', label: 'E', weight: 0.5 },
  ])
  .skin(new DebugRingSkin())
  .speed('normal', SpinPresets.NORMAL)
  .ticker(app.ticker)
  .build();

debugOverlay(wheel, { layers: 'all', live: true, ticker: app.ticker });
wheel.events.on('spin:stopping', () => console.log(debugArc(wheel)));
wheel.events.on('spin:complete', () => console.log(debugArc(wheel)));

return {
  wheel,
  onSpin: async () => {
    const spin = wheel.spin();
    await new Promise((r) => setTimeout(r, 300));
    wheel.setResult({ section: 'e' }, { anticipation: { bait: 'd' }, mode: 'random' });
    await spin;
  },
};
