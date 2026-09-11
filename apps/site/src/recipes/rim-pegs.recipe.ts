// @ts-nocheck
// Injected globals: WheelBuilder, SpinPresets, app, PIXI

// Pegs on the rim, the carnival arrangement: studs right at the edge and a
// long flapper lying across them, tip well inside the ring. Nothing about
// the contact changes - the blade still may not touch a peg - but the way
// out is different. A peg deep under the tip cannot slip past sideways, so
// the blade has to ride up and lift its tip clear over the peg entirely.
// That is a big swing, and `maxAngle` has to allow it: this geometry asks
// for about 48 degrees, past the default 45. Set the cap too low and
// the engine says so, with the number it needs.
const wheel = new WheelBuilder()
  .radius(215, 34)
  .sections(Array.from({ length: 24 }, (_, i) => ({ id: `s${i}`, label: `${i + 1}` })))
  // Centres 4 px inside a 215 px rim, so the studs sit on the edge.
  .pegs({ size: 11, inset: 4 })
  .pointer({
    angle: -90,
    tipInset: 50, // the tip hangs well below the pegs, between them
    skin: { type: 'graphics', shape: 'tongue', color: 0xfff2cc, length: 84, width: 30, pinRadius: 8 },
    flap: { maxAngle: 70, stiffness: 240, damping: 9, friction: 0.3, tipWidth: 12 },
  })
  .skin({ type: 'graphics', dividers: { width: 2 }, pegs: { color: 0xfff2cc, rimColor: 0x6b4a06 }, bulbs: false })
  .speed('normal', { ...SpinPresets.NORMAL, stopDuration: 6000, maxTurns: 6 })
  .ticker(app.ticker)
  .build();

const tongue = wheel.main.pointers[0];
const readout = new PIXI.Text({
  text: '',
  style: { fill: 0x9fb0c3, fontFamily: 'Menlo, Consolas, monospace', fontSize: 13 },
});
readout.anchor.set(0.5, 0);
readout.position.set(0, 224);

const stage = new PIXI.Container();
stage.addChild(wheel, readout);

let peak = 0;
const show = () => {
  peak = Math.max(peak, Math.abs(tongue.deflection));
  readout.text = `lift ${Math.abs(tongue.deflection).toFixed(1).padStart(4)} deg    most so far ${peak.toFixed(1)}`;
};
app.ticker.add(show);

return {
  wheel,
  stage,
  cleanup: () => app.ticker.remove(show),
  onSpin: async () => {
    peak = 0;
    const spin = wheel.spin();
    await new Promise((r) => setTimeout(r, 250));
    wheel.setResult({ index: Math.floor(Math.random() * 24) });
    await spin;
  },
};
