import { expect, test } from 'vitest';

import { mount, settle } from '../../testing/index.js';

import type { JellyChip } from './index.js';
import '../../testing/define-all.js';

test('a plain chip renders its label in a span', async () => {
  const host = mount('<jelly-chip>Design</jelly-chip>');
  const el = host.querySelector('jelly-chip') as JellyChip;

  await settle(3);
  expect(el.shadowRoot!.querySelector('span.main')).toBeTruthy();

  host.remove();
});

test('selectable chips toggle aria-pressed and fire change', async () => {
  const host = mount('<jelly-chip selectable>Filter</jelly-chip>');
  const el = host.querySelector('jelly-chip') as JellyChip;

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
  const host = mount('<jelly-chip removable>Dismiss</jelly-chip>');
  const el = host.querySelector('jelly-chip') as JellyChip;

  await settle(3);
  let removed = 0;
  el.addEventListener('remove', (event) => { removed += 1; event.preventDefault(); });

  (el.shadowRoot!.querySelector('.remove') as HTMLButtonElement).click();

  expect(removed).toBe(1);
  expect(el.isConnected).toBe(true); // preventDefault cancelled the removal

  host.remove();
});
