import assert from 'node:assert/strict';
import test from 'node:test';

import { documentationWarningsFailBuild } from './docs-drift.mjs';

test('allows up to three documentation warnings', () => {
  for (const count of [0, 1, 2, 3]) {
    assert.equal(documentationWarningsFailBuild(count), false);
  }
});

test('fails at four documentation warnings', () => {
  assert.equal(documentationWarningsFailBuild(4), true);
});
