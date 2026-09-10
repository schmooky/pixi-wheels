import { Rectangle, Texture, type TextureSource } from 'pixi.js';

export interface AtlasRegion {
  name: string;
  page: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotate: boolean;
  origWidth: number;
  origHeight: number;
  offsetX: number;
  offsetY: number;
}

export interface ParsedAtlas {
  pages: Array<{ name: string; width: number; height: number }>;
  regions: AtlasRegion[];
}

/**
 * A small parser for the Spine / libgdx text atlas format, enough to turn a
 * packed sheet into PixiJS textures without the Spine runtime. Handles the
 * classic (`xy:`/`size:`/`orig:`/`offset:`/`rotate:`) and the 4.x
 * (`bounds:`/`offsets:`) key styles.
 */
export function parseSpineAtlas(text: string): ParsedAtlas {
  const lines = text.split(/\r?\n/);
  const pages: ParsedAtlas['pages'] = [];
  const regions: AtlasRegion[] = [];
  let page: { name: string; width: number; height: number } | null = null;
  let current: AtlasRegion | null = null;
  const num = (v: string): number[] => v.split(',').map((s) => Number(s.trim()));
  for (const raw of lines) {
    if (raw.trim() === '') {
      page = null;
      continue;
    }
    if (!raw.startsWith(' ') && !raw.startsWith('\t')) {
      if (!page || /\.(png|webp|jpe?g|avif)$/i.test(raw.trim()) && !raw.includes(':')) {
        if (/\.(png|webp|jpe?g|avif)$/i.test(raw.trim())) {
          page = { name: raw.trim(), width: 0, height: 0 };
          pages.push(page);
          current = null;
          continue;
        }
      }
      if (raw.includes(':') && page && current === null && regions.length === 0 && pages.length > 0 && page.width === 0) {
        // page-level key on the header line (rare)
      }
      if (!raw.includes(':')) {
        current = { name: raw.trim(), page: page?.name ?? '', x: 0, y: 0, width: 0, height: 0, rotate: false, origWidth: 0, origHeight: 0, offsetX: 0, offsetY: 0 };
        regions.push(current);
        continue;
      }
    }
    const idx = raw.indexOf(':');
    if (idx < 0) continue;
    const key = raw.slice(0, idx).trim();
    const value = raw.slice(idx + 1).trim();
    if (current === null && page) {
      if (key === 'size') {
        const [w, h] = num(value);
        page.width = w;
        page.height = h;
      }
      continue;
    }
    if (!current) continue;
    switch (key) {
      case 'rotate':
        current.rotate = value === 'true' || value === '90';
        break;
      case 'xy': {
        const [x, y] = num(value);
        current.x = x;
        current.y = y;
        break;
      }
      case 'size': {
        const [w, h] = num(value);
        current.width = w;
        current.height = h;
        break;
      }
      case 'bounds': {
        const [x, y, w, h] = num(value);
        current.x = x;
        current.y = y;
        current.width = w;
        current.height = h;
        break;
      }
      case 'orig': {
        const [w, h] = num(value);
        current.origWidth = w;
        current.origHeight = h;
        break;
      }
      case 'offset': {
        const [x, y] = num(value);
        current.offsetX = x;
        current.offsetY = y;
        break;
      }
      case 'offsets': {
        const [ox, oy, ow, oh] = num(value);
        current.offsetX = ox;
        current.offsetY = oy;
        current.origWidth = ow;
        current.origHeight = oh;
        break;
      }
      default:
        break;
    }
  }
  for (const r of regions) {
    if (r.origWidth === 0) r.origWidth = r.width;
    if (r.origHeight === 0) r.origHeight = r.height;
  }
  return { pages, regions };
}

/**
 * Build one `Texture` per region. `pages` maps a page file name (as written
 * in the atlas) to its loaded texture source. Rotated regions come out
 * upright; trimmed regions keep their original size through `orig`/`trim`.
 */
export function texturesFromAtlas(atlas: ParsedAtlas, pages: Record<string, Texture>): Record<string, Texture> {
  const out: Record<string, Texture> = {};
  for (const r of atlas.regions) {
    const pageTex = pages[r.page];
    if (!pageTex) throw new Error(`spineAtlas: page "${r.page}" was not loaded. Loaded: ${Object.keys(pages).join(', ')}.`);
    const source: TextureSource = pageTex.source;
    // Spine's offset y is from the BOTTOM of the original image; PixiJS trim y is from the top.
    const trimY = r.origHeight - r.offsetY - r.height;
    // A rotated Spine region is stored turned 90 degrees COUNTER-clockwise (the
    // attachment's top edge runs up the packed rect's left side), the opposite
    // of TexturePacker's convention, so PixiJS needs groupD8 6 (a 270 degree
    // turn), not the usual 2.
    const frame = r.rotate ? new Rectangle(r.x, r.y, r.height, r.width) : new Rectangle(r.x, r.y, r.width, r.height);
    out[r.name] = new Texture({
      source,
      frame,
      orig: new Rectangle(0, 0, r.origWidth, r.origHeight),
      trim: new Rectangle(r.offsetX, trimY, r.width, r.height),
      rotate: r.rotate ? 6 : 0,
      label: r.name,
    });
  }
  return out;
}
