import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    dts({
      include: ['src/**/*.ts'],
      outDir: resolve(__dirname, 'dist'),
    }),
  ],
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        // `import { SpineRingSkin } from 'pixi-wheels/spine'`
        spine: resolve(__dirname, 'src/spine/index.ts'),
        // `import { createTestWheel } from 'pixi-wheels/testing'`
        testing: resolve(__dirname, 'src/testing/index.ts'),
      },
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      external: ['pixi.js', '@esotericsoftware/spine-pixi-v8'],
    },
    sourcemap: true,
    outDir: resolve(__dirname, 'dist'),
  },
});
