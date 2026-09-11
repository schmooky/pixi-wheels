// @ts-nocheck
// Injected globals: WheelBuilder, SpinPresets, app, PIXI

// The contact, slowed down. Eight sections, eight fat pegs and one long
// tongue on a wheel that idles at 24 deg/s, so every stage is visible: the
// peg touches the tip, pushes it aside as it climbs, carries it flat over
// the crown, lets go, and the spring rings it back. The readout is the
// pointer's own state - `deflection` and `engagedPeg` are public.
const wheel = new WheelBuilder()
  .radius(200, 40)
  .sections(Array.from({ length: 8 }, (_, i) => ({ id: `s${i}`, label: `${i + 1}` })))
  .pegs({ size: 11, inset: 16 })
  .pointer({
    angle: -90,
    tipInset: 22,
    skin: { type: 'graphics', shape: 'tongue', color: 0xfff2cc, length: 84, width: 34 },
    flap: { elasticity: 1.1, friction: 0.45, stiffness: 260, damping: 9, maxAngle: 34, tipWidth: 18 },
  })
  .skin({ type: 'graphics', dividers: { width: 3 }, pegs: { color: 0xfff2cc, rimColor: 0x6b4a06 } })
  .idle({ speed: 24, autoStart: true })
  .speed('normal', SpinPresets.NORMAL)
  .ticker(app.ticker)
  .build();

const tongue = wheel.main.pointers[0];
const readout = new PIXI.Text({
  text: '',
  style: { fill: 0x9fb0c3, fontFamily: 'Menlo, Consolas, monospace', fontSize: 13, align: 'center' },
});
readout.anchor.set(0.5, 0);
readout.position.set(0, 214);

const stage = new PIXI.Container();
stage.addChild(wheel, readout);

const show = () => {
  const on = tongue.engagedPeg;
  readout.text = `deflection ${tongue.deflection.toFixed(1).padStart(5)} deg    ${on === null ? 'between pegs' : `riding peg ${on}`}`;
};
app.ticker.add(show);

// One tick per divider, whatever the speed. This is the ratchet hook.
let pegs = 0;
wheel.events.on('pointer:tick', ({ speed }) => {
  if (++pegs % 4 === 0) console.log(`[tongue] ${pegs} pegs, ${Math.round(speed)} deg/s`);
});

return {
  wheel,
  stage,
  cleanup: () => app.ticker.remove(show),
  onSpin: async () => {
    const spin = wheel.spin();
    await new Promise((r) => setTimeout(r, 200));
    wheel.setResult({ index: Math.floor(Math.random() * 8) });
    await spin;
  },
};
