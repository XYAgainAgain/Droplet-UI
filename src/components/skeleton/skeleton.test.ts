import { expect, test } from 'vitest';

import { mount, settle } from '../../testing/index.js';

import type { JellySkeleton } from './index.js';
import '../../testing/define-all.js';

test('upgrades as a busy status placeholder with a canvas', async () => {
  const host = mount('<jelly-skeleton></jelly-skeleton>');
  const el = host.querySelector('jelly-skeleton') as JellySkeleton;

  await settle(3);
  expect(el.getAttribute('role')).toBe('status');
  expect(el.getAttribute('aria-busy')).toBe('true');
  expect(el.getAttribute('aria-label')).toBe('Loading');
  expect(el.shadowRoot!.querySelector('canvas')).toBeInstanceOf(HTMLCanvasElement);

  host.remove();
});
