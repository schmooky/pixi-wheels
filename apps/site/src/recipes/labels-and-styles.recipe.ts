// @ts-nocheck
// Injected globals: WheelBuilder, SpinPresets, app

// Per-section styling: fills, label colours, tangential and upright labels,
// a custom font size, and a section with no label at all. Labels auto-fit
// the room their section has and re-centre when weights change.
const wheel = new WheelBuilder()
  .radius(240, 36)
  .palette([0x264653, 0x2a9d8f, 0xe9c46a, 0xf4a261, 0xe76f51])
  .sections([
    { id: 'radial', label: 'RADIAL', weight: 2 },
    { id: 'tangent', label: 'TANGENT', weight: 2, style: { labelOrientation: 'tangential', labelRadius: 0.8 } },
    { id: 'upright', label: 'UP', weight: 1.5, style: { labelOrientation: 'upright', labelSize: 34 } },
    { id: 'blank', label: '', weight: 1, style: { fill: 0x111111 } },
    { id: 'gold', label: 'x100', weight: 0.7, style: { fill: 0xf1c40f, labelColor: 0x2b1d00, labelWeight: '900', labelSize: 30 } },
    { id: 'thin', label: 'a long label that shrinks', weight: 1.2, style: { labelColor: 0xffffff } },
  ])
  .skin({ type: 'graphics', rim: { width: 10, color: 0x2b2b2b }, hub: { radius: 36, color: 0x2b2b2b, ringColor: 0xe9c46a } })
  .speed('normal', SpinPresets.TURBO)
  .ticker(app.ticker)
  .build();

return { wheel };
