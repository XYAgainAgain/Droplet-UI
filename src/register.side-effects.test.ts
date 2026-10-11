import { expect, test, vi } from 'vitest';

import { LEGACY_TAGS, TAGS } from './registry/index.js';

test('importing any component module defines nothing', async () => {
  const modules = import.meta.glob('./components/*/index.ts');

  // Menu and tabs each hold two elements
  expect(Object.keys(modules)).toHaveLength(38);
  await Promise.all(Object.values(modules).map((load) => load()));

  for (const tag of [...Object.values(TAGS), ...Object.values(LEGACY_TAGS)]) {
    expect(customElements.get(tag), tag).toBeUndefined();
  }
});

test('the root entry skips a library tag another constructor already owns', async () => {
  class ForeignButton extends HTMLElement {}
  class ForeignLegacySlider extends HTMLElement {}

  customElements.define(TAGS.button, ForeignButton);
  customElements.define(LEGACY_TAGS.slider, ForeignLegacySlider);

  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

  try {
    await import('./droplet.js');
    expect(warn).toHaveBeenCalledTimes(2);
  } finally {
    warn.mockRestore();
  }

  expect(customElements.get(TAGS.button)).toBe(ForeignButton);
  expect(customElements.get(LEGACY_TAGS.slider)).toBe(ForeignLegacySlider);
  expect(customElements.get(LEGACY_TAGS.button)).toBeTypeOf('function');
  expect(customElements.get(TAGS.slider)).toBeTypeOf('function');
  expect(customElements.get(TAGS.tooltip)).toBeTypeOf('function');
});
