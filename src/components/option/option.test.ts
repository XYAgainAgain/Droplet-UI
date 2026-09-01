import { expect, test } from 'vitest';

import { mount } from '../../testing/index.js';

import './index.js';
import type { JellyOption } from './index.js';

test('derives value from the attribute or the text content', () => {
  const host = mount('<jelly-option value="pro">Pro plan</jelly-option><jelly-option>Basic</jelly-option>');
  const [withValue, textOnly] = [...host.querySelectorAll('jelly-option')] as [JellyOption, JellyOption];

  expect(withValue.value).toBe('pro');
  expect(withValue.label).toBe('Pro plan');
  expect(textOnly.value).toBe('Basic');

  host.remove();
});

test('reflects the disabled state', () => {
  const host = mount('<jelly-option disabled>Nope</jelly-option>');
  const el = host.querySelector('jelly-option') as JellyOption;

  expect(el.disabled).toBe(true);

  host.remove();
});
