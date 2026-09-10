#!/usr/bin/env node
/**
 * Generate `public/llms.txt`: every guide, API page and recipe (with its
 * source) in one text file an LLM can fetch to learn the whole library.
 * Deterministic output: stable order, no timestamp; the version line is the
 * freshness signal. Runs from `pnpm llms:gen` (predev / prebuild).
 */
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT = resolve(ROOT, 'src/content');
const RECIPES_SRC = resolve(ROOT, 'src/recipes');
const PKG = resolve(ROOT, '../../packages/pixi-wheels/package.json');
const OUT = resolve(ROOT, 'public/llms.txt');
const SITE_URL = 'https://pixi-wheels.schmooky.dev';

function frontmatter(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: raw };
  const data = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*"?(.*?)"?\s*$/);
    if (kv) data[kv[1]] = kv[2];
  }
  return { data, body: m[2] };
}

async function collection(name) {
  const dir = join(CONTENT, name);
  const files = (await readdir(dir)).filter((f) => f.endsWith('.mdx')).sort();
  const out = [];
  for (const f of files) {
    const raw = await readFile(join(dir, f), 'utf8');
    const { data, body } = frontmatter(raw);
    out.push({ slug: f.replace(/\.mdx$/, ''), title: data.title ?? f, description: data.description ?? data.oneLiner ?? '', body });
  }
  return out;
}

const pkg = JSON.parse(await readFile(PKG, 'utf8'));
const guides = await collection('guides');
const docs = await collection('docs');
const recipes = await collection('recipes');
const recipeFiles = (await readdir(RECIPES_SRC)).filter((f) => f.endsWith('.recipe.ts')).sort();

const lines = [];
lines.push(`# pixi-wheels`, '');
lines.push(`pixi-wheels ${pkg.version} is a bonus wheel engine for PixiJS v8.`);
lines.push('Fluent builder, typed events, velocity-matched planned stops, anticipation (creep / stutter / overshoot), dynamic sectors, rings, pointers with flap physics, idle spin, texture and Spine skins, a headless testing harness.');
lines.push('Outcome math, RTP and audio live in consumer code: the wheel lands where `setResult()` says.', '');
lines.push(`Site: ${SITE_URL}`, 'Repo: https://github.com/schmooky/pixi-wheels', 'Package: https://www.npmjs.com/package/pixi-wheels', '');
lines.push('## Quick start', '', '```ts', "import { WheelBuilder, SpinPresets } from 'pixi-wheels';", '', 'const wheel = new WheelBuilder()', "  .radius(240, 36)", "  .sections([{ id: 'x2', value: 2, weight: 3 }, { id: 'x5', value: 5, weight: 2 }, { id: 'x10', value: 10 }])", "  .speed('normal', SpinPresets.NORMAL)", '  .ticker(app.ticker)', '  .build();', 'app.stage.addChild(wheel);', 'const spin = wheel.spin();', "wheel.setResult({ value: 5 }, { anticipation: { bait: 'x10' } });", 'await spin;', '```', '');

lines.push('## Guides', '');
for (const g of guides) {
  lines.push(`### ${g.title}`, `URL: ${SITE_URL}/guides/${g.slug}/`, '', g.body.trim(), '');
}
lines.push('## API guides', '');
for (const d of docs) {
  lines.push(`### ${d.title}`, `URL: ${SITE_URL}/docs/${d.slug}/`, '', d.body.trim(), '');
}
lines.push('## Recipes', '');
for (const r of recipes) {
  lines.push(`### ${r.title}`, `URL: ${SITE_URL}/recipes/${r.slug}/`, '', r.description, '');
  const demos = [...r.body.matchAll(/<RecipeDemo code="([^"]+)"/g)].map((m) => m[1]);
  for (const code of demos) {
    const file = `${code}.recipe.ts`;
    if (!recipeFiles.includes(file)) continue;
    const src = await readFile(join(RECIPES_SRC, file), 'utf8');
    lines.push(`#### ${code}`, '', '```ts', src.trim(), '```', '');
  }
}
await writeFile(OUT, lines.join('\n') + '\n');
console.log(`llms.txt: ${guides.length} guides, ${docs.length} docs, ${recipes.length} recipe pages, ${recipeFiles.length} recipe sources`);
