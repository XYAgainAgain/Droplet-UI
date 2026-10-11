import { rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import type { EnvironmentOptions } from 'vite';
import dts from 'vite-plugin-dts';

// Each entry is its own environment and build pass: one multi-entry lib build would
// hoist what the entries share into a split chunk, and dist/droplet.js must stay one file.
function libEnvironment (name: string, entry: string, emptyOutDir: boolean): EnvironmentOptions {
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
      emptyOutDir,
    },
  };
}

// Jelly UI's bundle path keeps working as a re-export, so the code exists once;
// a vendored lone jelly.js now needs droplet.js beside it (migration page)
async function writeLegacyStub (): Promise<void> {
  const stub = "export * from './droplet.js';\n";

  await writeFile(resolve('dist/jelly.js'), stub);
  await writeFile(resolve('dist/jelly.d.ts'), stub);
}

export default defineConfig({
  environments: {
    register: libEnvironment('register', 'src/register.ts', true),
    core: libEnvironment('core', 'src/core/index.ts', false),
    compat: libEnvironment('compat', 'src/compat/index.ts', false),
    droplet: libEnvironment('droplet', 'src/droplet.ts', false),
  },
  builder: {
    buildApp: async (builder) => {
      // Watch mode returns from build() before anything is written, which the
      // rename below cannot survive, so it keeps the pre-fork single-entry shape.
      if (builder.config.build.watch) {
        await builder.build(builder.environments['droplet']!);
        await writeLegacyStub();
        return;
      }
      // vite-plugin-dts has no per-entry name for a bundled declaration: it writes
      // to package.json "types", so each pass yields dist/droplet.d.ts to rename.
      await builder.build(builder.environments['register']!);
      await rename(resolve('dist/droplet.d.ts'), resolve('dist/register.d.ts'));
      await builder.build(builder.environments['core']!);
      await rename(resolve('dist/droplet.d.ts'), resolve('dist/core.d.ts'));
      await builder.build(builder.environments['compat']!);
      await rename(resolve('dist/droplet.d.ts'), resolve('dist/compat.d.ts'));
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
