import { expect, test, vi } from 'vitest';

import { TAGS } from './registry/index.js';

test('importing any component module defines nothing', async () => {
  const modules = import.meta.glob('./components/*/index.ts');

  // Menu and tabs each hold two elements
  expect(Object.keys(modules)).toHaveLength(38);
  await Promise.all(Object.values(modules).map((load) => load()));

  for (const tag of Object.values(TAGS)) {
    expect(customElements.get(tag), tag).toBeUndefined();
  }
});

test('the root entry skips a library tag another constructor already owns', async () => {
  class ForeignButton extends HTMLElement {}

  customElements.define(TAGS.button, ForeignButton);

  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

  try {
    await import('./jelly.js');
    expect(warn).toHaveBeenCalledTimes(1);
  } finally {
    warn.mockRestore();
  }

  expect(customElements.get(TAGS.button)).toBe(ForeignButton);
  expect(customElements.get(TAGS.slider)).toBeTypeOf('function');
  expect(customElements.get(TAGS.tooltip)).toBeTypeOf('function');
});
