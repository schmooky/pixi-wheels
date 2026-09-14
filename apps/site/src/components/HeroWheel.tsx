/** @jsxImportSource react */
import { useEffect, useRef, useState } from 'react';
import { Application } from 'pixi.js';
import { SpinPresets, WheelBuilder, type Wheel } from 'pixi-wheels';
import { mockWheelServer } from '@/runtime/mockServer';
import { cn } from '@/lib/utils';
import { CanvasSkeleton } from './CanvasSkeleton';

type Phase = 'booting' | 'idle' | 'spinning' | 'landed' | 'error';

const SECTIONS = [
  { id: 'x2a', label: 'x2', value: 2, weight: 3 },
  { id: 'x5a', label: 'x5', value: 5, weight: 2 },
  { id: 'x3a', label: 'x3', value: 3, weight: 2.5 },
  { id: 'x10', label: 'x10', value: 10, weight: 1 },
  { id: 'x2b', label: 'x2', value: 2, weight: 3 },
  { id: 'x8', label: 'x8', value: 8, weight: 1.2 },
  { id: 'x3b', label: 'x3', value: 3, weight: 2.5 },
  { id: 'x50', label: 'x50', value: 50, weight: 0.6, style: { fill: 0xf1c40f, labelColor: 0x2b1d00 } },
];
const JACKPOT = 'x50';

/**
 * The wheel on the landing page. Tap it to spin, tap again to skip; a stand-in
 * server picks the result by odds, and a landing next to the jackpot gets the
 * near-miss. Everything it does is the library's own API, no site runtime.
 */
export function HeroWheel() {
  const hostRef = useRef<HTMLDivElement>(null);
  const spinRef = useRef<() => void>(() => {});
  const [phase, setPhase] = useState<Phase>('booting');
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let app: Application | null = null;
    let wheel: Wheel | null = null;
    (async () => {
      const host = hostRef.current;
      if (!host) return;
      try {
        const a = new Application();
        await a.init({
          backgroundAlpha: 0,
          antialias: true,
          resizeTo: host,
          resolution: Math.min(window.devicePixelRatio, 2),
          autoDensity: true,
        });
        if (cancelled) {
          a.destroy({ removeView: true }, { children: true });
          return;
        }
        app = a;
        host.appendChild(a.canvas);
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const w = new WheelBuilder()
          .radius(240, 40)
          .sections(SECTIONS)
          .pointer({ angle: -90, skin: { type: 'graphics', shape: 'tongue', length: 70, width: 34, pinRadius: 8 } })
          .skin({
            type: 'graphics',
            rim: { width: 12, color: 0xf0c040 },
            bulbs: { count: 24, color: 0xfff2b0, radius: 5 },
            hub: { radius: 40, color: 0x1c1c22, ringColor: 0xf0c040 },
            pegs: true,
          })
          .landing({ mode: 'random', margin: 0.15 })
          .idle({ speed: 5, autoStart: !reduceMotion, rampMs: 1200 })
          .speed('normal', { ...SpinPresets.NORMAL, minimumSpinTime: 900, stopDuration: 3400 })
          .ticker(a.ticker)
          .build();
        wheel = w;
        a.stage.addChild(w);

        // The tongue overhangs the rim, so fit the measured bounds, not the radius.
        const fit = () => {
          w.scale.set(1);
          const b = w.getLocalBounds();
          const pad = 8;
          const s = Math.min((a.screen.width - pad * 2) / b.width, (a.screen.height - pad * 2) / b.height);
          w.scale.set(s);
          w.position.set(a.screen.width / 2 - (b.x + b.width / 2) * s, a.screen.height / 2 - (b.y + b.height / 2) * s);
        };
        fit();
        a.renderer.on('resize', fit);

        const server = mockWheelServer(w, { odds: { x50: 0.25, x10: 0.7, x8: 0.8 }, latencyMs: 300 });
        w.events.on('spin:landing', ({ section }) => setResult(section.label));
        w.events.on('spin:complete', () => setPhase('landed'));

        const spin = () => {
          if (w.isSpinning) {
            // Second tap: skip, or queue the skip while the server is still answering.
            try {
              w.skip();
            } catch {
              w.requestSkip();
            }
            return;
          }
          setPhase('spinning');
          setResult(null);
          void (async () => {
            const p = w.spin();
            const r = await server.spin();
            // Clockwise, the pointer meets section i + 1 before section i. A
            // landing next to the jackpot baits it; the rest land plainly.
            const n = w.sections.length;
            const i = w.sections.findIndex((s) => s.id === r.sectionId);
            const nextToJackpot = w.sections[(i + 1) % n].id === JACKPOT || w.sections[(i + n - 1) % n].id === JACKPOT;
            w.setResult({ section: r.sectionId }, nextToJackpot ? { anticipation: { bait: JACKPOT } } : undefined);
            await p;
          })();
        };
        spinRef.current = spin;
        w.eventMode = 'static';
        w.cursor = 'pointer';
        w.on('pointertap', spin);
        setPhase('idle');
      } catch (e) {
        console.error('[HeroWheel]', e);
        setPhase('error');
      }
    })();
    return () => {
      cancelled = true;
      try { wheel?.destroy(); } catch { /* ignore */ }
      try { app?.destroy({ removeView: true }, { children: true }); } catch { /* ignore */ }
    };
  }, []);

  const label =
    phase === 'booting' ? 'Loading the wheel...'
    : phase === 'error' ? 'This browser cannot draw the wheel'
    : phase === 'spinning' ? 'Tap again to skip'
    : phase === 'landed' && result ? `Landed on ${result}. Tap to spin again`
    : 'Tap the wheel to spin';

  return (
    <div className="flex flex-col items-center gap-4" data-hero-wheel={phase}>
      <div ref={hostRef} className="relative aspect-square w-full max-w-[520px] select-none touch-manipulation">
        {phase === 'booting' && <CanvasSkeleton label="Loading the wheel..." className="rounded-full" />}
      </div>
      <button
        type="button"
        onClick={() => spinRef.current()}
        disabled={phase === 'booting' || phase === 'error'}
        className={cn(
          'inline-flex h-9 items-center rounded-full border border-border bg-background/80 px-4 font-mono text-xs text-muted-foreground backdrop-blur transition-colors',
          'hover:border-primary/40 hover:text-foreground disabled:cursor-default disabled:hover:border-border disabled:hover:text-muted-foreground',
        )}
        aria-live="polite"
      >
        {label}
      </button>
    </div>
  );
}
