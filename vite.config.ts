import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

/*
 * Library build. Everything is bundled into a single ES module (the library
 * ships zero runtime dependencies), so the same dist/jelly.js works both as an
 * npm entry point and as a <script type="module"> from a CDN. CSS and SVG are
 * pulled in through ?inline / ?raw imports and inlined into the bundle at build
 * time, which keeps the authored source free of inline CSS-in-JS.
 *
 * Test config lives in vitest.config.ts.
 */
export default defineConfig({
  build: {
    target: 'es2022',
    lib: {
      entry: 'src/jelly.ts',
      formats: ['es'],
      fileName: () => 'jelly.js',
    },
    sourcemap: true,
    cssMinify: 'esbuild',
  },
  plugins: [
    dts({
      bundleTypes: {
        invokeOptions: {
          typescriptCompilerFolder: resolve('node_modules/@microsoft/api-extractor/node_modules/typescript'),
        },
      },
      tsconfigPath: './tsconfig.json',
    }),
  ],
});
