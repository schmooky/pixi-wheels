import { GraphicsPointerSkin, type GraphicsPointerSkinOptions } from '../pointer/GraphicsPointerSkin.js';
import { TexturePointerSkin, type TexturePointerSkinOptions } from '../pointer/TexturePointerSkin.js';
import { DebugRingSkin } from './DebugRingSkin.js';
import { GraphicsRingSkin, type GraphicsRingSkinOptions } from './GraphicsRingSkin.js';
import { HeadlessRingSkin } from './HeadlessRingSkin.js';
import { TextureRingSkin, type RingSkinConfigTexture } from './TextureRingSkin.js';
import { registerPointerSkin, registerRingSkin, registeredRingSkinTypes } from './skinRegistry.js';

/** The serialised form of {@link TexturePointerSkinOptions}: the texture by asset key. */
export interface PointerSkinConfigTexture extends Omit<TexturePointerSkinOptions, 'texture'> {
  type: 'texture';
  texture: string;
}

export interface PointerSkinConfigGraphics extends GraphicsPointerSkinOptions {
  type: 'graphics';
}

let registered = false;

/**
 * Register the built-in skin config types. Called from `WheelBuilder.build()`
 * so a config-driven wheel always finds `graphics`, `debug`, `texture`,
 * `headless` and the two pointer skins - a value import a bundler cannot
 * drop, where a side-effect-only import could be.
 */
export function registerBuiltinSkins(): void {
  if (registered && registeredRingSkinTypes().includes('graphics')) return;
  registered = true;
  registerRingSkin('graphics', (config) => {
    const { type: _type, ...options } = config;
    return new GraphicsRingSkin(options as GraphicsRingSkinOptions);
  });
  registerRingSkin('debug', () => new DebugRingSkin());
  registerRingSkin('headless', () => new HeadlessRingSkin());
  registerRingSkin('texture', (config, assets) => {
    const { type: _type, face, frame, decorations, ...rest } = config as unknown as RingSkinConfigTexture;
    return new TextureRingSkin({
      ...rest,
      face: assets.texture(face),
      frame: frame ? assets.texture(frame) : undefined,
      decorations: (decorations ?? []).map((d) => ({ ...d, texture: assets.texture(d.texture) })),
    });
  });
  registerPointerSkin('graphics', (config) => {
    const { type: _type, ...options } = config;
    return new GraphicsPointerSkin(options as GraphicsPointerSkinOptions);
  });
  registerPointerSkin('texture', (config, assets) => {
    const { type: _type, texture, ...rest } = config as unknown as PointerSkinConfigTexture;
    return new TexturePointerSkin({ ...rest, texture: assets.texture(texture) });
  });
}

registerBuiltinSkins();
