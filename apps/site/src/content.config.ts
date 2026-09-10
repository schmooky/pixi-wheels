import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const recipes = defineCollection({
  loader: glob({ pattern: '*.mdx', base: './src/content/recipes' }),
  schema: z.object({
    title: z.string(),
    group: z.string(),
    oneLiner: z.string().default(''),
    description: z.string().optional(),
    order: z.number().default(0),
    tags: z.array(z.string()).default([]),
    image: z.string().optional(),
  }),
});

const guides = defineCollection({
  loader: glob({ pattern: '*.mdx', base: './src/content/guides' }),
  schema: z.object({
    title: z.string(),
    eyebrow: z.string().optional(),
    description: z.string().optional(),
    order: z.number().default(0),
  }),
});

const docs = defineCollection({
  loader: glob({ pattern: '*.mdx', base: './src/content/docs' }),
  schema: z.object({
    title: z.string(),
    eyebrow: z.string().optional(),
    description: z.string().optional(),
    order: z.number().default(0),
  }),
});

export const collections = { recipes, guides, docs };
