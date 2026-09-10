// @ts-nocheck
// Injected globals: WheelBuilder, SpinPresets, app

// The tongue is physical. It touches pegs on the rim, one per divider: a peg
// coming through pushes it aside, carries it on its crown for a moment, and
// lets go into a spring. Three tongues against the same pegs, three feels:
// a stiff short one at the top, a floppy one with lots of drag at four
// o'clock, a rigid triangle at eight. The skin draws the pegs; the Debug
// button shows each tongue's contact zone and the peg it is riding. Every
// peg under any of them fires pointer:tick with the speed, the hook for the
// ratchet click; the console shows the first tongue's ticks.
const wheel = new WheelBuilder()
  .radius(230, 30)
  .sections(Array.from({ length: 16 }, (_, i) => ({ id: `s${i}`, label: '' })))
  .pegs({ size: 7, inset: 10 })
  .pointer({ id: 'stiff', angle: -90, flap: { elasticity: 0.8, friction: 0.2, stiffness: 700, damping: 18 } })
  .pointer({
    id: 'floppy',
    angle: 30,
    skin: { type: 'graphics', shape: 'needle', color: 0xffd166, length: 90, width: 26 },
    flap: { elasticity: 1.5, friction: 0.9, stiffness: 140, damping: 5, maxAngle: 40, tipWidth: 20 },
  })
  .pointer({ id: 'rigid', angle: 150, skin: { type: 'graphics', shape: 'triangle', color: 0x64d2ff, length: 60, width: 34 }, flap: false })
  .skin({ type: 'graphics', dividers: { width: 3 }, pegs: true })
  .speed('normal', SpinPresets.NORMAL)
  .ticker(app.ticker)
  .build();

let ticks = 0;
wheel.events.on('pointer:tick', ({ pointer, speed }) => {
  if (pointer === 'stiff' && ++ticks % 8 === 0) console.log(`[tick] ${ticks} pegs, ${Math.round(speed)} deg/s`);
});

return { wheel };
