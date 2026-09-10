// @ts-nocheck
// Injected globals: WheelBuilder, SpinPresets, DebugRingSkin, app

// Where inside the section the pointer ends up. Each spin cycles the mode:
// center (the middle), random (anywhere, away from the edges), exact (the
// offset the server sent: here 0.9, right by the edge).
const wheel = new WheelBuilder()
  .radius(220, 30)
  .sections(Array.from({ length: 8 }, (_, i) => ({ id: `s${i}`, label: `${i}`, value: i })))
  .skin(new DebugRingSkin())
  .speed('normal', SpinPresets.TURBO)
  .ticker(app.ticker)
  .build();

const modes = ['center', 'random', 'exact'];
let i = 0;

return {
  wheel,
  onSpin: async () => {
    const mode = modes[i++ % modes.length];
    const spin = wheel.spin();
    await new Promise((r) => setTimeout(r, 200));
    const target = mode === 'exact' ? { index: 3, offset: 0.9 } : { index: 3 };
    wheel.setResult(target, { mode });
    const result = await spin;
    console.log(`[stop-modes] ${mode}: offset ${result.offset.toFixed(2)} inside ${result.section.id}`);
  },
};
