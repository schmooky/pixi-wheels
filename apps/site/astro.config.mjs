import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { rehypeHeadingIds } from '@astrojs/markdown-remark';
import { rehypeHeadingAnchors } from './src/lib/rehypeHeadingAnchors.mjs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const here = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = resolve(here, '../..');

// https://astro.build/config
export default defineConfig({
  site: 'https://pixi-wheels.schmooky.dev',
  prefetch: {
    defaultStrategy: 'hover',
    prefetchAll: false,
  },
  markdown: {
    // `rehypeHeadingIds` runs first so the anchor plugin finds an id to link to.
    rehypePlugins: [rehypeHeadingIds, rehypeHeadingAnchors],
  },
  integrations: [mdx(), react()],
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: [
        // The site always builds against THIS checkout's library source, never a
        // published version. Subpaths first so they win over the bare alias.
        { find: /^pixi-wheels\/spine$/, replacement: resolve(repoRoot, 'packages/pixi-wheels/src/spine/index.ts') },
        { find: /^pixi-wheels\/testing$/, replacement: resolve(repoRoot, 'packages/pixi-wheels/src/testing/index.ts') },
        { find: /^pixi-wheels$/, replacement: resolve(repoRoot, 'packages/pixi-wheels/src/index.ts') },
        { find: '@', replacement: resolve(here, 'src') },
      ],
      dedupe: ['react', 'react-dom', 'pixi.js', '@esotericsoftware/spine-pixi-v8'],
    },
    ssr: { noExternal: ['pixi-wheels'] },
    server: { fs: { allow: [repoRoot] } },
  },
});
