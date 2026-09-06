import { expect, test } from 'vitest';

test('importing a pilot module defines nothing', async () => {
  const { JellyButton } = await import('./components/button/index.js');

  expect(typeof JellyButton).toBe('function');
  expect(customElements.get('jelly-button')).toBeUndefined();
});

test('the root entry skips a pilot tag another constructor already owns', async () => {
  class ForeignButton extends HTMLElement {}

  customElements.define('jelly-button', ForeignButton);

  await import('./jelly.js');

  expect(customElements.get('jelly-button')).toBe(ForeignButton);
  expect(customElements.get('jelly-slider')).toBeTypeOf('function');
});
