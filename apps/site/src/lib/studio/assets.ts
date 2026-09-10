import { Assets, Texture } from 'pixi.js';
import type { AssetResolver } from 'pixi-wheels';
import type { StoredAsset } from './types.ts';

/**
 * Turn the uploaded files into an `AssetResolver` for config-driven skins.
 * Textures load through PixiJS `Assets` from blob URLs; a Spine bundle
 * (skeleton + atlas + pages) is registered under its file names so a
 * `{ type: 'spine', skeleton: 'wheel.json', atlas: 'wheel.atlas' }` config
 * resolves. The atlas text is rewritten so its page lines point at blob URLs.
 */
export interface StudioAssets {
  resolver: AssetResolver;
  textures: Record<string, Texture>;
  blobUrls: string[];
  spineAliases: string[];
}

export async function buildStudioAssets(assets: StoredAsset[]): Promise<StudioAssets> {
  const blobUrls: string[] = [];
  const textures: Record<string, Texture> = {};
  const urlFor = (a: StoredAsset): string => {
    const u = URL.createObjectURL(a.blob);
    blobUrls.push(u);
    return u;
  };
  const byKey = new Map(assets.map((a) => [a.key, a]));
  for (const a of assets) {
    if (a.kind !== 'texture') continue;
    const url = urlFor(a);
    const ext = a.key.split('.').pop()?.toLowerCase() ?? 'png';
    textures[a.key] = await Assets.load<Texture>({ src: url, alias: `studio:${a.hash}`, format: ext, loadParser: 'loadTextures' });
  }
  const spineAliases: string[] = [];
  for (const a of assets) {
    if (a.kind !== 'spine-atlas') continue;
    let text = await a.blob.text();
    // Page lines are the un-indented image names; point each at the uploaded page.
    text = text.replace(/^(\S+\.(?:png|webp|jpe?g))\s*$/gim, (line) => {
      const page = byKey.get(line.trim());
      if (!page) return line;
      const url = urlFor(page);
      return `${url}`;
    });
    const atlasBlob = new Blob([text], { type: 'text/plain' });
    const atlasUrl = urlFor(atlasBlob as Blob);
    if (!Assets.cache.has(a.key)) Assets.add({ alias: a.key, src: atlasUrl, loadParser: 'spineTextureAtlasLoader' });
    spineAliases.push(a.key);
  }
  for (const a of assets) {
    if (a.kind !== 'spine-skeleton') continue;
    const url = urlFor(a);
    if (!Assets.cache.has(a.key)) Assets.add({ alias: a.key, src: url, loadParser: a.key.endsWith('.skel') ? 'spineSkeletonLoader' : 'spineSkeletonLoader' });
    spineAliases.push(a.key);
  }
  if (spineAliases.length > 0) {
    await import('@esotericsoftware/spine-pixi-v8');
    await Assets.load(spineAliases);
  }
  const resolver: AssetResolver = {
    texture(key: string) {
      const t = textures[key];
      if (!t) {
        throw new Error(`No uploaded texture "${key}". Uploaded: ${Object.keys(textures).join(', ') || 'none'}. Add it in the Assets tab.`);
      }
      return t;
    },
  };
  return { resolver, textures, blobUrls, spineAliases };
}

export function revokeBlobUrls(urls: string[]): void {
  for (const u of urls) {
    try { URL.revokeObjectURL(u); } catch { /* ignore */ }
  }
}
