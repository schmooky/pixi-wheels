import { Assets, type Texture } from 'pixi.js';

/**
 * Pragmatic Play "Wheel of Happiness" pieces, used with permission: the
 * golden pointer, the logo, the ring frames and coins. Served from
 * `public/pragmatic-wheel/` as WebP.
 */
export interface PragmaticWheelArt {
  pointer: Texture;
  logo: Texture;
  bigRing: Texture;
  goldRing: Texture;
  goldRingBack: Texture;
  coin: Texture;
  coinsPile: Texture;
  medallion: Texture;
}

let cached: Promise<PragmaticWheelArt> | null = null;

export function loadPragmaticWheel(base = '/pragmatic-wheel/'): Promise<PragmaticWheelArt> {
  if (cached) return cached;
  cached = (async () => {
    const names = ['pointer', 'logo', 'big_ring', 'gold_ring', 'gold_ring_back', 'coin', 'coins_pile', 'medallion'] as const;
    const loaded = await Promise.all(names.map((n) => Assets.load<Texture>(`${base}${n}.webp`)));
    const [pointer, logo, bigRing, goldRing, goldRingBack, coin, coinsPile, medallion] = loaded;
    return { pointer, logo, bigRing, goldRing, goldRingBack, coin, coinsPile, medallion };
  })();
  return cached;
}
