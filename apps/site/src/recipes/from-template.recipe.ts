// @ts-nocheck
// Injected globals: WheelBuilder, WheelTemplates, SpinPresets, createTargetAdapter, app

// Templates are plain configs: load one, add the ticker, build. A template
// also records how its server answers ({ jackpot: { tier } } here), so the
// adapter comes with it. The builder gives the config back with toConfig(),
// which is what the studio saves; the console shows the round trip.
const config = WheelTemplates.jackpots();

// The jackpots template ships the cinematic profile (an eight-second stop);
// a builder call after fromConfig() overrides any of it. NORMAL keeps the demo brisk.
const builder = WheelBuilder.fromConfig(config).speed('normal', SpinPresets.NORMAL);
const wheel = builder.ticker(app.ticker).build();
console.log('[config]', JSON.stringify(builder.toConfig(), null, 2));

const toTarget = createTargetAdapter(config.adapter);

return {
  wheel,
  onSpin: async () => {
    const spin = wheel.spin();
    await new Promise((r) => setTimeout(r, 300));
    const response = { jackpot: { tier: ['mini', 'minor', 'major', 'grand'][Math.floor(Math.random() * 4)] } };
    wheel.setResult(toTarget(response));
    await spin;
  },
};
