import { expect, test } from 'vitest';

import { mount } from '../../testing/index.js';

import type { DropletDivider } from './index.js';
import '../../testing/define-all.js';

test('upgrades as a separator with a plain rule', () => {
  const host = mount('<droplet-divider></droplet-divider>');
  const el = host.querySelector('droplet-divider') as DropletDivider;

  expect(el.getAttribute('role')).toBe('separator');
  expect(el.shadowRoot!.querySelector('.line')).toBeTruthy();

  host.remove();
});

test('renders a labelled rule from slotted text', () => {
  const host = mount('<droplet-divider>or</droplet-divider>');
  const el = host.querySelector('droplet-divider') as DropletDivider;

  const labelled = el.shadowRoot!.querySelector('.labelled .label');
  expect(labelled?.textContent).toBe('or');

  host.remove();
});

test('vertical dividers expose aria-orientation', () => {
  const host = mount('<droplet-divider direction="vertical"></droplet-divider>');
  const el = host.querySelector('droplet-divider') as DropletDivider;

  expect(el.getAttribute('aria-orientation')).toBe('vertical');

  host.remove();
});
