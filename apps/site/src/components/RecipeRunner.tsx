/** @jsxImportSource react */
import { useEffect, useRef, useState } from 'react';
import { RefreshCw, ExternalLink, SkipForward, Bug } from 'lucide-react';
import { Application, Container } from 'pixi.js';
import { Wheel, debugOverlay, enableDebug, type DebugOverlayHandle } from 'pixi-wheels';
import { transform as sucraseTransform } from 'sucrase';
import { preloadRecipeGlobals, runRecipeSource } from '@/lib/recipeGlobals';
import { cn } from '@/lib/utils';
import { CanvasSkeleton } from './CanvasSkeleton';
import { useMinDisplay } from './useMinDisplay';

// `true` would release PixiJS's process-global pools out from under the other
// live demos on the page. `{ removeView: true }` is the same view teardown
// without the global release.
const DESTROY_RENDERER = { removeView: true } as const;

/** What a recipe body returns. */
export interface RunResult {
  wheel?: Wheel;
  /**
   * A container holding a composition (a wheel beside a reel panel, two
   * wheels). When present the runner fits and centres THIS, not `wheel`.
   */
  stage?: Container;
  /** Custom spin handler. Without it the runner spins the wheel and lands a random section after a short delay. */
  onSpin?: () => Promise<void>;
  /** Custom skip handler for a press while spinning. Default `wheel.skip()`, falling back to `requestSkip()`. */
  onSkip?: () => void;
  /** A debug overlay the recipe drew itself. The Debug button toggles this one instead of adding a second. */
  overlay?: DebugOverlayHandle;
  cleanup?: () => void;
}

interface RecipeRunnerProps {
  code: string;
  /** Recipe basename. Registers the live demo on `window.__pixiWheels[slug]` for the console and tests. */
  slug?: string;
  height?: number;
}

/** What a mounted demo exposes on `window.__pixiWheels[slug]`: poke at it from the console. */
export interface LiveRecipe {
  wheel: Wheel | null;
  app: Application;
  /** The Spin button's action: spins, or skips while spinning. */
  spin: () => Promise<void>;
  /** True while the runner considers the demo spinning. */
  isSpinning: () => boolean;
}

declare global {
  interface Window {
    __pixiWheels?: Record<string, LiveRecipe>;
  }
}

