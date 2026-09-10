// @ts-nocheck
// Injected globals: WheelBuilder, SpinPresets, app, mockWheelServer

// Eight multipliers. Two of them are thin: the big wins take less of the rim.
const wheel = new WheelBuilder()
  .radius(240, 34)
  .sections([
    { id: 'x2a', label: 'x2', value: 2, weight: 3 },
    { id: 'x5a', label: 'x5', value: 5, weight: 2 },
    { id: 'x3a', label: 'x3', value: 3, weight: 2.5 },
    { id: 'x10', label: 'x10', value: 10, weight: 1 },
    { id: 'x2b', label: 'x2', value: 2, weight: 3 },
    { id: 'x8', label: 'x8', value: 8, weight: 1.2 },
    { id: 'x3b', label: 'x3', value: 3, weight: 2.5 },
    { id: 'x50', label: 'x50', value: 50, weight: 0.5, style: { fill: 0xf1c40f, labelColor: 0x2b1d00 } },
  ])
  .speed('normal', SpinPresets.NORMAL)
  .ticker(app.ticker)
  .build();

// A stand-in for the game server: it picks by odds, not by arc.
const server = mockWheelServer(wheel, { odds: { x50: 0.2, x10: 0.6 } });

return {
  wheel,
  onSpin: async () => {
    const spin = wheel.spin();                 // wind up, cruise...
    const response = await server.spin();      // ...while the server decides
    wheel.setResult({ value: response.value }); // any section carrying that value
    await spin;
  },
};
