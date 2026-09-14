// @ts-nocheck
// Injected globals: WheelBuilder, SpinPresets, DebugRingSkin, app, PIXI

// Where inside the section the pointer ends up. Each spin cycles the mode:
// center (the middle), random (anywhere, away from the edges), exact (the
// offset the server sent: here 0.9, right by the edge), and angle (a backend
// that sends degrees instead of a section: `{ angle }` is wheel-local, and
// the result reports which section that turned out to be).
const wheel = new WheelBuilder()
  .radius(200, 30)
  .sections(Array.from({ length: 8 }, (_, i) => ({ id: `s${i}`, label: `${i}`, value: i })))
  .skin(new DebugRingSkin())
  .speed('normal', SpinPresets.TURBO)
  .ticker(app.ticker)
  .build();

const readout = new PIXI.Text({ text: '', style: { fill: 0x7b8794, fontFamily: 'Menlo, Consolas, monospace', fontSize: 15 } });
readout.anchor.set(0.5, 0);
readout.position.set(0, 218);
const stage = new PIXI.Container();
stage.addChild(wheel, readout);

const modes = ['center', 'random', 'exact', 'angle'];
let i = 0;

return {
  wheel,
  stage,
  onSpin: async () => {
    const mode = modes[i++ % modes.length];
    readout.text = `${mode}: spinning...`;
    const spin = wheel.spin();
    await new Promise((r) => setTimeout(r, 200));
    if (mode === 'angle') {
      const angle = Math.round(Math.random() * 360);
      wheel.setResult({ angle });
      const r = await spin;
      readout.text = `angle ${angle} -> ${r.section.id}, offset ${r.offset.toFixed(2)}`;
      return;
    }
    wheel.setResult(mode === 'exact' ? { index: 3, offset: 0.9 } : { index: 3 }, { mode });
    const r = await spin;
    readout.text = `${mode}: offset ${r.offset.toFixed(2)} inside ${r.section.id}`;
  },
};
