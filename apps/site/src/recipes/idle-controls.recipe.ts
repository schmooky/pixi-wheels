// @ts-nocheck
// Injected globals: WheelBuilder, SpinPresets, app

// Idle on demand. The wheel starts still; the first press starts the idle,
// the second spins (from the idle speed) and the idle resumes after the
// landing. idle.stop() ramps down instead of snapping.
const wheel = new WheelBuilder()
  .radius(220, 30)
  .sections(Array.from({ length: 8 }, (_, i) => ({ id: `s${i}`, label: `${i + 1}` })))
  .speed('normal', SpinPresets.NORMAL)
  .ticker(app.ticker)
  .build();

wheel.events.on('idle:start', () => console.log('[idle] start'));
wheel.events.on('idle:stop', () => console.log('[idle] stop'));
wheel.events.on('spin:start', ({ fromIdle }) => console.log('[idle] spin from idle =', fromIdle));

let armed = false;
return {
  wheel,
  onSpin: async () => {
    if (!armed) {
      wheel.idle.start({ speed: 20, direction: 'ccw', rampMs: 1200 });
      armed = true;
      return;
    }
    const spin = wheel.spin();
    await new Promise((r) => setTimeout(r, 250));
    wheel.setResult({ index: Math.floor(Math.random() * 8) });
    await spin;
  },
};
