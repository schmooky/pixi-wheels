// @ts-nocheck
// Injected globals: WheelBuilder, SpinPresets, app

// Four feels on one wheel. Each spin uses the next profile; the label under
// the pointer says which. Profiles decide wind-up, cruise speed, turn count
// and how long the stop takes.
const names = ['normal', 'turbo', 'cinematic', 'quick'];
const wheel = new WheelBuilder()
  .radius(220, 30)
  .sections(names.map((n, i) => ({ id: n, label: n.toUpperCase(), value: i })).concat([
    { id: 'a', label: '', value: 4 }, { id: 'b', label: '', value: 5 }, { id: 'c', label: '', value: 6 }, { id: 'd', label: '', value: 7 },
  ]))
  .speed('normal', SpinPresets.NORMAL)
  .speed('turbo', SpinPresets.TURBO)
  .speed('cinematic', SpinPresets.CINEMATIC)
  .speed('quick', SpinPresets.QUICK)
  .ticker(app.ticker)
  .build();

let i = 0;
return {
  wheel,
  onSpin: async () => {
    const name = names[i++ % names.length];
    wheel.setSpeed(name);
    const spin = wheel.spin();
    await new Promise((r) => setTimeout(r, 200));
    wheel.setResult({ section: name });
    const r = await spin;
    console.log(`[speed] ${name}: ${r.duration} ms, ${r.turns} turns`);
  },
};
