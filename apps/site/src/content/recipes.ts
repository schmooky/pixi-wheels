export type RecipeGroup = 'starters' | 'landing' | 'tension' | 'shapes' | 'presentation' | 'integration';

export interface RecipeMeta {
  slug: string;
  group: RecipeGroup;
  title: string;
  oneLiner: string;
  tags: string[];
  image?: string;
}

/** Display order + label for each group on the /recipes/ index page. */
export const RECIPE_GROUPS: Array<{ id: RecipeGroup; label: string; description: string }> = [
  { id: 'starters', label: 'Start here', description: 'A wheel in ten lines, the gamble wheel, and the templates.' },
  { id: 'landing', label: 'Stopping', description: 'Where the pointer ends up: exact angles, centring, bounce, skip.' },
  { id: 'tension', label: 'Anticipation', description: 'Near-misses that bait the player: creep, stutter, stall, protected skips.' },
  { id: 'shapes', label: 'Sections, rings and states', description: 'Dynamic sectors that move, rings that spin each other, idle wheels beside the reels.' },
  { id: 'presentation', label: 'Skins and assets', description: 'Painted, textured and Spine wheels with studio art. Pointers that flap.' },
  { id: 'integration', label: 'Server, events and debugging', description: 'Adapters for real responses, sound hooks, the debug view.' },
];

import { parse } from 'yaml';

const recipeFiles = import.meta.glob<string>('./recipes/*.mdx', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const GROUP_RANK = new Map(RECIPE_GROUPS.map((g, i) => [g.id, i]));

interface RecipeFrontmatter {
  title: string;
  group: RecipeGroup;
  oneLiner: string;
  order?: number;
  tags?: string[];
  image?: string;
}

function readFrontmatter(path: string, raw: string): RecipeFrontmatter {
  const m = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!m) throw new Error(`Recipe ${path} has no frontmatter`);
  return parse(m[1]) as RecipeFrontmatter;
}

export const RECIPES: RecipeMeta[] = Object.entries(recipeFiles)
  .map(([path, raw]) => {
    const fm = readFrontmatter(path, raw);
    const meta: RecipeMeta = {
      slug: path.replace(/^.*\//, '').replace(/\.mdx$/, ''),
      group: fm.group,
      title: fm.title,
      oneLiner: fm.oneLiner,
      tags: fm.tags ?? [],
    };
    if (fm.image) meta.image = fm.image;
    return { meta, order: fm.order ?? 0 };
  })
  .sort((a, b) => {
    const g = (GROUP_RANK.get(a.meta.group) ?? 99) - (GROUP_RANK.get(b.meta.group) ?? 99);
    return g !== 0 ? g : a.order - b.order;
  })
  .map((r) => r.meta);
