import { GraphicsPointerSkin, type GraphicsPointerSkinOptions } from './GraphicsPointerSkin.js';
import { TexturePointerSkin, type TexturePointerSkinOptions } from './TexturePointerSkin.js';
import { registerPointerSkin } from '../skins/skinRegistry.js';

/** The serialised form of {@link TexturePointerSkinOptions}: the texture by asset key. */
export interface PointerSkinConfigTexture extends Omit<TexturePointerSkinOptions, 'texture'> {
  type: 'texture';
  texture: string;
}

export interface PointerSkinConfigGraphics extends GraphicsPointerSkinOptions {
  type: 'graphics';
}

registerPointerSkin('graphics', (config) => {
  const { type: _type, ...options } = config;
  return new GraphicsPointerSkin(options as GraphicsPointerSkinOptions);
});

registerPointerSkin('texture', (config, assets) => {
  const { type: _type, texture, ...rest } = config as unknown as PointerSkinConfigTexture;
  return new TexturePointerSkin({ ...rest, texture: assets.texture(texture) });
});
