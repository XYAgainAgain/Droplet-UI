import { expect, test } from 'vitest';

import { mount, settle } from '../../testing/index.js';

import { defineAll } from '../../register.js';
import type { JellySlider } from './index.js';

defineAll({ strict: false });

test('upgrades with a native range input', async () => {
  const host = mount('<jelly-slider value="40"></jelly-slider>');
  const el = host.querySelector('jelly-slider') as JellySlider;

  await settle(3);
  const input = el.shadowRoot!.querySelector('input') as HTMLInputElement;
  expect(input.type).toBe('range');
  expect(input.value).toBe('40');

  host.remove();
});

test('arrow keys step the value and fire input', async () => {
  const host = mount('<jelly-slider value="40" min="0" max="100" step="5"></jelly-slider>');
  const el = host.querySelector('jelly-slider') as JellySlider;

  await settle(3);
  let inputs = 0;
  el.addEventListener('input', () => { inputs += 1; });

  const input = el.shadowRoot!.querySelector('input') as HTMLInputElement;
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));

  expect(input.value).toBe('45');
  expect(inputs).toBeGreaterThan(0);

  host.remove();
});

test('the value property reads and writes the inner input', async () => {
  const host = mount('<jelly-slider value="10"></jelly-slider>');
  const el = host.querySelector('jelly-slider') as JellySlider;

  await settle(3);
  expect(el.value).toBe('10');

  el.value = '75';
  expect((el.shadowRoot!.querySelector('input') as HTMLInputElement).value).toBe('75');

  host.remove();
});

test('participates in a form', async () => {
  const host = mount('<form><jelly-slider name="vol" value="30"></jelly-slider></form>');
  await settle(3);

  const data = new FormData(host.querySelector('form') as HTMLFormElement);
  expect(data.get('vol')).toBe('30');

  host.remove();
});
