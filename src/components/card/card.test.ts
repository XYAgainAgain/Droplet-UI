import { expect, test } from 'vitest';

import { mount, settle } from '../../testing/index.js';

import type { DropletCard } from './index.js';
import '../../testing/define-all.js';

test('upgrades and renders its slotted content in a surface', async () => {
  const host = mount('<droplet-card><h3>Title</h3></droplet-card>');
  const el = host.querySelector('droplet-card') as DropletCard;

  await settle(3);
  expect(el.shadowRoot!.querySelector('.card')).toBeTruthy();
  expect(el.querySelector('h3')?.textContent).toBe('Title');

  host.remove();
});

test('squish cards become keyboard-activatable buttons', async () => {
  const host = mount('<droplet-card squish>Tap</droplet-card>');
  const el = host.querySelector('droplet-card') as DropletCard;

  await settle(3);
  const card = el.shadowRoot!.querySelector('.card') as HTMLElement;
  expect(card.getAttribute('role')).toBe('button');
  expect(card.getAttribute('tabindex')).toBe('0');

  let clicked = 0;
  el.addEventListener('click', () => { clicked += 1; });
  card.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  card.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
  expect(clicked).toBe(1);

  host.remove();
});

async function squishCard (html = '<droplet-card squish>Tap</droplet-card>'): Promise<{ host: HTMLDivElement; card: HTMLElement; clicks: () => number }> {
  const host = mount(html);
  const el = host.querySelector('droplet-card') as DropletCard;
  let clicked = 0;

  await settle(3);
  el.addEventListener('click', () => { clicked += 1; });

  return { host, card: el.shadowRoot!.querySelector('.card') as HTMLElement, clicks: () => clicked };
}

const key = (target: EventTarget, type: string, init: KeyboardEventInit): boolean =>
  target.dispatchEvent(new KeyboardEvent(type, { bubbles: true, composed: true, cancelable: true, ...init }));

test('Enter activates on keydown, once per press', async () => {
  const { host, card, clicks } = await squishCard();

  key(card, 'keydown', { key: 'Enter' });
  expect(clicks()).toBe(1);

  key(card, 'keydown', { key: 'Enter', repeat: true });
  key(card, 'keyup', { key: 'Enter' });
  expect(clicks()).toBe(1);

  host.remove();
});

test('Space activates only on its own keyup and never scrolls', async () => {
  const { host, card, clicks } = await squishCard();

  expect(key(card, 'keydown', { key: ' ' })).toBe(false);
  expect(key(card, 'keydown', { key: ' ', repeat: true })).toBe(false);
  expect(clicks()).toBe(0);

  key(card, 'keyup', { key: 'a' });
  key(card, 'keyup', { key: 'Enter' });
  expect(clicks()).toBe(0);

  key(card, 'keyup', { key: ' ' });
  expect(clicks()).toBe(1);

  key(card, 'keyup', { key: ' ' });
  expect(clicks()).toBe(1);

  host.remove();
});

test('focus loss cancels a pending Space press', async () => {
  const { host, card, clicks } = await squishCard();

  key(card, 'keydown', { key: ' ' });
  card.dispatchEvent(new FocusEvent('blur'));
  key(card, 'keyup', { key: ' ' });
  expect(clicks()).toBe(0);

  host.remove();
});

test('keys from focusable slotted content do not activate the card', async () => {
  const { host, clicks } = await squishCard('<droplet-card squish><button type="button">Inner</button></droplet-card>');
  const inner = host.querySelector('button')!;

  key(inner, 'keydown', { key: 'Enter' });
  key(inner, 'keydown', { key: ' ' });
  key(inner, 'keyup', { key: ' ' });
  expect(clicks()).toBe(0);

  host.remove();
});
