import type { AssetResolver, RingSkin } from './RingSkin.js';
import type { PointerSkin } from '../pointer/PointerSkin.js';

/**
 * A skin as a serialised config: the shape the studio exports and
 * `WheelBuilder.fromConfig()` reads. `type` picks a registered factory; the
 * rest is that factory's options. Asset references are string keys resolved
 * through an {@link AssetResolver}.
 */
export interface RingSkinConfig {
  type: string;
  [option: string]: unknown;
}

export interface PointerSkinConfig {
  type: string;
  [option: string]: unknown;
}

export type RingSkinFactory = (config: RingSkinConfig, assets: AssetResolver) => RingSkin;
export type PointerSkinFactory = (config: PointerSkinConfig, assets: AssetResolver) => PointerSkin;

const ringSkins = new Map<string, RingSkinFactory>();
const pointerSkins = new Map<string, PointerSkinFactory>();

/** Make a ring skin available to configs under `type`. The built-ins register themselves. */
export function registerRingSkin(type: string, factory: RingSkinFactory): void {
  ringSkins.set(type, factory);
}

export function registerPointerSkin(type: string, factory: PointerSkinFactory): void {
  pointerSkins.set(type, factory);
}

export function createRingSkin(config: RingSkinConfig, assets: AssetResolver): RingSkin {
  const factory = ringSkins.get(config.type);
  if (!factory) {
    throw new Error(
      `Unknown ring skin type "${config.type}". Registered: ${[...ringSkins.keys()].join(', ')}. ` +
        `Spine skins register when you import 'pixi-wheels/spine'.`,
    );
  }
  return factory(config, assets);
}

export function createPointerSkin(config: PointerSkinConfig, assets: AssetResolver): PointerSkin {
  const factory = pointerSkins.get(config.type);
  if (!factory) {
    throw new Error(
      `Unknown pointer skin type "${config.type}". Registered: ${[...pointerSkins.keys()].join(', ')}.`,
    );
  }
  return factory(config, assets);
}

export function registeredRingSkinTypes(): string[] {
  return [...ringSkins.keys()];
}

export function registeredPointerSkinTypes(): string[] {
  return [...pointerSkins.keys()];
}

/** An asset resolver that throws on any key: for configs that reference no assets. */
export const NO_ASSETS: AssetResolver = {
  texture(key: string) {
    throw new Error(
      `Skin config references texture "${key}" but no assets were provided. ` +
        `Pass \`WheelBuilder.fromConfig(cfg, { assets })\` with a resolver that knows it.`,
    );
  },
};
