// @ts-nocheck
// Injected globals: WheelBuilder, SpinPresets, createEngine, app

// Real game audio on the engine's events, through @schmooky/zvuk. The sounds
// are the Super Wheel's own (Playson, used with permission): the activation
// hit, the spin, the anticipation riser, the landing thud and one win sting
// per prize tier. The wheel emits; the audio layer listens. A skip, a slam and
// a normal stop all reach `spin:landing`, so nothing here calls a wheel method.
const wheel = new WheelBuilder()
  .radius(230, 30)
  .sections([
    { id: 'mini', label: 'MINI', weight: 1, tags: ['mini'], style: { fill: 0x2e8b57 } },
    { id: 'x2', label: 'x2', value: 2, weight: 1.4, tags: ['coin'] },
    { id: 'collect', label: 'COLLECT', weight: 1, tags: ['clover'], style: { fill: 0x1f6feb } },
    { id: 'x5', label: 'x5', value: 5, weight: 1.1, tags: ['coin'] },
    { id: 'minor', label: 'MINOR', weight: 0.9, tags: ['minor'], style: { fill: 0x9b59b6 } },
    { id: 'x3', label: 'x3', value: 3, weight: 1.2, tags: ['coin'] },
    { id: 'mystery', label: 'MYSTERY', weight: 1, tags: ['clover'], style: { fill: 0x1f6feb } },
    { id: 'x10', label: 'x10', value: 10, weight: 0.8, tags: ['coin'] },
    { id: 'major', label: 'MAJOR', weight: 0.6, tags: ['major'], style: { fill: 0xf1c40f, labelColor: 0x2b1d00 } },
  ])
  .landing({ mode: 'random', margin: 0.15 })
  .speed('normal', SpinPresets.NORMAL)
  .ticker(app.ticker)
  .build();

// One engine, two buses. Every time value in zvuk is in seconds.
const engine = createEngine({ buses: { music: { level: 0.4 }, sfx: { level: 1 } }, master: { headroom: -3 } });
const base = '/playson-wheel/audio/';
await Promise.all([
  engine.loadSound('music', base + 'wheel_music.mp3', { bus: 'music' }),
  engine.loadSound('activate', base + 'wheel_activate.mp3'),
  engine.loadSound('spin', base + 'wheel_spin.mp3'),
  engine.loadSound('tick', base + 'click.mp3'),
  engine.loadSound('riser', base + 'anticipation.mp3'),
  engine.loadSound('landing', base + 'landing.mp3'),
  engine.loadSound('skip', base + 'skip.mp3'),
  engine.loadSound('win_coin', base + 'sector_win_regular.mp3'),
  engine.loadSound('win_clover', base + 'sector_win_clover.mp3'),
  engine.loadSound('win_mini', base + 'win_mini.mp3'),
  engine.loadSound('win_minor', base + 'win_minor.mp3'),
  engine.loadSound('win_major', base + 'win_major.mp3'),
]);

let music = null;
let spinVoice = null;
let riser = null;
const e = wheel.events;

e.on('spin:start', () => {
  music ??= engine.sound('music').play({ loop: true, fadeIn: 0.8 });
  engine.sound('activate').play();
  spinVoice = engine.sound('spin').play();
});
// The ratchet: louder and higher with speed, never twice the same, and never
// more than one click per 45 ms; past that the ear hears a buzz, not pegs.
let lastTickAt = -1e9;
e.on('pointer:tick', ({ speed }) => {
  const now = performance.now();
  if (now - lastTickAt < 45) return;
  lastTickAt = now;
  engine.sound('tick').play({
    volume: Math.min(1, 0.25 + speed / 900),
    pitch: { base: 0.9 + Math.min(0.6, speed / 1400), jitter: 0.04 },
  });
});
e.on('anticipation:start', () => { riser = engine.sound('riser').play(); });
e.on('anticipation:end', () => { riser?.stop({ fade: 0.3 }); riser = null; });
e.on('skip:requested', () => engine.sound('skip').play());
e.on('spin:landing', ({ section }) => {
  spinVoice?.stop({ fade: 0.25 });
  engine.sound('landing').play({ volume: 0.8 });
  const [tag] = section.tags;
  engine.sound(tag === 'coin' ? 'win_coin' : tag === 'clover' ? 'win_clover' : `win_${tag}`).play();
});
e.on('destroyed', () => engine.close());

return {
  wheel,
  onSpin: async () => {
    await engine.unlock(); // from the click: the browser needs a gesture before sound
    const spin = wheel.spin();
    await new Promise((r) => setTimeout(r, 300));
    const ids = wheel.sections.map((s) => s.id);
    const i = Math.floor(Math.random() * ids.length);
    // Bait with a neighbour; 'auto' creeps past it or stalls short of it depending on the side.
    wheel.setResult({ section: ids[i] }, { anticipation: { bait: ids[(i + ids.length - 1) % ids.length] } });
    await spin;
  },
};
