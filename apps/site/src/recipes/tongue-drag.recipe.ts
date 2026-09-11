// @ts-nocheck
// Injected globals: WheelBuilder, SpinPresets, app, PIXI

// The same spin, the same result, twice - the left tongue is weightless, the
// right one has `drag: 1`. While a peg climbs the tip, a dragging tongue
// holds the ring back by up to one contact width of arc; over the crown the
// peg wins and the ring snaps forward at `dragRelease`. Fast, that is a
// shimmer. Slow, the wheel visibly fights its way to a stop.
//
// The hold is drawn, never planned: `rotationDeg`, the ticks and the landing
// never see it, and it relaxes to zero at rest, so both wheels stop on the
// same section on the same frame.
const make = (drag, label) => {
  const wheel = new WheelBuilder()
    .radius(150, 26)
    .sections(Array.from({ length: 10 }, (_, i) => ({ id: `s${i}`, label: `${i + 1}` })))
    .pegs({ size: 8 })
    .pointer({
      angle: -90,
      skin: { type: 'graphics', shape: 'tongue', color: 0xfff2cc, length: 64, width: 30 },
      flap: { elasticity: 1.2, friction: 0.5, stiffness: 300, damping: 9, drag, dragRelease: 18 },
    })
    .skin({ type: 'graphics', dividers: { width: 2 }, pegs: true })
    .speed('slow', { ...SpinPresets.CINEMATIC, stopDuration: 5200, minTurns: 1, maxTurns: 3 })
    .ticker(app.ticker)
    .build();
  const caption = new PIXI.Text({
    text: label,
    style: { fill: 0x9fb0c3, fontFamily: 'Menlo, Consolas, monospace', fontSize: 13 },
  });
  caption.anchor.set(0.5, 0);
  caption.position.set(0, 176);
  const group = new PIXI.Container();
  group.addChild(wheel, caption);
  return { wheel, group, caption, label };
};

const loose = make(0, 'drag: 0');
const heavy = make(1, 'drag: 1');
loose.group.x = -175;
heavy.group.x = 175;

const stage = new PIXI.Container();
stage.addChild(loose.group, heavy.group);

const held = () => {
  heavy.caption.text = `drag: 1   holding ${heavy.wheel.main.dragDeg.toFixed(2)} deg`;
};
app.ticker.add(held);

return {
  wheel: heavy.wheel,
  stage,
  cleanup: () => {
    app.ticker.remove(held);
    loose.wheel.destroy();
  },
  onSpin: async () => {
    const index = Math.floor(Math.random() * 10);
    const spins = [loose.wheel.spin(), heavy.wheel.spin()];
    await new Promise((r) => setTimeout(r, 200));
    loose.wheel.setResult({ index });
    heavy.wheel.setResult({ index });
    const [a, b] = await Promise.all(spins);
    console.log(`[drag] both landed on ${a.section.id} / ${b.section.id}`);
  },
  onSkip: () => {
    for (const w of [loose.wheel, heavy.wheel]) {
      try {
        w.skip();
      } catch {
        w.requestSkip();
      }
    }
  },
};
