// @ts-nocheck
// Injected globals: WheelBuilder, SpinPresets, createTargetAdapter, app

// Three shapes of server response, one adapter each. An adapter is a small
// serialisable config (`by` + dotted `path`), so the studio can export it
// next to the wheel and the game never hand-parses the payload.
const wheel = new WheelBuilder()
  .radius(230, 30)
  .sections([
    { id: 'x2a', label: 'x2', value: 2 },
    { id: 'x5', label: 'x5', value: 5 },
    { id: 'x2b', label: 'x2', value: 2 },
    { id: 'x10', label: 'x10', value: 10 },
    { id: 'x3', label: 'x3', value: 3 },
    { id: 'x2c', label: 'x2', value: 2 },
  ])
  .speed('normal', SpinPresets.TURBO)
  .ticker(app.ticker)
  .build();

const byIndex = createTargetAdapter({ by: 'index', path: 'bonus.wheel.sector', indexBase: 1 });   // 1-based on this backend
const byValue = createTargetAdapter({ by: 'value', path: 'bonus.multiplier', pick: 'random' });   // three x2 wedges: any of them
const byAngle = createTargetAdapter({ by: 'angle', path: 'bonus.wheel.stopDegrees' });

const responses = [
  { name: 'index', body: { bonus: { wheel: { sector: 4 } } }, adapter: byIndex },
  { name: 'value', body: { bonus: { multiplier: 2 } }, adapter: byValue },
  { name: 'angle', body: { bonus: { wheel: { stopDegrees: 200 } } }, adapter: byAngle },
];
let i = 0;

return {
  wheel,
  onSpin: async () => {
    const r = responses[i++ % responses.length];
    const spin = wheel.spin();
    await new Promise((res) => setTimeout(res, 250));
    const target = r.adapter(r.body);
    console.log(`[adapter] ${r.name} ->`, JSON.stringify(target));
    wheel.setResult(target);
    const result = await spin;
    console.log(`[adapter] landed ${result.section.id}`);
  },
};
