// @ts-nocheck
// Injected globals: WheelBuilder, SpinPresets, app

// A mechanical stop: the wheel overshoots by a few degrees and springs back.
const wheel = new WheelBuilder()
  .radius(220, 30)
  .sections(Array.from({ length: 10 }, (_, i) => ({ id: `s${i}`, label: `${i * 5 + 5}` })))
  .landing({ mode: 'center', settle: { mode: 'bounce', bounceDeg: 5, durationMs: 520, ease: 'power2.out' } })
  .speed('normal', SpinPresets.NORMAL)
  .ticker(app.ticker)
  .build();

return { wheel };
