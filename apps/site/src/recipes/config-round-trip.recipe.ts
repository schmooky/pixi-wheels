// @ts-nocheck
// Injected globals: WheelBuilder, SpinPresets, app

// Build with the fluent API, export the config, rebuild from it. The JSON is
// what the studio saves and what a game can ship next to its assets; the
// console shows it.
const built = new WheelBuilder()
  .name('round trip')
  .radius(230, 30)
  .sections([
    { id: 'x2', label: 'x2', value: 2, weight: 2 },
    { id: 'x5', label: 'x5', value: 5 },
    { id: 'x20', label: 'x20', value: 20, weight: 0.5, style: { fill: 0xf1c40f, labelColor: 0x2b1d00 } },
  ])
  .pointer({ angle: -90, skin: { type: 'graphics', shape: 'triangle', color: 0xffd166 } })
  .skin({ type: 'graphics', bulbs: { count: 18 } })
  .landing({ mode: 'random', settle: 'center' })
  .speed('normal', SpinPresets.NORMAL)
  .adapter({ by: 'value', path: 'bonus.multiplier' });

const config = built.toConfig();
console.log('[config]', JSON.stringify(config, null, 2));

const wheel = WheelBuilder.fromConfig(config).ticker(app.ticker).build();

return { wheel };
