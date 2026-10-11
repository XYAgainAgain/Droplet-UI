import { expect, test } from 'vitest';

import { mount, settle } from '../../testing/index.js';

import type { DropletSpinner } from './index.js';
import '../../testing/define-all.js';

test('the default dots spinner renders gooey SVG and a status role', async () => {
  const host = mount('<droplet-spinner></droplet-spinner>');
  const el = host.querySelector('droplet-spinner') as DropletSpinner;

  await settle(3);
  expect(el.getAttribute('role')).toBe('status');
  expect(el.getAttribute('aria-label')).toBe('Loading');
  expect(el.shadowRoot!.querySelector('svg.dots')).toBeTruthy();

  host.remove();
});

test('the blob spinner paints on the canvas', async () => {
  const host = mount('<droplet-spinner type="blob"></droplet-spinner>');
  const el = host.querySelector('droplet-spinner') as DropletSpinner;

  await settle();
  expect(el.shadowRoot!.querySelector('svg.dots')).toBeNull();
  expect(el.shadowRoot!.querySelector('canvas')).toBeInstanceOf(HTMLCanvasElement);

  host.remove();
});
