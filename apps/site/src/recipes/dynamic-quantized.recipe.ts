// @ts-nocheck
// Injected globals: WheelBuilder, SpinPresets, app

// Steps on a grid: the rim is thought of as 24 slots, and each dynamic
// sector owns a whole number of them. Integer weights ARE the slots, so a
// step moves a border by exactly one slot width and the borders of the
// static sectors never drift. Press spin to advance the purple sector.
const SLOTS = 24;
const wheel = new WheelBuilder()
  .radius(240, 30)
  .sections([
    { id: 'a', label: '', weight: 6, style: { fill: 0xd98fa3 } },
    { id: 'b', label: '', weight: 6, style: { fill: 0xb8b0b3 } },
    { id: 'dyn', label: 'BONUS', weight: 2, style: { fill: 0x8e44ad } },
    { id: 'c', label: '', weight: 5, style: { fill: 0xd98fa3 } },
    { id: 'd', label: '', weight: 5, style: { fill: 0xb8b0b3 } },
  ])
  .dynamic({
    // The bonus grows one slot at a time, taken from its neighbours.
    steps: [
      { dyn: 2, b: 6, c: 5 },
      { dyn: 3, b: 6, c: 4 },
      { dyn: 4, b: 5, c: 4 },
      { dyn: 5, b: 5, c: 3 },
      { dyn: 6, b: 4, c: 3 },
    ],
    durationMs: 450,
  })
  .skin({ type: 'graphics', dividers: { width: 2, color: 0xffffff, alpha: 0.35 }, shading: false, hub: { radius: 30 } })
  .speed('normal', SpinPresets.QUICK)
  .ticker(app.ticker)
  .build();

// A ring of tick marks, one per slot, so the grid is visible.
const marks = new PIXI.Graphics();
for (let i = 0; i < SLOTS; i++) {
  const a = (-90 + (360 / SLOTS) * i) * Math.PI / 180;
  marks.moveTo(Math.cos(a) * 242, Math.sin(a) * 242).lineTo(Math.cos(a) * 254, Math.sin(a) * 254);
}
marks.stroke({ color: 0xffffff, width: 2, alpha: 0.6 });
wheel.main.overlay.addChild(marks);

return {
  wheel,
  onSpin: async () => {
    await wheel.nextStep();
    const spin = wheel.spin();
    await new Promise((r) => setTimeout(r, 200));
    wheel.setResult({ index: Math.floor(Math.random() * 5) });
    await spin;
  },
};
