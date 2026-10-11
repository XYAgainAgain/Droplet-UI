import { expect, test } from 'vitest';

import { mount } from '../../testing/index.js';

import type { DropletOption } from './index.js';
import '../../testing/define-all.js';

test('derives value from the attribute or the text content', () => {
  const host = mount('<droplet-option value="pro">Pro plan</droplet-option><droplet-option>Basic</droplet-option>');
  const [withValue, textOnly] = [...host.querySelectorAll('droplet-option')] as [DropletOption, DropletOption];

  expect(withValue.value).toBe('pro');
  expect(withValue.label).toBe('Pro plan');
  expect(textOnly.value).toBe('Basic');

  host.remove();
});

test('reflects the disabled state', () => {
  const host = mount('<droplet-option disabled>Nope</droplet-option>');
  const el = host.querySelector('droplet-option') as DropletOption;

  expect(el.disabled).toBe(true);

  host.remove();
});
