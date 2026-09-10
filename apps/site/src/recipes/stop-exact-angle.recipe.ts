// @ts-nocheck
// Injected globals: WheelBuilder, SpinPresets, DebugRingSkin, app

// Some backends send the final angle, not a section. `{ angle }` is
// wheel-local degrees; the engine reports which section that is.
const wheel = new WheelBuilder()
  .radius(220, 30)
  .startAngle(0)
  .sections(Array.from({ length: 12 }, (_, i) => ({ id: `s${i}`, label: `${i * 30}`, value: i })))
  .skin(new DebugRingSkin())
  .speed('normal', SpinPresets.TURBO)
  .ticker(app.ticker)
  .build();

return {
  wheel,
  onSpin: async () => {
    const spin = wheel.spin();
    await new Promise((r) => setTimeout(r, 200));
    const angle = Math.round(Math.random() * 360);
    wheel.setResult({ angle });
    const r = await spin;
    console.log(`[exact] asked for ${angle} deg -> ${r.section.id}, under pointer now ${wheel.main.localAngleUnderPointer().toFixed(1)}`);
  },
};
