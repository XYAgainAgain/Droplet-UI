import { test } from 'node:test';
import assert from 'node:assert/strict';

const EMPTY = { defined: [], alreadyDefined: [], collisions: [] };

test('the core entry evaluates in plain Node', async () => {
  assert.equal(typeof globalThis.document, 'undefined');
  const mod = await import('../dist/esm/core/index.js');
  assert.equal(typeof mod.DropletBody, 'function');
  assert.equal(typeof mod.traceSmoothPath, 'function');
});

test('the register entry evaluates in plain Node and defines nothing', async () => {
  assert.equal(typeof globalThis.customElements, 'undefined');
  const { defineAll } = await import('../dist/esm/register.js');
  assert.deepEqual(defineAll(), EMPTY);
});

test('the root entry and the single-file bundle evaluate in plain Node', async () => {
  for (const path of ['../dist/esm/droplet.js', '../dist/droplet.js']) {
    const mod = await import(path);
    assert.equal(typeof mod.DropletElement, 'function', path);
    assert.equal(mod.JellyElement, mod.DropletElement, path);
    assert.deepEqual(mod.defineAll(), EMPTY, path);
    assert.deepEqual(mod.defineCompat(), EMPTY, path);
  }
});

test('the compat entry evaluates in plain Node and defines nothing', async () => {
  const { defineCompat, JellyButton } = await import('../dist/esm/compat/index.js');
  assert.equal(typeof JellyButton, 'function');
  assert.deepEqual(defineCompat(), EMPTY);
});

test('every component entry evaluates in plain Node', async () => {
  const { readdirSync } = await import('node:fs');
  const dirs = readdirSync(new URL('../src/components', import.meta.url), { withFileTypes: true }).filter((d) => d.isDirectory());
  assert.ok(dirs.length > 0);
  for (const dir of dirs) {
    const mod = await import(`../dist/esm/components/${dir.name}/index.js`);
    assert.ok(Object.keys(mod).length > 0, dir.name);
  }
});

test("dist/jelly.js stays Jelly UI's bundle path as a thin re-export of droplet.js", async () => {
  const { readFile } = await import('node:fs/promises');
  const stub = await readFile(new URL('../dist/jelly.js', import.meta.url), 'utf8');
  assert.equal(stub.trim(), "export * from './droplet.js';");
  const legacy = await import('../dist/jelly.js');
  const canonical = await import('../dist/droplet.js');
  assert.equal(legacy.DropletElement, canonical.DropletElement);
  assert.equal(legacy.JellyElement, canonical.DropletElement);
});
