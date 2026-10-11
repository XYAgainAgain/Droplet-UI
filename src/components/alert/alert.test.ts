import { expect, test } from 'vitest';

import { mount, settle } from '../../testing/index.js';

import type { JellyAlert } from './index.js';
import '../../testing/define-all.js';

test('upgrades as a role=alert box with a tone icon', async () => {
  const host = mount('<jelly-alert tone="success">Saved!</jelly-alert>');
  const el = host.querySelector('jelly-alert') as JellyAlert;

  await settle(3);
  const box = el.shadowRoot!.querySelector('.box');
  expect(box?.getAttribute('role')).toBe('alert');
  expect(el.shadowRoot!.querySelector('.icon svg')).toBeTruthy();

  host.remove();
});

test('dismissing fires a dismiss event and removes the element', async () => {
  const host = mount('<jelly-alert tone="danger" dismissible>Broke.</jelly-alert>');
  const el = host.querySelector('jelly-alert') as JellyAlert;

  await settle(3);
  let dismissed = 0;
  el.addEventListener('dismiss', () => { dismissed += 1; });

  (el.shadowRoot!.querySelector('.close') as HTMLButtonElement).click();
  expect(dismissed).toBe(1);

  await new Promise((resolve) => setTimeout(resolve, 220));
  expect(el.isConnected).toBe(false);

  host.remove();
});
