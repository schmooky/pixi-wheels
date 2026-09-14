// @ts-nocheck
// Injected globals: WheelBuilder, SpinPresets, app, PIXI

// Idle on demand, one press per step: start the idle, spin from it (the idle
// resumes after the landing on its own), stop it with a ramp. The readout
// says what the next press does; `ring.idle.isActive` says whether it is on.
const wheel = new WheelBuilder()
  .radius(200, 30)
  .sections(Array.from({ length: 8 }, (_, i) => ({ id: `s${i}`, label: `${i + 1}` })))
  .speed('normal', SpinPresets.NORMAL)
  .ticker(app.ticker)
  .build();

wheel.events.on('idle:start', () => console.log('[idle] start'));
wheel.events.on('idle:stop', () => console.log('[idle] stop'));
wheel.events.on('spin:start', ({ fromIdle }) => console.log('[idle] spin from idle =', fromIdle));

const readout = new PIXI.Text({ text: '', style: { fill: 0x7b8794, fontFamily: 'Menlo, Consolas, monospace', fontSize: 15 } });
readout.anchor.set(0.5, 0);
readout.position.set(0, 218);
const stage = new PIXI.Container();
stage.addChild(wheel, readout);

const steps = ['start the idle', 'spin from the idle', 'stop the idle'];
let step = 0;
const show = () => {
  readout.text = `idle ${wheel.main.idle.isActive ? 'on ' : 'off'}    next press: ${steps[step % steps.length]}`;
};
app.ticker.add(show);

return {
  wheel,
  stage,
  cleanup: () => app.ticker.remove(show),
  onSpin: async () => {
    const what = steps[step++ % steps.length];
    if (what === 'start the idle') {
      wheel.idle.start({ speed: 20, direction: 'ccw', rampMs: 1200 });
      return;
    }
    if (what === 'stop the idle') {
      wheel.idle.stop(); // ramps down over rampMs, then idle:stop
      return;
    }
    const spin = wheel.spin(); // ramps from the idle speed; spin:start says fromIdle
    await new Promise((r) => setTimeout(r, 250));
    wheel.setResult({ index: Math.floor(Math.random() * 8) });
    await spin;
  },
};
