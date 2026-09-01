import { expect, test } from 'vitest';

import { mount, settle } from '../../testing/index.js';

import './index.js';
import type { JellyBadge } from './index.js';

test('upgrades and renders its slotted content', async () => {
  const host = mount('<jelly-badge>3</jelly-badge>');
  const el = host.querySelector('jelly-badge') as JellyBadge;

  await settle(3);
  expect(el.shadowRoot!.querySelector('.badge')).toBeTruthy();
  expect(el.textContent).toBe('3');

  host.remove();
});

test('variant="mint" paints the mint fill', async () => {
  const host = mount('<jelly-badge variant="mint">Live</jelly-badge>');
  const el = host.querySelector('jelly-badge') as JellyBadge;

  await settle(12);
  const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
  const pixel = canvas.getContext('2d')!.getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data;

  expect(Math.abs(pixel[0]! - 23)).toBeLessThan(10);
  expect(Math.abs(pixel[1]! - 135)).toBeLessThan(10);
  expect(Math.abs(pixel[2]! - 70)).toBeLessThan(10);

  host.remove();
});

test('live badges expose a polite status region', async () => {
  const host = mount('<jelly-badge live>0</jelly-badge>');
  const el = host.querySelector('jelly-badge') as JellyBadge;

  await settle(3);
  expect(el.getAttribute('role')).toBe('status');
  expect(el.getAttribute('aria-live')).toBe('polite');

  host.remove();
});
