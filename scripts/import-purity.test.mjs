import { test } from 'node:test';
import assert from 'node:assert/strict';

test('dist/core.js evaluates in plain Node', async () => {
  assert.equal(typeof globalThis.document, 'undefined');
  const mod = await import('../dist/core.js');
  assert.equal(typeof mod.JellyBody, 'function');
  assert.equal(typeof mod.traceSmoothPath, 'function');
});

test('dist/register.js evaluates in plain Node and defines nothing', async () => {
  assert.equal(typeof globalThis.customElements, 'undefined');
  const { defineAll } = await import('../dist/register.js');
  const result = defineAll();
  assert.deepEqual(result, { defined: [], alreadyDefined: [], collisions: [] });
});
