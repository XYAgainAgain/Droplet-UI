import { mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import type { EnvironmentOptions } from 'vite';
import dts from 'vite-plugin-dts';

// The single-file bundle for script tags and vendoring; the package entries resolve
// to the module tree vite.esm.config.ts builds into dist/esm.
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

// Jelly UI's bundle path keeps working as a re-export, so the code exists once;
// a vendored lone jelly.js now needs droplet.js beside it (migration page)
async function writeLegacyStub (): Promise<void> {
  const stub = "export * from './droplet.js';\n";

  await mkdir(resolve('dist'), { recursive: true });
  await writeFile(resolve('dist/jelly.js'), stub);
  await writeFile(resolve('dist/jelly.d.ts'), stub);
}

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
