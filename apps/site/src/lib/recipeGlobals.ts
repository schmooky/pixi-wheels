/**
 * The single source of truth for the variables a recipe body can reference.
 *
 * Two runtimes evaluate recipe-shaped code: `RecipeRunner` (the docs demos)
 * and `Studio` (the editable workbench). Both build their `AsyncFunction`
 * from the object below, so the two surfaces cannot drift apart.
 */
import * as PIXI from 'pixi.js';
import {
  DebugRingSkin,
  GraphicsPointerSkin,
  GraphicsRingSkin,
  SpinPresets,
  TexturePointerSkin,
  TextureRingSkin,
  WheelBuilder,
  WheelTemplates,
  arcDelta,
  createTargetAdapter,
  debugArc,
  debugOverlay,
  debugSnapshot,
  enableDebug,
  normalizeDeg,
  resolveTarget,
  DEFAULT_PALETTE,
} from 'pixi-wheels';
import { NO_ASSETS, type AssetResolver } from 'pixi-wheels';
import { mockWheelServer, randomTarget } from '../runtime/mockServer.ts';

/**
 * Heavy groups a recipe only pays for if it mentions them. Each test is
 * deliberately generous: a false positive costs one unnecessary chunk fetch,
 * a false negative is `Can't find variable` at run time.
 */
async function loadSpineGlobals(): Promise<Record<string, unknown>> {
  const [spine, runtime] = await Promise.all([import('pixi-wheels/spine'), import('@esotericsoftware/spine-pixi-v8')]);
  return { SpineRingSkin: spine.SpineRingSkin, SpinePointerSkin: spine.SpinePointerSkin, Spine: runtime.Spine };
}

async function loadPlaysonGlobals(): Promise<Record<string, unknown>> {
  const m = await import('../runtime/playsonWheel.ts');
  return {
    loadPlaysonWheel: m.loadPlaysonWheel,
    PlaysonWheelSkin: m.PlaysonWheelSkin,
    PLAYSON_SECTIONS: m.PLAYSON_SECTIONS,
    PLAYSON_PLATES: m.PLAYSON_PLATES,
    PLAYSON_PLATE_RADIUS: m.PLAYSON_PLATE_RADIUS,
  };
}

async function loadPragmaticGlobals(): Promise<Record<string, unknown>> {
  const m = await import('../runtime/pragmaticWheel.ts');
  return { loadPragmaticWheel: m.loadPragmaticWheel };
}

const LAZY_GROUPS: Array<{ test: RegExp; load: () => Promise<Record<string, unknown>> }> = [
  { test: /[Ss]pine|SPINE/, load: loadSpineGlobals },
  { test: /Playson|PLAYSON/, load: loadPlaysonGlobals },
  { test: /Pragmatic|PRAGMATIC/, load: loadPragmaticGlobals },
];

/** Per-runtime values. Everything else is the same in both. */
export interface RecipeGlobalsEnv {
  app: PIXI.Application;
  /** Studio only: textures the user uploaded, by key. `{}` in the docs runner. */
  userTextures?: Record<string, PIXI.Texture>;
  /** Studio only: resolver for config-driven skins. Throws on every key in the docs runner. */
  assets?: AssetResolver;
}

export function buildRecipeGlobals(env: RecipeGlobalsEnv, lazy: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    // Engine surface
    WheelBuilder,
    SpinPresets,
    WheelTemplates,
    GraphicsRingSkin,
    DebugRingSkin,
    TextureRingSkin,
    GraphicsPointerSkin,
    TexturePointerSkin,
    createTargetAdapter,
    resolveTarget,
    enableDebug,
    debugArc,
    debugSnapshot,
    debugOverlay,
    normalizeDeg,
    arcDelta,
    DEFAULT_PALETTE,

    // Host environment
    app: env.app,
    PIXI,
    mockWheelServer,
    randomTarget,
    userTextures: env.userTextures ?? {},
    assets: env.assets ?? NO_ASSETS,

    ...lazy,
  };
}

/**
 * Evaluate a recipe body with the shared globals in scope. `AsyncFunction`
 * so a recipe can `await` asset loading before returning.
 */
export async function runRecipeSource<T>(compiledJs: string, env: RecipeGlobalsEnv, trailer = ''): Promise<T> {
  const loaded = await Promise.all(LAZY_GROUPS.filter((g) => g.test.test(compiledJs)).map((g) => g.load()));
  const globals = buildRecipeGlobals(env, Object.assign({}, ...loaded));
  const names = Object.keys(globals);
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as FunctionConstructor;
  const factory = new AsyncFunction(...names, `"use strict"; ${compiledJs}${trailer}`);
  return (await factory(...names.map((n) => globals[n]))) as T;
}
