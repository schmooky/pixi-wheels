// @ts-nocheck
// Injected globals: WheelBuilder, WheelTemplates, SpinPresets, app

// Templates are plain configs. Load one, add the ticker, build. Everything
// the studio exports has this shape too.
const config = WheelTemplates.jackpots();

// The jackpots template ships the cinematic profile (an eight-second stop);
// a builder call after fromConfig() overrides any of it. NORMAL keeps the demo brisk.
const wheel = WheelBuilder.fromConfig(config).speed('normal', SpinPresets.NORMAL).ticker(app.ticker).build();

return {
  wheel,
  onSpin: async () => {
    const spin = wheel.spin();
    await new Promise((r) => setTimeout(r, 300));
    // The template records how its server answers: { jackpot: { tier } }.
    wheel.setResult({ section: ['mini', 'minor', 'major', 'grand'][Math.floor(Math.random() * 4)] });
    await spin;
  },
};
