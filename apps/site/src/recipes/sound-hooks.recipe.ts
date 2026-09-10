// @ts-nocheck
// Injected globals: WheelBuilder, SpinPresets, app

// Every audio cue a wheel needs, as event listeners. Replace console.log
// with your audio layer; nothing else changes. The tick pitch and volume
// follow the ring speed, which is how a ratchet sounds real.
const wheel = new WheelBuilder()
  .radius(230, 30)
  .sections([
    { id: 'x2', label: 'x2', value: 2, weight: 3 },
    { id: 'jackpot', label: 'JACKPOT', weight: 0.8, style: { fill: 0xf1c40f, labelColor: 0x2b1d00 } },
    { id: 'x5', label: 'x5', value: 5, weight: 2 },
    { id: 'x3', label: 'x3', value: 3, weight: 2.5 },
    { id: 'x10', label: 'x10', value: 10, weight: 1 },
    { id: 'x8', label: 'x8', value: 8, weight: 1.2 },
  ])
  .speed('normal', SpinPresets.NORMAL)
  .ticker(app.ticker)
  .build();

const audio = {
  play: (name, opts = {}) => console.log(`[audio] play ${name}`, opts),
  stop: (name) => console.log(`[audio] stop ${name}`),
};

const e = wheel.events;
e.on('spin:start', () => { audio.play('wheel_windup'); audio.play('wheel_loop', { loop: true }); });
e.on('spin:cruise', () => audio.play('wheel_cruise_whoosh'));
e.on('spin:stopping', ({ duration }) => audio.play('wheel_slowdown', { duration }));
e.on('pointer:tick', ({ speed }) => audio.play('tick', { volume: Math.min(1, speed / 700), rate: 0.9 + Math.min(0.6, speed / 1500) }));
e.on('anticipation:start', () => audio.play('tension_riser'));
e.on('anticipation:bait', () => audio.play('heartbeat'));
e.on('anticipation:end', () => audio.stop('tension_riser'));
e.on('spin:landing', ({ section }) => { audio.stop('wheel_loop'); audio.play(section.id === 'jackpot' ? 'win_jackpot' : 'win_sector'); });
e.on('spin:settle:start', () => audio.play('settle_click'));
e.on('skip:requested', () => audio.play('skip_swish'));
e.on('spin:complete', () => audio.play('present_prize'));

return {
  wheel,
  onSpin: async () => {
    const spin = wheel.spin();
    await new Promise((r) => setTimeout(r, 300));
    wheel.setResult({ section: 'x2' }, { anticipation: { bait: 'jackpot' } });
    await spin;
  },
};
