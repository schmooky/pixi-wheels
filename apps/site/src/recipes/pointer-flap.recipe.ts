// @ts-nocheck
// Injected globals: WheelBuilder, SpinPresets, app

// Three pointers on one ring: a stiff tongue at the top, a loose needle at
// four o'clock, and a rigid triangle at eight. Every divider that passes
// under any of them fires pointer:tick with the speed, which is the hook
// for the ratchet click; the console shows the first pointer's ticks.
const wheel = new WheelBuilder()
  .radius(230, 30)
  .sections(Array.from({ length: 16 }, (_, i) => ({ id: `s${i}`, label: '' })))
  .pointer({ id: 'top', angle: -90, flap: { maxAngle: 24, stiffness: 520, damping: 14, kick: 1000 } })
  .pointer({ id: 'loose', angle: 30, skin: { type: 'graphics', shape: 'needle', color: 0xffd166, length: 90, width: 26 }, flap: { maxAngle: 35, stiffness: 160, damping: 8, kick: 700 } })
  .pointer({ id: 'rigid', angle: 150, skin: { type: 'graphics', shape: 'triangle', color: 0x64d2ff, length: 60, width: 34 }, flap: false })
  .skin({ type: 'graphics', dividers: { width: 3 }, bulbs: { count: 16 } })
  .speed('normal', SpinPresets.NORMAL)
  .ticker(app.ticker)
  .build();

let ticks = 0;
wheel.events.on('pointer:tick', ({ pointer, speed }) => {
  if (pointer === 'top' && ++ticks % 8 === 0) console.log(`[tick] ${ticks} dividers, ${Math.round(speed)} deg/s`);
});

return { wheel };
