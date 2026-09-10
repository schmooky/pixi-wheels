// @ts-nocheck
// Injected globals: WheelBuilder, WheelTemplates, app

// Templates are plain configs. Load one, add the ticker, build. Everything
// the studio exports has this shape too.
const config = WheelTemplates.jackpots();

const wheel = WheelBuilder.fromConfig(config).ticker(app.ticker).build();

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
