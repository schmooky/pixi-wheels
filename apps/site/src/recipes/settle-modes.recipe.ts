// @ts-nocheck
// Injected globals: WheelBuilder, SpinPresets, app, PIXI

// What happens once the pointer is on the landing angle. Each spin cycles:
// none (stay put), center (pause, then glide to the middle of the section
// so the prize presentation is centred), bounce (overshoot a few degrees and
// spring back, a mechanical stop). The result reports the landing offset in
// every case; the settle is presentation only.
const wheel = new WheelBuilder()
  .radius(200, 30)
  .sections(Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, label: `${(i + 1) * 100}`, value: (i + 1) * 100 })))
  .landing({ mode: 'random', margin: 0.06 })
  .speed('normal', SpinPresets.NORMAL)
  .ticker(app.ticker)
  .build();

const settles = {
  none: 'none',
  center: { mode: 'center', delayMs: 350, durationMs: 700, ease: 'sine.inOut' },
  bounce: { mode: 'bounce', bounceDeg: 5, durationMs: 520, ease: 'power2.out' },
};
const names = Object.keys(settles);
let i = 0;

const readout = new PIXI.Text({ text: '', style: { fill: 0x7b8794, fontFamily: 'Menlo, Consolas, monospace', fontSize: 15 } });
readout.anchor.set(0.5, 0);
readout.position.set(0, 218);
const stage = new PIXI.Container();
stage.addChild(wheel, readout);

wheel.events.on('spin:landing', ({ section, landingAngle }) => console.log('[settle] landed', section.id, 'at', landingAngle.toFixed(1)));
wheel.events.on('spin:settle:start', ({ mode }) => console.log('[settle]', mode, '...'));
wheel.events.on('spin:settle:end', () => console.log('[settle] done'));

return {
  wheel,
  stage,
  onSpin: async () => {
    const name = names[i++ % names.length];
    readout.text = `settle: ${name}`;
    const spin = wheel.spin();
    await new Promise((r) => setTimeout(r, 200));
    wheel.setResult({ index: Math.floor(Math.random() * 6) }, { settle: settles[name] });
    const r = await spin;
    readout.text = `settle: ${name}    landed at offset ${r.offset.toFixed(2)}`;
  },
};
