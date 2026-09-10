// @ts-nocheck
// Injected globals: WheelBuilder, SpinPresets, app, PIXI

// A small wheel parked beside a reel panel, idling so the player knows it is
// there. When the feature fires (the spin button here), it scales up over
// the panel, spins from its idle speed, lands, and shrinks back to its seat.
const wheel = new WheelBuilder()
  .radius(120, 18)
  .sections([
    { id: 'x2', label: 'x2', value: 2, weight: 3 },
    { id: 'x3', label: 'x3', value: 3, weight: 2 },
    { id: 'x5', label: 'x5', value: 5, weight: 1.5 },
    { id: 'x10', label: 'x10', value: 10, weight: 0.8, style: { fill: 0xf1c40f, labelColor: 0x2b1d00 } },
    { id: 'x2b', label: 'x2', value: 2, weight: 3 },
    { id: 'x3b', label: 'x3', value: 3, weight: 2 },
  ])
  .skin({ type: 'graphics', rim: { width: 5 }, hub: { radius: 18 } })
  .idle({ speed: 14, autoStart: true, rampMs: 800 })
  .speed('normal', SpinPresets.NORMAL)
  .ticker(app.ticker)
  .build();

// A stand-in reel panel so the layout reads.
const stage = new PIXI.Container();
const panel = new PIXI.Graphics().roundRect(0, 0, 520, 320, 16).fill({ color: 0x14161c }).stroke({ color: 0x3a3f4b, width: 3 });
for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) {
  panel.roundRect(24 + r * 96, 24 + c * 92, 80, 76, 10).fill({ color: 0x232733 });
}
stage.addChild(panel, wheel);
const SEAT = { x: 520 + 150, y: 160, scale: 1 };
const STAGE_POS = { x: 260, y: 160, scale: 1.25 };
wheel.position.set(SEAT.x, SEAT.y);

function tween(target, to, ms) {
  return new Promise((resolve) => {
    const from = { x: target.x, y: target.y, s: target.scale.x };
    let t = 0;
    const step = (ticker) => {
      t = Math.min(1, t + ticker.deltaMS / ms);
      const k = 1 - Math.pow(1 - t, 3);
      target.position.set(from.x + (to.x - from.x) * k, from.y + (to.y - from.y) * k);
      target.scale.set(from.s + (to.scale - from.s) * k);
      if (t >= 1) { app.ticker.remove(step); resolve(); }
    };
    app.ticker.add(step);
  });
}

return {
  wheel,
  stage,
  onSpin: async () => {
    await tween(wheel, STAGE_POS, 600);
    const spin = wheel.spin();                 // ramps from the idle speed
    await new Promise((r) => setTimeout(r, 400));
    // Bait with the section next to the target: a tease needs a neighbour, and never the target itself.
    const ids = wheel.sections.map((s) => s.id);
    const i = Math.floor(Math.random() * ids.length);
    wheel.setResult({ section: ids[i] }, { anticipation: { bait: ids[(i + 1) % ids.length] } });
    await spin;
    await new Promise((r) => setTimeout(r, 900)); // present the win
    await tween(wheel, SEAT, 600);             // idle resumes on its own
  },
};
