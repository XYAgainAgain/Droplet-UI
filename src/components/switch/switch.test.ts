import { expect, test } from 'vitest';

import { mount, settle } from '../../testing/index.js';

import './index.js';
import type { JellySwitch } from './index.js';

test('upgrades with a role=switch native input', async () => {
  const host = mount('<jelly-switch>Wi-Fi</jelly-switch>');
  const el = host.querySelector('jelly-switch') as JellySwitch;

  await settle(3);
  const input = el.shadowRoot!.querySelector('input') as HTMLInputElement;
  expect(input.getAttribute('role')).toBe('switch');

  host.remove();
});

test('reflects checked onto the inner input and aria-checked', async () => {
  const host = mount('<jelly-switch checked>Wi-Fi</jelly-switch>');
  const el = host.querySelector('jelly-switch') as JellySwitch;

  await settle(3);
  const input = el.shadowRoot!.querySelector('input') as HTMLInputElement;
  expect(input.checked).toBe(true);
  expect(input.getAttribute('aria-checked')).toBe('true');

  host.remove();
});

test('clicking the label toggles and fires change', async () => {
  const host = mount('<jelly-switch>Wi-Fi</jelly-switch>');
  const el = host.querySelector('jelly-switch') as JellySwitch;

  await settle(3);
  let fired = 0;
  el.addEventListener('change', () => { fired += 1; });

  (el.shadowRoot!.querySelector('.label') as HTMLElement).click();

  expect(el.checked).toBe(true);
  expect(fired).toBe(1);

  host.remove();
});

test('on-state mint variant paints the mint track', async () => {
  const host = mount('<jelly-switch checked variant="mint">Wi-Fi</jelly-switch>');
  const el = host.querySelector('jelly-switch') as JellySwitch;

  await settle(16);
  const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
  // sample the left third of the track (the white thumb rests on the right when on)
  const pixel = canvas.getContext('2d')!.getImageData(Math.round(canvas.width * 0.32), Math.round(canvas.height * 0.5), 1, 1).data;

  expect(Math.abs(pixel[0]! - 23)).toBeLessThan(12);
  expect(Math.abs(pixel[1]! - 135)).toBeLessThan(12);
  expect(Math.abs(pixel[2]! - 70)).toBeLessThan(12);

  host.remove();
});

test('submits its value in a form when on', async () => {
  const host = mount('<form><jelly-switch name="wifi" value="on" checked>Wi-Fi</jelly-switch></form>');
  await settle(3);

  const data = new FormData(host.querySelector('form') as HTMLFormElement);
  expect(data.get('wifi')).toBe('on');

  host.remove();
});
