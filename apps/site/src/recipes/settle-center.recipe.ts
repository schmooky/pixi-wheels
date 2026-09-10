// @ts-nocheck
// Injected globals: WheelBuilder, SpinPresets, app

// Land exactly where the server said, pause, then glide to the middle of the
// section so the prize presentation is centred. The result reports the
// landing offset; the settle is presentation only.
const wheel = new WheelBuilder()
  .radius(220, 30)
  .sections(Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, label: `${(i + 1) * 100}`, value: (i + 1) * 100 })))
  .landing({
    mode: 'random',
    margin: 0.06,
    settle: { mode: 'center', delayMs: 350, durationMs: 700, ease: 'sine.inOut' },
  })
  .speed('normal', SpinPresets.NORMAL)
  .ticker(app.ticker)
  .build();

wheel.events.on('spin:landing', ({ section, landingAngle }) => console.log('[settle] landed', section.id, 'at', landingAngle.toFixed(1)));
wheel.events.on('spin:settle:start', () => console.log('[settle] centring...'));
wheel.events.on('spin:settle:end', () => console.log('[settle] centred'));

return { wheel };
