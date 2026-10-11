import { expect, test } from 'vitest';

import { mount, settle } from '../../testing/index.js';

import type { JellyLabel } from './index.js';
import '../../testing/define-all.js';

test('renders a label with a required marker', () => {
  const host = mount('<jelly-label required>Email</jelly-label>');
  const el = host.querySelector('jelly-label') as JellyLabel;

  expect(el.shadowRoot!.querySelector('label')).toBeTruthy();
  expect(el.shadowRoot!.querySelector('.required')?.textContent).toBe('*');

  host.remove();
});

test('gives its `for` target an accessible name across shadow roots', async () => {
  const host = mount('<jelly-label for="email">Email</jelly-label><jelly-input id="email"></jelly-input>');
  await settle(3);

  const input = host.querySelector('jelly-input')!;
  expect(input.getAttribute('label')).toBe('Email');

  host.remove();
});
