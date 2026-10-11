import { expect, test } from 'vitest';

import { mount, settle } from '../../testing/index.js';

import type { DropletProgress } from './index.js';
import '../../testing/define-all.js';

test('upgrades as a progressbar and mirrors value into ARIA', async () => {
  const host = mount('<droplet-progress value="60" max="100"></droplet-progress>');
  const el = host.querySelector('droplet-progress') as DropletProgress;

  await settle(3);
  expect(el.getAttribute('role')).toBe('progressbar');
  expect(el.getAttribute('aria-valuenow')).toBe('60');
  expect(el.value).toBe(60);

  host.remove();
});

test('setting the value property updates aria-valuenow', async () => {
  const host = mount('<droplet-progress value="10"></droplet-progress>');
  const el = host.querySelector('droplet-progress') as DropletProgress;

  await settle(3);
  el.value = 80;
  expect(el.getAttribute('aria-valuenow')).toBe('80');

  host.remove();
});

test('indeterminate bars expose a busy value text', async () => {
  const host = mount('<droplet-progress indeterminate></droplet-progress>');
  const el = host.querySelector('droplet-progress') as DropletProgress;

  await settle(3);
  expect(el.getAttribute('aria-valuetext')).toBe('Loading…');
  expect(el.hasAttribute('aria-valuenow')).toBe(false);

  host.remove();
});
