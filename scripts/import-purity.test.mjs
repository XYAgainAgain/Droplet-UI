import { test } from 'node:test';
import assert from 'node:assert/strict';

test('dist/core.js evaluates in plain Node', async () => {
  assert.equal(typeof globalThis.document, 'undefined');
  const mod = await import('../dist/core.js');
  assert.equal(typeof mod.DropletBody, 'function');
  assert.equal(typeof mod.traceSmoothPath, 'function');
});

test('dist/register.js evaluates in plain Node and defines nothing', async () => {
  assert.equal(typeof globalThis.customElements, 'undefined');
  const { defineAll } = await import('../dist/register.js');
  const result = defineAll();
  assert.deepEqual(result, { defined: [], alreadyDefined: [], collisions: [] });
});

test('dist/droplet.js, the whole library, evaluates in plain Node', async () => {
  assert.equal(typeof globalThis.customElements, 'undefined');
  const mod = await import('../dist/droplet.js');
  assert.equal(typeof mod.DropletElement, 'function');
  assert.equal(mod.JellyElement, mod.DropletElement);
  assert.deepEqual(mod.defineAll(), { defined: [], alreadyDefined: [], collisions: [] });
  assert.deepEqual(mod.defineCompat(), { defined: [], alreadyDefined: [], collisions: [] });
});

test('dist/compat.js evaluates in plain Node and defines nothing', async () => {
  const { defineCompat, JellyButton } = await import('../dist/compat.js');
  assert.equal(typeof JellyButton, 'function');
  assert.deepEqual(defineCompat(), { defined: [], alreadyDefined: [], collisions: [] });
});

test('dist/jelly.js stays Jelly UI\'s bundle path as a thin re-export of droplet.js', async () => {
  const { readFile } = await import('node:fs/promises');
  const stub = await readFile(new URL('../dist/jelly.js', import.meta.url), 'utf8');
  assert.equal(stub.trim(), "export * from './droplet.js';");
  const legacy = await import('../dist/jelly.js');
  const canonical = await import('../dist/droplet.js');
  assert.equal(legacy.DropletElement, canonical.DropletElement);
  assert.equal(legacy.JellyElement, canonical.DropletElement);
});
