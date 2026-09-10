/** @jsxImportSource react */
import { useEffect, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import { AlertCircle, CheckCircle2, Code2, Disc3, Download, Gauge, Layers, Maximize2, Minimize2, Play, RefreshCw, RotateCcw, Settings2, SkipForward, Sparkles, Square, Upload } from 'lucide-react';
import { Application } from 'pixi.js';
import { transform as sucraseTransform } from 'sucrase';
import {
  WheelBuilder,
  WheelTemplates,
  WHEEL_TEMPLATE_NAMES,
  assertWheelConfig,
  debugOverlay,
  enableDebug,
  type DebugOverlayHandle,
  type Wheel,
  type WheelConfig,
  type WheelTemplateName,
} from 'pixi-wheels';
import { cn } from '@/lib/utils';
import { Kbd, KbdChord } from '@/components/ui/kbd';
import { runRecipeSource } from '@/lib/recipeGlobals';
import { PIXI_WHEELS_VERSION } from '@/lib/version';
import { deleteAsset, ingestFile, listAssets } from '@/lib/studio/db.ts';
import { buildStudioAssets, revokeBlobUrls, type StudioAssets } from '@/lib/studio/assets.ts';
import { configToCode, configUsesAssets, exampleProjectFiles } from '@/lib/studio/codegen.ts';
import { downloadText, downloadZip } from '@/lib/studio/exportZip.ts';
import { STUDIO_STORAGE_KEY, type StoredAsset, type StudioMode, type StudioState } from '@/lib/studio/types.ts';
import { SectionsTab } from './studio/SectionsTab.tsx';
import { WheelTab } from './studio/WheelTab.tsx';
import { SpinTab } from './studio/SpinTab.tsx';
import { AssetsTab } from './studio/AssetsTab.tsx';
import { CanvasSkeleton } from './CanvasSkeleton.tsx';
import { useMinDisplay } from './useMinDisplay.ts';
import type { RunResult } from './RecipeRunner.tsx';

type TabId = 'sections' | 'wheel' | 'spin' | 'assets' | 'code' | 'export';

const DESTROY_RENDERER = { removeView: true } as const;

function loadState(): StudioState {
  const fallback: StudioState = { mode: 'config', config: WheelTemplates.multipliers(), code: '', landOn: 'random', bait: 'none' };
  try {
    const raw = localStorage.getItem(STUDIO_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as StudioState;
    assertWheelConfig(parsed.config);
    return { ...fallback, ...parsed };
  } catch {
    return fallback;
  }
}

function consumeHashCode(): string | null {
  if (typeof location === 'undefined' || !location.hash.startsWith('#code=')) return null;
  try {
    const decoded = decodeURIComponent(escape(atob(location.hash.slice(6))));
    history.replaceState(null, '', location.pathname + location.search);
    return decoded;
  } catch {
    return null;
  }
}

/**
 * The studio: a live wheel on the left, its config on the right. The form
 * edits a `WheelConfig`; every change rebuilds the wheel. The Code tab shows
 * the fluent code the config stands for and can take over the canvas with
 * arbitrary recipe-style code. Export gives the JSON and a runnable project.
 */
export default function Studio() {
  const hostRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const wheelRef = useRef<Wheel | null>(null);
  const onSpinRef = useRef<(() => Promise<void>) | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const overlayRef = useRef<DebugOverlayHandle | null>(null);
  const studioAssetsRef = useRef<StudioAssets | null>(null);
  const fitRef = useRef<(() => void) | null>(null);

  const [state, setState] = useState<StudioState | null>(null);
  const [assets, setAssets] = useState<StoredAsset[]>([]);
  const [tab, setTab] = useState<TabId>('sections');
  const [status, setStatus] = useState<{ kind: 'idle' | 'ok' | 'err'; msg: string }>({ kind: 'idle', msg: 'Loading studio...' });
  const [booting, setBooting] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [debugOn, setDebugOn] = useState(false);
  const [speeds, setSpeeds] = useState<string[]>([]);
  const [speedName, setSpeedName] = useState('normal');
  const showSkeleton = useMinDisplay(booting, 250);

  // ── Boot: state, assets, PixiJS ──────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const host = hostRef.current;
      if (!host) return;
      const hashCode = consumeHashCode();
      const initial = loadState();
      if (hashCode) {
        initial.mode = 'code';
        initial.code = hashCode;
      }
      const stored = await listAssets().catch(() => [] as StoredAsset[]);
      if (cancelled) return;
      setAssets(stored);
      setState(initial);
      if (hashCode) setTab('code');
      const app = new Application();
      await app.init({ backgroundAlpha: 0, antialias: true, resizeTo: host, resolution: Math.min(window.devicePixelRatio, 2), autoDensity: true });
      if (cancelled) {
        app.destroy(DESTROY_RENDERER, { children: true });
        return;
      }
      host.innerHTML = '';
      host.appendChild(app.canvas);
      appRef.current = app;
      setBooting(false);
    })();
    const host = hostRef.current;
    let observer: ResizeObserver | null = null;
    if (host && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        try { appRef.current?.resize(); } catch { /* ignore */ }
        fitRef.current?.();
      });
      observer.observe(host);
    }
    return () => {
      cancelled = true;
      observer?.disconnect();
      teardown();
      if (appRef.current) {
        try { appRef.current.destroy(DESTROY_RENDERER, { children: true }); } catch { /* ignore */ }
        appRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Persist ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!state) return;
    const h = setTimeout(() => {
      try { localStorage.setItem(STUDIO_STORAGE_KEY, JSON.stringify(state)); } catch { /* best effort */ }
    }, 300);
    return () => clearTimeout(h);
  }, [state]);

  // ── Rebuild on config change (config mode) ───────────────────────────
  useEffect(() => {
    if (!state || booting || state.mode !== 'config') return;
    const h = setTimeout(() => void buildFromConfig(state.config), 120);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.config, state?.mode, booting, assets]);

  function teardown(): void {
    try { cleanupRef.current?.(); } catch { /* ignore */ }
    overlayRef.current?.destroy();
    overlayRef.current = null;
    setDebugOn(false);
    try { wheelRef.current?.destroy(); } catch { /* ignore */ }
    wheelRef.current = null;
    onSpinRef.current = null;
    cleanupRef.current = null;
    fitRef.current = null;
    if (studioAssetsRef.current) {
      revokeBlobUrls(studioAssetsRef.current.blobUrls);
      studioAssetsRef.current = null;
    }
    appRef.current?.stage.removeChildren();
  }

  function mount(wheel: Wheel | null, stage?: { getLocalBounds(): { x: number; y: number; width: number; height: number }; scale: { set(v: number): void }; position: { set(x: number, y: number): void }; parent: unknown }): void {
    const app = appRef.current;
    if (!app) return;
    const fitted = stage ?? wheel;
    if (!fitted) return;
    if (!(fitted as { parent: unknown }).parent) app.stage.addChild(fitted as never);
    const fit = () => {
      fitted.scale.set(1);
      fitted.position.set(0, 0);
      const b = fitted.getLocalBounds();
      if (!(b.width > 0) || !(b.height > 0)) return;
      const pad = 24;
      const scale = Math.min((app.screen.width - pad * 2) / b.width, (app.screen.height - pad * 2) / b.height);
      fitted.scale.set(scale);
      fitted.position.set((app.screen.width - b.width * scale) / 2 - b.x * scale, (app.screen.height - b.height * scale) / 2 - b.y * scale);
    };
    fit();
    fitRef.current = fit;
    if (wheel) {
      wheelRef.current = wheel;
      enableDebug(wheel);
      const names = wheel.speedNames;
      setSpeeds(names);
      const next = names.includes(speedName) ? speedName : wheel.activeSpeed;
      setSpeedName(next);
      if (next !== wheel.activeSpeed) wheel.setSpeed(next);
    }
  }

  async function buildFromConfig(config: WheelConfig): Promise<void> {
    const app = appRef.current;
    if (!app) return;
    teardown();
    try {
      const studioAssets = await buildStudioAssets(assets);
      studioAssetsRef.current = studioAssets;
      if (config.rings.some((r) => r.skin?.type === 'spine' || (r.pointers ?? []).some((p) => p.skin?.type === 'spine'))) {
        await import('pixi-wheels/spine');
      }
      const wheel = WheelBuilder.fromConfig(config, { assets: studioAssets.resolver }).ticker(app.ticker).build();
      mount(wheel);
      setStatus({ kind: 'ok', msg: `Built: ${wheel.rings.length} ring${wheel.rings.length === 1 ? '' : 's'}, ${wheel.sections.length} sections on the main ring.` });
    } catch (e) {
      setStatus({ kind: 'err', msg: (e as Error).message });
    }
  }

  async function runCode(): Promise<void> {
    const app = appRef.current;
    if (!app || !state) return;
    teardown();
    let js: string;
    try {
      js = sucraseTransform(state.code, { transforms: ['typescript'] }).code;
    } catch (e) {
      setStatus({ kind: 'err', msg: `Compile error: ${(e as Error).message}` });
      return;
    }
    try {
      const studioAssets = await buildStudioAssets(assets);
      studioAssetsRef.current = studioAssets;
      const result = await runRecipeSource<RunResult>(js, { app, userTextures: studioAssets.textures, assets: studioAssets.resolver });
      if (!result?.wheel && !result?.stage) throw new Error('Code must return { wheel } (optionally with stage / onSpin).');
      onSpinRef.current = result.onSpin ?? null;
      cleanupRef.current = result.cleanup ?? null;
      mount(result.wheel ?? null, result.stage as never);
      setStatus({ kind: 'ok', msg: 'Code mounted.' });
    } catch (e) {
      setStatus({ kind: 'err', msg: `Runtime error: ${(e as Error).message}` });
    }
  }

  function setConfig(config: WheelConfig): void {
    setState((s) => (s ? { ...s, config } : s));
  }

  function setMode(mode: StudioMode): void {
    if (!state) return;
    if (mode === 'code' && state.code.trim() === '') {
      setState({ ...state, mode, code: configToCode(state.config, { withAssets: configUsesAssets(state.config) }) });
    } else {
      setState({ ...state, mode });
    }
    if (mode === 'config') void buildFromConfig(state.config);
  }

  async function handleSpin(): Promise<void> {
    const wheel = wheelRef.current;
    if (spinning) {
      if (wheel) {
        try { wheel.skip(); } catch { wheel.requestSkip(); }
      }
      return;
    }
    if (!wheel && !onSpinRef.current) return;
    setSpinning(true);
    try {
      if (onSpinRef.current) await onSpinRef.current();
      else if (wheel && state) {
        const p = wheel.spin();
        await new Promise((r) => setTimeout(r, 300));
        const sections = wheel.sections;
        const target = state.landOn !== 'random' && sections.some((s) => s.id === state.landOn)
          ? { section: state.landOn }
          : { index: Math.floor(Math.random() * sections.length) };
        const bait = state.bait !== 'none' && sections.some((s) => s.id === state.bait) ? { bait: state.bait } : null;
        wheel.setResult(target, bait ? { anticipation: bait } : {});
        await p;
      }
    } catch (e) {
      setStatus({ kind: 'err', msg: `Spin error: ${(e as Error).message}` });
    } finally {
      setSpinning(false);
    }
  }

  function toggleDebug(): void {
    const wheel = wheelRef.current;
    const app = appRef.current;
    if (!wheel || !app) return;
    if (overlayRef.current) {
      overlayRef.current.destroy();
      overlayRef.current = null;
      setDebugOn(false);
      return;
    }
    overlayRef.current = debugOverlay(wheel, { layers: 'all', live: true, ticker: app.ticker });
    setDebugOn(true);
  }

  async function onUpload(files: FileList): Promise<void> {
    for (const f of Array.from(files)) await ingestFile(f);
    setAssets(await listAssets());
  }

  async function onDeleteAsset(key: string): Promise<void> {
    await deleteAsset(key);
    setAssets(await listAssets());
  }

  function loadTemplate(name: WheelTemplateName): void {
    if (!state) return;
    setState({ ...state, mode: 'config', config: WheelTemplates[name](), code: '' });
    setTab('sections');
  }

  async function exportProject(): Promise<void> {
    if (!state) return;
    const cfg = state.config;
    const keys = assets.map((a) => a.key);
    const text = exampleProjectFiles(cfg, keys, PIXI_WHEELS_VERSION);
    const bin: Record<string, Uint8Array> = {};
    for (const a of assets) bin[`public/assets/${a.key}`] = new Uint8Array(await a.blob.arrayBuffer());
    if (state.mode === 'code') text['src/studio-code.ts'] = state.code;
    downloadZip(`${(cfg.name ?? 'wheel').toLowerCase().replace(/[^a-z0-9-]+/g, '-')}-pixi-wheels.zip`, text, bin);
  }

  function importConfig(file: File): void {
    void file.text().then((t) => {
      try {
        const cfg = JSON.parse(t);
        assertWheelConfig(cfg);
        setState((s) => (s ? { ...s, mode: 'config', config: cfg, code: '' } : s));
        setStatus({ kind: 'ok', msg: `Imported ${file.name}.` });
      } catch (e) {
        setStatus({ kind: 'err', msg: `Import failed: ${(e as Error).message}` });
      }
    });
  }

  // Cmd/Ctrl+Enter runs the code.
  useEffect(() => {
    if (tab !== 'code') return;
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        void runCode();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, state]);

  useEffect(() => {
    if (!fullscreen) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && setFullscreen(false);
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [fullscreen]);

  const main = state?.config.rings.find((r) => r.id === 'main') ?? state?.config.rings[0];
  const sectionIds = main?.sections.map((s) => s.id) ?? [];
  const mainIndex = state ? state.config.rings.indexOf(main!) : 0;
  const setMain = (next: typeof main) => {
    if (!state || !next) return;
    const rings = state.config.rings.map((r, i) => (i === mainIndex ? next : r));
    setConfig({ ...state.config, rings });
  };

  return (
    <div className={cn('flex flex-col gap-3', fullscreen && 'fixed inset-x-0 top-14 bottom-0 z-40 bg-background p-4')}>
      <div className={cn(fullscreen ? 'grid flex-1 grid-cols-2 gap-4 min-h-0' : 'grid grid-cols-1 gap-4 lg:grid-cols-[1fr_minmax(380px,560px)]')}>
        {/* Canvas pane */}
        <div className={cn('flex flex-col overflow-hidden rounded-xl border border-border bg-card', fullscreen && 'min-h-0')}>
          <div className={cn('relative flex-1', !fullscreen && 'min-h-[520px]')}>
            <div ref={hostRef} className="h-full w-full bg-background" />
            {showSkeleton && <CanvasSkeleton label="Loading studio..." />}
            <div className="absolute left-3 top-3 flex flex-wrap items-center gap-2">
              {state?.mode === 'config' && sectionIds.length > 0 && (
                <>
                  <label className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/80 px-2 py-1 text-[10px] text-muted-foreground backdrop-blur">
                    land on
                    <select className="bg-transparent font-mono text-foreground outline-none" value={state.landOn} onChange={(e) => setState({ ...state, landOn: e.target.value })}>
                      <option value="random">random</option>
                      {sectionIds.map((id) => <option key={id} value={id}>{id}</option>)}
                    </select>
                  </label>
                  <label className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/80 px-2 py-1 text-[10px] text-muted-foreground backdrop-blur">
                    bait
                    <select className="bg-transparent font-mono text-foreground outline-none" value={state.bait} onChange={(e) => setState({ ...state, bait: e.target.value })}>
                      <option value="none">none</option>
                      {sectionIds.map((id) => <option key={id} value={id}>{id}</option>)}
                    </select>
                  </label>
                </>
              )}
              <button type="button" onClick={toggleDebug} disabled={!wheelRef.current} aria-pressed={debugOn} className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] backdrop-blur', debugOn ? 'border-primary bg-primary/90 text-primary-foreground' : 'border-border/70 bg-background/80 text-muted-foreground hover:text-foreground', 'disabled:opacity-40')}>
                debug
              </button>
              {(main?.dynamic?.steps.length ?? 0) > 0 && wheelRef.current && (
                <button type="button" onClick={() => void wheelRef.current?.nextStep()} className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/80 px-2 py-1 text-[10px] text-muted-foreground backdrop-blur hover:text-foreground">
                  <Layers size={10} /> next step
                </button>
              )}
            </div>
            {speeds.length > 1 && (
              <div role="radiogroup" aria-label="Spin speed" className="absolute bottom-3 left-3 inline-flex items-center gap-0.5 rounded-full border border-border/70 bg-background/80 p-0.5 pl-2 shadow-sm backdrop-blur">
                <Gauge size={12} strokeWidth={2.25} className="mr-1 flex-shrink-0 text-muted-foreground" />
                {speeds.map((name) => (
                  <button key={name} type="button" role="radio" aria-checked={speedName === name} onClick={() => { setSpeedName(name); try { wheelRef.current?.setSpeed(name); } catch { /* ignore */ } }} className={cn('rounded-full px-2.5 py-1 text-[10px] font-mono uppercase tracking-wide transition-colors', speedName === name ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                    {name}
                  </button>
                ))}
              </div>
            )}
            <button type="button" onClick={() => void handleSpin()} disabled={booting || (!wheelRef.current && !onSpinRef.current)} title={spinning ? 'Skip' : 'Spin'} aria-label={spinning ? 'Skip' : 'Spin'} className={cn('absolute bottom-3 right-3 inline-flex h-12 w-12 items-center justify-center rounded-full border border-border/70 bg-background/80 text-foreground shadow-sm backdrop-blur transition-all hover:bg-primary hover:text-primary-foreground hover:border-primary', spinning && 'bg-primary text-primary-foreground border-primary', 'disabled:cursor-not-allowed disabled:opacity-50')}>
              {spinning ? <SkipForward size={16} strokeWidth={2.5} /> : <RefreshCw size={18} strokeWidth={2.25} />}
            </button>
          </div>
          <div className="flex items-start gap-2 border-t border-border/60 bg-background/40 px-3 py-2 text-xs">
            {status.kind === 'err' ? <AlertCircle size={13} className="mt-0.5 flex-shrink-0 text-destructive" /> : status.kind === 'ok' ? <CheckCircle2 size={13} className="mt-0.5 flex-shrink-0 text-emerald-500" /> : <div className="mt-0.5 h-[13px] w-[13px] flex-shrink-0 rounded-full border border-muted-foreground/40" />}
            <span className={status.kind === 'err' ? 'text-destructive' : 'text-muted-foreground'}>{booting ? 'Loading studio...' : status.msg}</span>
          </div>
        </div>

        {/* Editor pane */}
        <div className={cn('flex flex-col overflow-hidden rounded-xl border border-border bg-card', fullscreen && 'min-h-0')}>
          <div className="flex items-center gap-1 overflow-x-auto border-b border-border/60 bg-background/40 px-2 pt-2">
            <TabButton active={tab === 'sections'} onClick={() => setTab('sections')} icon={<Disc3 size={12} />}>Sections</TabButton>
            <TabButton active={tab === 'wheel'} onClick={() => setTab('wheel')} icon={<Settings2 size={12} />}>Wheel</TabButton>
            <TabButton active={tab === 'spin'} onClick={() => setTab('spin')} icon={<Gauge size={12} />}>Spin</TabButton>
            <TabButton active={tab === 'assets'} onClick={() => setTab('assets')} icon={<Upload size={12} />}>Assets{assets.length > 0 && <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">{assets.length}</span>}</TabButton>
            <TabButton active={tab === 'code'} onClick={() => setTab('code')} icon={<Code2 size={12} />}>Code</TabButton>
            <TabButton active={tab === 'export'} onClick={() => setTab('export')} icon={<Download size={12} />}>Export</TabButton>
            <div className="ml-auto flex items-center gap-2 pb-2">
              {tab === 'code' && (
                <button type="button" onClick={() => { setMode('code'); void runCode(); }} disabled={booting || !state} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow hover:brightness-110 disabled:opacity-50">
                  <Play size={12} strokeWidth={2.5} /> Run
                  <KbdChord className="ml-1">{typeof navigator !== 'undefined' && navigator.platform.toLowerCase().includes('mac') ? <Kbd icon="cmd" /> : <Kbd>Ctrl</Kbd>}<Kbd icon="enter" /></KbdChord>
                </button>
              )}
              <button type="button" onClick={() => setFullscreen((v) => !v)} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-transparent px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground" title={fullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen'}>
                {fullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
              </button>
            </div>
          </div>

          <div className={cn('overflow-y-auto', fullscreen ? 'min-h-0 flex-1' : 'h-[600px]')}>
            {state && main && tab === 'sections' && <SectionsTab ring={main} onChange={setMain} />}
            {state && main && tab === 'wheel' && <WheelTab ring={main} onChange={setMain} assets={assets} direction={state.config.direction ?? 'cw'} onDirection={(d) => setConfig({ ...state.config, direction: d })} />}
            {state && tab === 'spin' && <SpinTab config={state.config} onChange={setConfig} />}
            {tab === 'assets' && <AssetsTab assets={assets} onUpload={(f) => void onUpload(f)} onDelete={(k) => void onDeleteAsset(k)} />}
            {state && tab === 'code' && (
              <div className="flex h-full flex-col">
                <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2 text-[11px] text-muted-foreground">
                  <span>{state.mode === 'code' ? 'The canvas runs this code.' : 'This is the code your config stands for. Run it to take over the canvas.'}</span>
                  <button type="button" className="ml-auto inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 hover:text-foreground" onClick={() => setState({ ...state, code: configToCode(state.config, { withAssets: configUsesAssets(state.config) }) })} title="Regenerate from the config"><RotateCcw size={10} /> from config</button>
                  {state.mode === 'code' && <button type="button" className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 hover:text-foreground" onClick={() => setMode('config')}>back to config</button>}
                </div>
                <div className="min-h-0 flex-1">
                  <Editor
                    defaultLanguage="typescript"
                    value={state.code || configToCode(state.config, { withAssets: configUsesAssets(state.config) })}
                    onChange={(v) => setState({ ...state, code: v ?? '' })}
                    theme="vs-dark"
                    options={{ fontSize: 13, minimap: { enabled: false }, scrollBeyondLastLine: false, tabSize: 2, padding: { top: 10, bottom: 10 } }}
                    onMount={(_e, monaco) => monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({ noSemanticValidation: true, noSyntaxValidation: false })}
                  />
                </div>
              </div>
            )}
            {state && tab === 'export' && (
              <div className="space-y-6 p-4 text-xs">
                <section>
                  <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">Start from a template</h3>
                  <div className="flex flex-wrap gap-2">
                    {WHEEL_TEMPLATE_NAMES.map((n) => (
                      <button key={n} type="button" onClick={() => loadTemplate(n)} className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-[11px] text-muted-foreground hover:border-primary/50 hover:text-foreground"><Sparkles size={11} /> {WheelTemplates[n]().name}</button>
                    ))}
                  </div>
                </section>
                <section>
                  <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">Config</h3>
                  <p className="mb-2 text-muted-foreground">The JSON below is the whole wheel. Load it with <code>WheelBuilder.fromConfig(cfg).ticker(app.ticker).build()</code>, or import it back here later.</p>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => downloadText(`${(state.config.name ?? 'wheel').toLowerCase().replace(/[^a-z0-9-]+/g, '-')}.wheel.json`, JSON.stringify(state.config, null, 2))} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:brightness-110"><Download size={12} /> Download config JSON</button>
                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"><Upload size={12} /> Import config JSON<input type="file" accept=".json" className="hidden" onChange={(e) => e.target.files?.[0] && importConfig(e.target.files[0])} /></label>
                    <button type="button" onClick={() => void navigator.clipboard.writeText(configToCode(state.config, { withAssets: configUsesAssets(state.config) }))} className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"><Code2 size={12} /> Copy fluent code</button>
                  </div>
                  <pre className="mt-3 max-h-64 overflow-auto rounded-md border border-border bg-background p-3 font-mono text-[10px] leading-relaxed">{JSON.stringify(state.config, null, 2)}</pre>
                </section>
                <section>
                  <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">Example project</h3>
                  <p className="mb-2 text-muted-foreground">A Vite project that runs this wheel: <code>package.json</code>, <code>index.html</code>, <code>src/main.ts</code> with a spin and a skip button, the config, and your uploaded assets under <code>public/assets/</code>. Unzip, <code>npm install</code>, <code>npm run dev</code>.</p>
                  <button type="button" onClick={() => void exportProject()} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:brightness-110"><Download size={12} /> Download project zip</button>
                </section>
                <section>
                  <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">Reset</h3>
                  <button type="button" onClick={() => { localStorage.removeItem(STUDIO_STORAGE_KEY); setState({ mode: 'config', config: WheelTemplates.multipliers(), code: '', landOn: 'random', bait: 'none' }); }} className="inline-flex items-center gap-1.5 rounded-md border border-destructive/50 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10"><Square size={12} /> Reset the studio</button>
                </section>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={cn('inline-flex flex-shrink-0 items-center gap-1.5 rounded-t-md border-b-2 px-3 py-2 text-xs transition-colors', active ? 'border-primary font-semibold text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>
      {icon}
      {children}
    </button>
  );
}
