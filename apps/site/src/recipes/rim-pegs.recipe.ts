// @ts-nocheck
// Injected globals: WheelBuilder, SpinPresets, app, PIXI

// Pegs on the rim, the carnival arrangement: studs right at the edge and a
// short flapper flicking over them. Nothing about the contact changes - the
// blade still may not touch a peg - but the way out does. A peg under the
// tip cannot slip past it sideways, so the blade rides up until its tip
// lifts clear over the peg, and the shorter the arm the further it has to
// swing to do it. Hence the look: a small flapper that flies. This one asks
// for about 48 degrees, past the default cap of 45, and the engine says so
// with the number it needs when the cap is too low.
const wheel = new WheelBuilder()
  .radius(215, 34)
  .sections(Array.from({ length: 24 }, (_, i) => ({ id: `s${i}`, label: `${i + 1}` })))
  // Centres 5 px inside a 215 px rim, so the studs sit on the edge.
  .pegs({ size: 9, inset: 5 })
  .pointer({
    angle: -90,
    tipInset: 17, // the tip dips a few px past the studs, between them
    skin: { type: 'graphics', shape: 'tongue', color: 0xfff2cc, length: 50, width: 22, pinRadius: 7 },
    flap: { maxAngle: 62, stiffness: 240, damping: 9, friction: 0.25, tipWidth: 9 },
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
