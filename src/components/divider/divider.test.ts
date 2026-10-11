import { expect, test } from 'vitest';

import { mount } from '../../testing/index.js';

import type { JellyDivider } from './index.js';
import '../../testing/define-all.js';

test('upgrades as a separator with a plain rule', () => {
  const host = mount('<jelly-divider></jelly-divider>');
  const el = host.querySelector('jelly-divider') as JellyDivider;

  expect(el.getAttribute('role')).toBe('separator');
  expect(el.shadowRoot!.querySelector('.line')).toBeTruthy();

  host.remove();
});

test('renders a labelled rule from slotted text', () => {
  const host = mount('<jelly-divider>or</jelly-divider>');
  const el = host.querySelector('jelly-divider') as JellyDivider;

  const labelled = el.shadowRoot!.querySelector('.labelled .label');
  expect(labelled?.textContent).toBe('or');

  host.remove();
});

test('vertical dividers expose aria-orientation', () => {
  const host = mount('<jelly-divider direction="vertical"></jelly-divider>');
  const el = host.querySelector('jelly-divider') as JellyDivider;

  expect(el.getAttribute('aria-orientation')).toBe('vertical');

  host.remove();
});
