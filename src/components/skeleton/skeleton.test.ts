import { expect, test } from 'vitest';

import { mount, settle } from '../../testing/index.js';

import type { DropletSkeleton } from './index.js';
import '../../testing/define-all.js';

test('upgrades as a busy status placeholder with a canvas', async () => {
  const host = mount('<droplet-skeleton></droplet-skeleton>');
  const el = host.querySelector('droplet-skeleton') as DropletSkeleton;

  await settle(3);
  expect(el.getAttribute('role')).toBe('status');
  expect(el.getAttribute('aria-busy')).toBe('true');
  expect(el.getAttribute('aria-label')).toBe('Loading');
  expect(el.shadowRoot!.querySelector('canvas')).toBeInstanceOf(HTMLCanvasElement);

  host.remove();
});
