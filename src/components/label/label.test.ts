import { expect, test } from 'vitest';

import { mount, settle } from '../../testing/index.js';

import type { DropletLabel } from './index.js';
import '../../testing/define-all.js';

test('renders a label with a required marker', () => {
  const host = mount('<droplet-label required>Email</droplet-label>');
  const el = host.querySelector('droplet-label') as DropletLabel;

  expect(el.shadowRoot!.querySelector('label')).toBeTruthy();
  expect(el.shadowRoot!.querySelector('.required')?.textContent).toBe('*');

  host.remove();
});

test('gives its `for` target an accessible name across shadow roots', async () => {
  const host = mount('<droplet-label for="email">Email</droplet-label><droplet-input id="email"></droplet-input>');
  await settle(3);

  const input = host.querySelector('droplet-input')!;
  expect(input.getAttribute('label')).toBe('Email');

  host.remove();
});
