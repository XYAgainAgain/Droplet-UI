// Packs the built library, installs the tarball into a scratch consumer, and checks
// every documented entry point from plain Node, strict TypeScript, and esbuild.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// Inside node_modules, which every checkout ignores and nothing else writes to here
const WORK = join(ROOT, 'node_modules', '.cache', 'droplet-package-smoke');
const APP = join(WORK, 'app');
const PKG = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));

// npm's own CLI script when npm launched the run; otherwise the shell, with every argument quoted
const npm = (args, cwd) => process.env.npm_execpath?.endsWith('.js')
  ? execFileSync(process.execPath, [process.env.npm_execpath, ...args], { cwd, encoding: 'utf8' })
  : execFileSync(['npm', ...args.map((arg) => JSON.stringify(arg))].join(' '), { cwd, encoding: 'utf8', shell: true });

before(() => {
  rmSync(WORK, { recursive: true, force: true });
  mkdirSync(APP, { recursive: true });
  const tarball = npm(['pack', '--pack-destination', WORK, '--silent'], ROOT).trim().split('\n').at(-1);
  writeFileSync(join(APP, 'package.json'), JSON.stringify({ name: 'smoke-app', private: true, type: 'module' }));
  npm(['install', join(WORK, tarball), '--no-audit', '--no-fund', '--offline', '--silent'], APP);
});

after(() => rmSync(WORK, { recursive: true, force: true }));

// The four code entries, plus a sample of the per-component subpaths
const ENTRIES = [
  'droplet-ui', 'droplet-ui/core', 'droplet-ui/register', 'droplet-ui/compat',
  'droplet-ui/button', 'droplet-ui/select', 'droplet-ui/tabs',
];

test('every documented entry point evaluates in plain Node and registers nothing', () => {
  const script = `
    const results = {};
    for (const entry of ${JSON.stringify(ENTRIES)}) {
      const mod = await import(entry);
      results[entry] = Object.keys(mod).length;
    }
    const root = await import('droplet-ui');
    results.defineAll = root.defineAll();
    const button = (await import('droplet-ui/button')).DropletButton;
    results.sameClass = (await import('droplet-ui/register')).DropletButton === button;
    results.legacyPathSameClass = [root, await import('droplet-ui/dist/jelly.js'), await import('droplet-ui/dist/droplet.js')].every((mod) => mod.DropletButton === button);
    results.compatExtends = (await import('droplet-ui/compat')).JellyButton.prototype instanceof root.DropletButton;
    console.log(JSON.stringify(results));
  `;
  const out = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', script], { cwd: APP, encoding: 'utf8' }));
  for (const entry of ENTRIES) assert.ok(out[entry] > 0, `${entry} exports something`);
  assert.deepEqual(out.defineAll, { defined: [], alreadyDefined: [], collisions: [] });
  assert.equal(out.sameClass, true, 'two entries share one class, not two copies');
  assert.equal(out.legacyPathSameClass, true, "Jelly UI's dist/jelly.js import joins the root's module graph");
  assert.equal(out.compatExtends, true);
});

test('the single-file bundle and its Jelly UI path ship beside the module tree', () => {
  const dist = join(APP, 'node_modules', 'droplet-ui', 'dist');
  assert.ok(readFileSync(join(dist, 'droplet.js'), 'utf8').length > 10000);
  assert.equal(readFileSync(join(dist, 'jelly.js'), 'utf8').trim(), "export * from './droplet.js';");
  assert.equal(PKG.exports['./dist/*'], './dist/*');
});

test('a strict TypeScript consumer type-checks against the published declarations', () => {
  writeFileSync(join(APP, 'consumer.ts'), `
    import { DropletElement, JellyElement, defineAll, type DropletConfig } from 'droplet-ui';
    import { DropletBody } from 'droplet-ui/core';
    import { defineButton, TAGS } from 'droplet-ui/register';
    import { JellyButton, defineCompat } from 'droplet-ui/compat';
    import { DropletSelect } from 'droplet-ui/select';
    const config: Partial<DropletConfig> = { pressure: 1 };
    const tag: string = TAGS.button;
    export const pieces = [DropletElement, JellyElement, defineAll, DropletBody, defineButton, JellyButton, defineCompat, DropletSelect, config, tag];
  `);
  writeFileSync(join(APP, 'tsconfig.json'), JSON.stringify({
    compilerOptions: { strict: true, noEmit: true, target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', lib: ['ES2022', 'DOM', 'DOM.Iterable'], skipLibCheck: false },
    files: ['consumer.ts'],
  }));
  execFileSync(process.execPath, [join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc'), '-p', APP], { cwd: APP, encoding: 'utf8' });
});

test('a non-Vite bundler (esbuild) bundles the package without its Vite-only imports', async () => {
  const esbuild = await import(pathToFileURL(join(ROOT, 'node_modules', 'esbuild', 'lib', 'main.js')).href);
  writeFileSync(join(APP, 'entry.js'), "import 'droplet-ui';\nimport { DropletButton } from 'droplet-ui/button';\nconsole.log(DropletButton.name);\n");
  writeFileSync(join(APP, 'button-only.js'), "import { DropletButton } from 'droplet-ui/button';\nconsole.log(DropletButton.name);\n");
  const bundle = async (entry, minify) => {
    const result = await esbuild.build({ entryPoints: [join(APP, entry)], bundle: true, minify, write: false, format: 'esm', absWorkingDir: APP, logLevel: 'silent' });
    assert.equal(result.errors.length, 0);
    return result.outputFiles[0].text;
  };
  const readable = await bundle('entry.js', false);
  assert.match(readable, /registerPreset\("feel", "gel"/, 'the built-in gel preset survives bundling');
  assert.match(readable, /defineAll\(\{ strict: false \}\);\s*defineCompat\(\);/, 'the root still registers');
  assert.ok((await bundle('button-only.js', true)).length < (await bundle('entry.js', true)).length / 2, 'a component subpath pulls in less than the whole library');
});
