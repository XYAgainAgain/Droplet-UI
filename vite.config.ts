import { mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import type { EnvironmentOptions } from 'vite';
import dts from 'vite-plugin-dts';

// The single-file bundle for script tags; package entries use vite.esm.config.ts's dist/esm
function libEnvironment (name: string, entry: string): EnvironmentOptions {
  return {
    consumer: 'client',
    build: {
      target: 'es2022',
      lib: {
        entry,
        formats: ['es'],
        fileName: () => `${name}.js`,
      },
      sourcemap: true,
      cssMinify: 'esbuild',
      emptyOutDir: false,
    },
  };
}

// jelly.js re-exports droplet.js, so a vendored jelly.js needs droplet.js beside it
async function writeLegacyStub (): Promise<void> {
  const stub = "export * from './droplet.js';\n";

  await mkdir(resolve('dist'), { recursive: true });
  await writeFile(resolve('dist/jelly.js'), stub);
  await writeFile(resolve('dist/jelly.d.ts'), stub);
}

// Watch mode skips declarations: writing dist/src retriggers the watcher forever
const watching = process.argv.includes('--watch') || process.argv.includes('-w');

export default defineConfig({
  environments: {
    droplet: libEnvironment('droplet', 'src/droplet.ts'),
  },
  builder: {
    buildApp: async (builder) => {
      // The module tree and the stub share dist, so it is cleared once per full build
      if (!builder.config.build.watch) {
        await rm(resolve('dist'), { recursive: true, force: true, maxRetries: 5 });
      }
      await builder.build(builder.environments['droplet']!);
      await writeLegacyStub();
    },
  },
  plugins: watching ? [] : [
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
