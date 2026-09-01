import { expect, test } from 'vitest';

import { mount, settle } from '../../testing/index.js';

import './index.js';
import type { JellyCheckbox } from './index.js';

test('upgrades with a hidden native checkbox', async () => {
  const host = mount('<jelly-checkbox>Remember me</jelly-checkbox>');
  const el = host.querySelector('jelly-checkbox') as JellyCheckbox;

  await settle(3);
  expect(el.shadowRoot!.querySelector('input[type=checkbox]')).toBeInstanceOf(HTMLInputElement);

  host.remove();
});

test('reflects the checked attribute onto the inner input', async () => {
  const host = mount('<jelly-checkbox checked>x</jelly-checkbox>');
  const el = host.querySelector('jelly-checkbox') as JellyCheckbox;

  await settle(3);
  const input = el.shadowRoot!.querySelector('input') as HTMLInputElement;
  expect(input.checked).toBe(true);

  el.checked = false;
  await settle(2);
  expect(input.checked).toBe(false);

  host.remove();
});

test('a user toggle fires change and updates the attribute', async () => {
  const host = mount('<jelly-checkbox>x</jelly-checkbox>');
  const el = host.querySelector('jelly-checkbox') as JellyCheckbox;

  await settle(3);
  let fired = 0;
  el.addEventListener('change', () => { fired += 1; });

  const input = el.shadowRoot!.querySelector('input') as HTMLInputElement;
  input.click();

  expect(fired).toBe(1);
  expect(el.hasAttribute('checked')).toBe(true);

  host.remove();
});

test('checked mint variant paints the accent fill', async () => {
  const host = mount('<jelly-checkbox checked variant="mint">x</jelly-checkbox>');
  const el = host.querySelector('jelly-checkbox') as JellyCheckbox;

  await settle(12);
  const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
  const pixel = canvas.getContext('2d')!.getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data;

  // mint = #178746 = rgb(23, 135, 70)
  expect(Math.abs(pixel[0]! - 23)).toBeLessThan(10);
  expect(Math.abs(pixel[1]! - 135)).toBeLessThan(10);
  expect(Math.abs(pixel[2]! - 70)).toBeLessThan(10);

  host.remove();
});

test('participates in a form when checked', async () => {
  const host = mount('<form><jelly-checkbox name="agree" checked value="yes">x</jelly-checkbox></form>');
  await settle(3);

  const data = new FormData(host.querySelector('form') as HTMLFormElement);
  expect(data.get('agree')).toBe('yes');

  host.remove();
});
