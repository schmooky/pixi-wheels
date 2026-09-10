// @ts-nocheck
// Injected globals: WheelBuilder, SpinPresets, app

// No step list: the server sends a "wheel state" with every round and the
// client sets the weights directly. Here the state is faked as a random
// share for the bonus sector; the transition is animated by setWeights.
const wheel = new WheelBuilder()
  .radius(240, 30)
  .sections([
    { id: 'cash', label: 'CASH', weight: 4, style: { fill: 0x1e9e5a } },
    { id: 'bonus', label: 'BONUS', weight: 1, style: { fill: 0x8e44ad } },
    { id: 'lose', label: 'LOSE', weight: 4, style: { fill: 0x2f3542 } },
    { id: 'cash2', label: 'CASH', weight: 4, style: { fill: 0x1e9e5a } },
  ])
  .speed('normal', SpinPresets.QUICK)
  .ticker(app.ticker)
  .build();

function applyServerState(state) {
  // state.bonusShare is 0..1 of the rim; everything else shares the rest.
  const rest = (1 - state.bonusShare) / 3;
  return wheel.setWeights({ bonus: state.bonusShare, cash: rest, lose: rest, cash2: rest }, { durationMs: 800, ease: 'power2.inOut' });
}

return {
  wheel,
  onSpin: async () => {
    await applyServerState({ bonusShare: 0.05 + Math.random() * 0.4 });
    const spin = wheel.spin();
    await new Promise((r) => setTimeout(r, 200));
    wheel.setResult({ index: Math.floor(Math.random() * 4) });
    await spin;
  },
};
