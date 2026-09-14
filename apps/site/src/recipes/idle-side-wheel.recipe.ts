// @ts-nocheck
// Injected globals: WheelBuilder, SpinPresets, app, PIXI

// A bonus wheel parked behind the reel panel with about a third of it peeking
// out on the right, idling so the player knows it is there. When the feature
// fires (the spin button here) it slides out until half of it shows, spins
// from its idle speed, lands on the tongue at three o'clock, and slides back
// under the reels. Idle resumes on its own.
const R = 150;
const wheel = new WheelBuilder()
  .radius(R, 22)
  .sections([
    { id: 'x2', label: 'x2', value: 2, weight: 3 },
    { id: 'x3', label: 'x3', value: 3, weight: 2 },
    { id: 'x5', label: 'x5', value: 5, weight: 1.5 },
    { id: 'x10', label: 'x10', value: 10, weight: 0.8, style: { fill: 0xf1c40f, labelColor: 0x2b1d00 } },
    { id: 'x2b', label: 'x2', value: 2, weight: 3 },
    { id: 'x3b', label: 'x3', value: 3, weight: 2 },
  ])
  // Three o'clock: the one edge of the wheel that is never under the panel.
  .pointer({ angle: 0, skin: { type: 'graphics', shape: 'tongue', length: 52, width: 26 } })
  .skin({ type: 'graphics', rim: { width: 6 }, hub: { radius: 22 }, bulbs: { count: 24 } })
  .idle({ speed: 14, autoStart: true, rampMs: 800 })
  .speed('normal', SpinPresets.NORMAL)
  .ticker(app.ticker)
  .build();

// A stand-in reel panel. The wheel goes under it, so it is added first.
const PANEL = { w: 520, h: 320 };
const panel = new PIXI.Graphics().roundRect(0, 0, PANEL.w, PANEL.h, 16).fill({ color: 0x14161c }).stroke({ color: 0x3a3f4b, width: 3 });
for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) {
  panel.roundRect(24 + r * 96, 24 + c * 92, 80, 76, 10).fill({ color: 0x232733 });
}
// An invisible rectangle the size of both positions plus a margin on the
// right, so the runner fits the stage once, the wheel never slides past the
// canvas edge, and the tongue stays clear of the frame's spin button.
const room = new PIXI.Graphics().rect(0, 0, PANEL.w + R + 110, PANEL.h).fill({ color: 0x000000, alpha: 0 });
const stage = new PIXI.Container();
stage.addChild(room, wheel, panel);

const SEAT = PANEL.w - R + 0.6 * R; // 30% of the wheel shows past the panel's edge
const OUT = PANEL.w;                // the centre on the edge: half the wheel shows
wheel.position.set(SEAT, PANEL.h / 2);

function slide(target, x, ms) {
  return new Promise((resolve) => {
    const from = target.x;
    let t = 0;
    const step = (ticker) => {
      t = Math.min(1, t + ticker.deltaMS / ms);
      const k = 1 - Math.pow(1 - t, 3);
      target.x = from + (x - from) * k;
      if (t >= 1) { app.ticker.remove(step); resolve(); }
    };
    app.ticker.add(step);
  });
}

return {
  wheel,
  stage,
  onSpin: async () => {
    await slide(wheel, OUT, 500);
    const spin = wheel.spin();                 // ramps from the idle speed
    await new Promise((r) => setTimeout(r, 400));
    // Bait with the section next to the target: a tease needs a neighbour, and never the target itself.
    const ids = wheel.sections.map((s) => s.id);
    const i = Math.floor(Math.random() * ids.length);
    wheel.setResult({ section: ids[i] }, { anticipation: { bait: ids[(i + 1) % ids.length] } });
    await spin;
    await new Promise((r) => setTimeout(r, 900)); // present the win
    await slide(wheel, SEAT, 500);             // idle resumes on its own
  },
};
