// @ts-nocheck
// Injected globals: WheelBuilder, SpinPresets, DebugRingSkin, debugArc, debugOverlay, app

// The plain skin plus the live overlay: dividers with their angles on pills
// inside the rim, the pointer from pin to tip with the local angle under it,
// the pegs, the planned landing angle in yellow, and a HUD panel in the
// corner of the canvas with the state, speed and current leg. Text stays
// readable at any wheel scale. debugArc() prints the same as text; it is
// what an agent reads when it cannot see the canvas. Open the console. The
// overlay handle goes back to the runner, so the Debug button toggles this
// one instead of stacking a second.
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

const overlay = debugOverlay(wheel, { layers: 'all', live: true, ticker: app.ticker, hud: 'bottom-left', screen: app.screen });
wheel.events.on('spin:stopping', () => console.log(debugArc(wheel)));
wheel.events.on('spin:complete', () => console.log(debugArc(wheel)));

return {
  wheel,
  overlay,
  onSpin: async () => {
    const spin = wheel.spin();
    await new Promise((r) => setTimeout(r, 300));
    wheel.setResult({ section: 'e' }, { anticipation: { bait: 'd' }, mode: 'random' });
    await spin;
  },
};
