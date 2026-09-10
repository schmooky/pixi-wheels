// @ts-nocheck
// Injected globals: WheelBuilder, SpinPresets, fitText, labelSlot, app, PIXI

// Labels are not just strings. A section's `content` is any container: a
// Text, a Sprite, a BitmapText, a Spine instance, a group of them. The label
// layer places it at the label radius, rotates it like a text label, and fits
// it into the room the section has, so a heavy jackpot wedge and a slim x2
// wedge each get content sized for them. The factory receives the slot and a
// bound `fit()`; `fitText` shrinks a font size instead of a transform when
// crispness matters.
const GOLD = 0xffd23f;

// A pill background sized from the slot, with a text fitted inside it.
const pill = (label, color) => (ctx) => {
  const view = new PIXI.Container();
  const w = ctx.slot.width * 0.92;
  const h = ctx.slot.height * 0.7;
  view.addChild(new PIXI.Graphics().roundRect(-w / 2, -h / 2, w, h, h / 2).fill({ color, alpha: 0.9 }));
  const text = new PIXI.Text({ text: label, style: { fontFamily: 'Roboto Condensed, Arial Narrow, sans-serif', fontSize: 40, fontWeight: '800', fill: 0x14151a } });
  text.anchor.set(0.5);
  fitText(text, { width: w * 0.82, height: h * 0.8 });
  view.addChild(text);
  return view;
};

// An icon plus a value, stacked. `ctx.fit` does the final scale.
const coin = (value) => (ctx) => {
  const view = new PIXI.Container();
  const icon = new PIXI.Graphics().circle(0, 0, 26).fill(GOLD).circle(0, 0, 18).stroke({ color: 0xb8860b, width: 4 });
  icon.position.set(0, -34);
  const text = new PIXI.Text({ text: `x${value}`, style: { fontFamily: 'Roboto Condensed, Arial Narrow, sans-serif', fontSize: 44, fontWeight: '900', fill: GOLD, stroke: { color: 0x3a2200, width: 5 } } });
  text.anchor.set(0.5);
  text.position.set(0, 26);
  view.addChild(icon, text);
  ctx.fit(view, { padding: 0.08 });
  return view;
};

// A container that keeps animating after it is placed: the layer never touches its children.
const star = () => (ctx) => {
  const view = new PIXI.Container();
  const g = new PIXI.Graphics().star(0, 0, 5, 40, 18).fill(0xffffff).stroke({ color: GOLD, width: 4 });
  view.addChild(g);
  app.ticker.add(() => { g.rotation += 0.02; });
  ctx.fit(view);
  return view;
};

const wheel = new WheelBuilder()
  .radius(240, 40)
  .sections([
    { id: 'jackpot', weight: 2, content: pill('JACKPOT', GOLD), style: { fill: 0x7a1f1f, labelOrientation: 'tangential', labelRadius: 0.62 } },
    { id: 'x2', value: 2, weight: 1, content: coin(2), style: { labelOrientation: 'radial' } },
    { id: 'bonus', weight: 1.4, content: star(), style: { fill: 0x1f3d7a, labelOrientation: 'upright' } },
    { id: 'x5', value: 5, weight: 0.7, content: coin(5), style: { labelOrientation: 'radial' } },
    { id: 'free', weight: 1.6, content: pill('FREE SPINS', 0x8ee3a1), style: { fill: 0x1f6b3a, labelOrientation: 'tangential-in', labelRadius: 0.72 } },
    { id: 'x10', value: 10, weight: 0.5, content: coin(10), style: { labelOrientation: 'radial' } },
    { id: 'plain', label: 'TEXT', weight: 1 },
  ])
  .landing({ mode: 'random', margin: 0.15 })
  .speed('normal', SpinPresets.NORMAL)
  .ticker(app.ticker)
  .build();

// The slot is also available outside the label layer, for your own placement.
console.log('jackpot slot', labelSlot(wheel.sections[0], 240, 40, { radius: 0.62, orientation: 'tangential' }));

return { wheel };
