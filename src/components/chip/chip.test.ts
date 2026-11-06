import { expect, test } from 'vitest';

import { mount, settle } from '../../testing/index.js';

import type { DropletChip } from './index.js';
import '../../testing/define-all.js';

test('a plain chip renders its label in a span', async () => {
  const host = mount('<droplet-chip>Design</droplet-chip>');
  const el = host.querySelector('droplet-chip') as DropletChip;

  await settle(3);
  expect(el.shadowRoot!.querySelector('span.main')).toBeTruthy();

  host.remove();
});

test('selectable chips toggle aria-pressed and fire change', async () => {
  const host = mount('<droplet-chip selectable>Filter</droplet-chip>');
  const el = host.querySelector('droplet-chip') as DropletChip;

  await settle(3);
  let changes = 0;
  el.addEventListener('change', () => { changes += 1; });

  const button = el.shadowRoot!.querySelector('button.main') as HTMLButtonElement;
  button.click();

  expect(el.selected).toBe(true);
  expect(button.getAttribute('aria-pressed')).toBe('true');
  expect(changes).toBe(1);

  host.remove();
});

test('removable chips fire a cancelable remove event', async () => {
  const host = mount('<droplet-chip removable>Dismiss</droplet-chip>');
  const el = host.querySelector('droplet-chip') as DropletChip;

  await settle(3);
  let removed = 0;
  el.addEventListener('remove', (event) => { removed += 1; event.preventDefault(); });

  (el.shadowRoot!.querySelector('.remove') as HTMLButtonElement).click();

  expect(removed).toBe(1);
  expect(el.isConnected).toBe(true);

  host.remove();
});
