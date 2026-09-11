// @ts-nocheck
// Injected globals: WheelBuilder, SpinPresets, createEngine, app

// The ratchet. `pointer:tick` fires once per peg, in order, however fast the
// ring turns - at 900 deg/s on a 24-peg wheel that is 60 clicks a second, far
// more than any mix wants. So: rate-gate the voices, ride pitch and volume on
// the speed, and swap the sample for the last few clicks before the stop, the
// trick that makes a wheel sound like it is running out of energy.
// Sounds are the Super Wheel's own (Playson, used with permission).
const wheel = new WheelBuilder()
  .radius(210, 30)
  .sections(Array.from({ length: 24 }, (_, i) => ({ id: `s${i}`, label: `${i + 1}` })))
  .pegs({ size: 6 })
  .pointer({
    angle: -90,
    skin: { type: 'graphics', shape: 'tongue', color: 0xfff2cc, length: 66, width: 28 },
    flap: { elasticity: 1.1, friction: 0.4, stiffness: 340, damping: 11, drag: 0.7 },
  })
  .skin({ type: 'graphics', dividers: { width: 2 }, pegs: true })
  .speed('normal', SpinPresets.NORMAL)
  .ticker(app.ticker)
  .build();

const engine = createEngine({ buses: { sfx: { level: 1 } }, master: { headroom: -3 } });
const base = '/playson-wheel/audio/';
await Promise.all([
  engine.loadSound('click', base + 'click.mp3'),
  engine.loadSound('clack', base + 'tick.mp3'),
  engine.loadSound('landing', base + 'landing.mp3'),
]);

// A click every 45 ms at most: past that the ear hears a buzz, not a ratchet.
const MIN_GAP_MS = 45;
let lastAt = -1e9;
let ticks = 0;

wheel.events.on('spin:start', () => {
  ticks = 0;
});

wheel.events.on('pointer:tick', ({ speed }) => {
  ticks++;
  const now = performance.now();
  if (now - lastAt < MIN_GAP_MS) return;
  lastAt = now;
  // Under 120 deg/s the wheel is dying: heavier sample, lower, louder.
  const slow = speed < 120;
  engine.sound(slow ? 'clack' : 'click').play({
    volume: slow ? 0.9 : Math.min(0.85, 0.2 + speed / 1100),
    pitch: { base: slow ? 0.82 : 0.92 + Math.min(0.5, speed / 1500), jitter: 0.05 },
  });
});

wheel.events.on('spin:landing', () => {
  engine.sound('landing').play({ volume: 0.8 });
  console.log(`[ratchet] ${ticks} pegs went under the tongue`);
});
wheel.events.on('destroyed', () => engine.close());

return {
  wheel,
  onSpin: async () => {
    await engine.unlock(); // the browser wants a gesture before any sound
    const spin = wheel.spin();
    await new Promise((r) => setTimeout(r, 250));
    wheel.setResult({ index: Math.floor(Math.random() * 24) });
    await spin;
  },
};
