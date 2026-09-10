/**
 * Studios whose game art appears on this site. Each entry credits an asset
 * set used by the recipes; the logo SVG lives at `public/credits/<slug>.svg`
 * when the studio provided one.
 */
export interface AssetPartner {
  name: string;
  /** Public path of the logo SVG, or null for a text-only credit. */
  logo: string | null;
  url: string;
  blurb: string;
}

export const ASSET_PARTNERS: AssetPartner[] = [
  {
    name: 'Playson',
    logo: '/credits/playson.svg',
    url: 'https://playson.com',
    blurb: 'The Four Charged Clovers: Super Wheel art and sounds behind the composed and Spine wheel recipes and the sound hooks.',
  },
  {
    name: 'Pragmatic Play',
    logo: null,
    url: 'https://www.pragmaticplay.com',
    blurb: 'The Wheel of Happiness plates, dragon hub, pointer, bitmap font and selection effects skeleton behind the prize-wheel recipe.',
  },
];
