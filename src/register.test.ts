import { describe, it, expect } from 'vitest';
import { defineAll } from './register.js';

describe('defineAll', () => {
  it('is idempotent after the root import has already registered everything', async () => {
    await import('./jelly.js');
    const result = defineAll();
    expect(result.defined).toEqual([]);
    expect(result.collisions).toEqual([]);
    expect(result.alreadyDefined.length).toBeGreaterThan(0);
  });
});
