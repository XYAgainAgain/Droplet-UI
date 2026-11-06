import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// One ES module per source module, so every package entry shares one copy of each class;
// preserveModules emits only reachable modules, so each component directory is an entry
const components = Object.fromEntries(
  readdirSync('src/components', { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => [`components/${entry.name}/index`, resolve('src/components', entry.name, 'index.ts')]),
);

export default defineConfig({
  build: {
    outDir: 'dist/esm',
    emptyOutDir: true,
    target: 'es2022',
    minify: false,
    sourcemap: true,
    lib: {
      entry: {
        droplet: resolve('src/droplet.ts'),
        register: resolve('src/register.ts'),
        experimental: resolve('src/experimental.ts'),
        'core/index': resolve('src/core/index.ts'),
        'compat/index': resolve('src/compat/index.ts'),
        ...components,
      },
      formats: ['es'],
    },
    rolldownOptions: {
      output: {
        preserveModules: true,
        preserveModulesRoot: 'src',
        entryFileNames: '[name].js',
      },
    },
  },
});