export function RecipeRunner({ code, slug, height = 340 }: RecipeRunnerProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const wheelRef = useRef<Wheel | null>(null);
  const onSpinRef = useRef<(() => Promise<void>) | null>(null);
  const onSkipRef = useRef<(() => void) | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const overlayRef = useRef<DebugOverlayHandle[]>([]);
  const fitRef = useRef<(() => void) | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [debugOn, setDebugOn] = useState(false);
  const [spinError, setSpinError] = useState<string | null>(null);
  const [canDebug, setCanDebug] = useState(false);
  const spinningRef = useRef(false);
  const showSkeleton = useMinDisplay(!ready, 250);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const host = hostRef.current;
      if (!host) return;
      let js: string;
      try {
        js = sucraseTransform(code, { transforms: ['typescript'] }).code;
      } catch (e) {
        setError(`Compile error: ${(e as Error).message}`);
        return;
      }
      // The Spine runtime registers its render pipe on import; a renderer
      // created before that has no `spine` pipe. Load what the recipe
      // mentions first, then build the Application.
      await preloadRecipeGlobals(js);
      if (cancelled) return;
      const app = new Application();
      await app.init({
        backgroundAlpha: 0,
        antialias: true,
        resizeTo: host,
        resolution: Math.min(window.devicePixelRatio, 2),
        autoDensity: true,
      });
      if (cancelled) {
        app.destroy(DESTROY_RENDERER, { children: true });
        return;
      }
      host.innerHTML = '';
      host.appendChild(app.canvas);
      appRef.current = app;

      let result: RunResult;
      try {
        result = await runRecipeSource<RunResult>(js, { app });
      } catch (e) {
        setError(`Runtime error: ${(e as Error).message}`);
        return;
      }
      if (cancelled) return;
      if (!result?.wheel && !result?.onSpin && !result?.stage) {
        setError('Recipe must return { wheel } (optionally with stage / onSpin).');
        return;
      }
      wheelRef.current = result.wheel ?? null;
      onSpinRef.current = result.onSpin ?? null;
      onSkipRef.current = result.onSkip ?? null;
      cleanupRef.current = result.cleanup ?? null;

      const fitted: Container | null = result.stage ?? result.wheel ?? null;
      if (fitted) {
        if (!fitted.parent) app.stage.addChild(fitted);
        const fit = () => {
          fitted.scale.set(1);
          fitted.position.set(0, 0);
          const b = fitted.getLocalBounds();
          if (!(b.width > 0) || !(b.height > 0)) return;
          const pad = 18;
          const scale = Math.min(1, (app.screen.width - pad * 2) / b.width, (app.screen.height - pad * 2) / b.height);
          fitted.scale.set(scale);
          fitted.position.set(
            (app.screen.width - b.width * scale) / 2 - b.x * scale,
            (app.screen.height - b.height * scale) / 2 - b.y * scale,
          );
        };
        fit();
        fitRef.current = fit;
        app.renderer.on('resize', fit);
      }
      if (result.wheel) {
        enableDebug(result.wheel);
        setCanDebug(true);
      }
      if (result.overlay) {
        overlayRef.current = [result.overlay];
        setDebugOn(true);
      }
      setReady(true);
    })();

    return () => {
      cancelled = true;
      try { cleanupRef.current?.(); } catch { /* ignore */ }
      for (const o of overlayRef.current) {
        try { o.destroy(); } catch { /* ignore */ }
      }
      overlayRef.current = [];
      try { wheelRef.current?.destroy(); } catch { /* ignore */ }
      const app = appRef.current;
      if (app) {
        try { app.destroy(DESTROY_RENDERER, { children: true }); } catch { /* ignore */ }
      }
      appRef.current = null;
      wheelRef.current = null;
      onSpinRef.current = null;
      cleanupRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSpin() {
    if (!ready || !!error) return;
    const wheel = wheelRef.current;
    // The ref, not the `spinning` state: `window.__pixiWheels[slug].spin` is
    // this function captured once, and a stale closure would read `false`
    // while a spin is in flight and start a second one instead of skipping.
    if (spinningRef.current) {
      if (onSkipRef.current) {
        onSkipRef.current();
        return;
      }
      if (!wheel) return;
      // skip() throws before setResult(); requestSkip() queues the press.
      try { wheel.skip(); } catch { wheel.requestSkip(); }
      return;
    }
    setSpinning(true);
    spinningRef.current = true;
    try {
      if (onSpinRef.current) {
        await onSpinRef.current();
      } else if (wheel) {
        const p = wheel.spin();
        await new Promise((r) => setTimeout(r, 350));
        const sections = wheel.sections;
        wheel.setResult({ index: Math.floor(Math.random() * sections.length) });
        await p;
      }
    } catch (err) {
      // eslint-disable-next-line no-console -- diagnostic surface
      console.error('[RecipeRunner] handleSpin threw:', err);
      setSpinError((err as Error).message ?? String(err));
      window.setTimeout(() => setSpinError(null), 6000);
    } finally {
      setSpinning(false);
      spinningRef.current = false;
    }
  }

  // Expose the live demo for the console and for tests: window.__pixiWheels['basic-wheel'].wheel
  useEffect(() => {
    if (!ready || !slug) return;
    const app = appRef.current;
    if (!app) return;
    const registry = (window.__pixiWheels ??= {});
    registry[slug] = { wheel: wheelRef.current, app, spin: () => handleSpin(), isSpinning: () => spinningRef.current };
    return () => {
      if (registry[slug]?.app === app) delete registry[slug];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, slug]);

  function toggleDebug() {
    const wheel = wheelRef.current;
    const app = appRef.current;
    if (!wheel || !app) return;
    if (overlayRef.current.length > 0) {
      for (const o of overlayRef.current) o.destroy();
      overlayRef.current = [];
      setDebugOn(false);
      fitRef.current?.();
      return;
    }
    overlayRef.current = [debugOverlay(wheel, { layers: 'all', live: true, ticker: app.ticker, hud: 'bottom-left', screen: app.screen })];
    setDebugOn(true);
    // The overlay adds to the wheel's bounds; refit so nothing is cropped.
    fitRef.current?.();
  }

  function openInStudio() {
    window.location.href = `/studio/#code=${btoa(unescape(encodeURIComponent(code)))}`;
  }

  return (
    <div className="relative flex w-full items-center justify-center bg-background" style={{ height }}>
      <div ref={hostRef} className="h-full w-full [&_canvas]:block [&_canvas]:h-full [&_canvas]:w-full" />
      {showSkeleton && !error && <CanvasSkeleton label="Compiling recipe..." />}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-card/90 p-6 font-mono text-xs text-destructive">{error}</div>
      )}
      {spinError && (
        <div role="alert" className="absolute bottom-3 left-1/2 max-w-[80%] -translate-x-1/2 truncate rounded-md border border-destructive/50 bg-background/90 px-3 py-1.5 font-mono text-[11px] text-destructive backdrop-blur">
          Spin failed: {spinError}
        </div>
      )}
      <button
        type="button"
        onClick={() => void handleSpin()}
        disabled={!!error || !ready}
        title={spinning ? 'Skip' : 'Spin'}
        aria-label={spinning ? 'Skip' : 'Spin'}
        className={cn(
          'absolute right-3 top-1/2 -translate-y-1/2 inline-flex h-14 w-14 items-center justify-center rounded-full',
          'border border-border/70 bg-background/80 text-foreground shadow-md backdrop-blur',
          'transition-all hover:bg-primary hover:text-primary-foreground hover:border-primary',
          spinning && 'bg-primary text-primary-foreground border-primary',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
      >
        {spinning ? <SkipForward size={22} strokeWidth={2.25} /> : <RefreshCw size={22} strokeWidth={2.25} />}
      </button>
      {canDebug && (
        <button
          type="button"
          onClick={toggleDebug}
          disabled={!!error || !ready}
          title={debugOn ? 'Hide debug overlay' : 'Show debug overlay'}
          aria-label={debugOn ? 'Hide debug overlay' : 'Show debug overlay'}
          aria-pressed={debugOn}
          className={cn(
            'absolute left-2 top-2 inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] backdrop-blur transition-colors',
            debugOn ? 'border-primary bg-primary/90 text-primary-foreground' : 'border-border/40 bg-background/70 text-muted-foreground hover:text-foreground',
            'disabled:cursor-not-allowed disabled:opacity-50',
          )}
        >
          <Bug size={10} />
          Debug
        </button>
      )}
      <button
        type="button"
        onClick={openInStudio}
        title="Open in Studio"
        aria-label="Open in Studio"
        className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md border border-border/40 bg-background/70 px-2 py-1 text-[10px] text-muted-foreground backdrop-blur transition-colors hover:text-foreground"
      >
        <ExternalLink size={10} />
        Studio
      </button>
    </div>
  );
}
