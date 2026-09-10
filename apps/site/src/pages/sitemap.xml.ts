import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { SITE } from '../lib/seo.ts';

const STATIC = ['/', '/guides/', '/recipes/', '/docs/', '/studio/', '/changelog/', '/api/'];

export const GET: APIRoute = async () => {
  const [recipes, guides, docs] = await Promise.all([getCollection('recipes'), getCollection('guides'), getCollection('docs')]);
  const urls = [
    ...STATIC,
    ...recipes.map((r) => `/recipes/${r.id}/`),
    ...guides.map((g) => `/guides/${g.id}/`),
    ...docs.map((d) => `/docs/${d.id}/`),
  ];
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((u) => `  <url><loc>${new URL(u, SITE.url).toString()}</loc></url>`)
    .join('\n')}\n</urlset>\n`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
