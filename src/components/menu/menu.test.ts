import { expect, test } from 'vitest';

import { mount } from '../../testing/index.js';

import type { JellyMenu } from './index.js';
import '../../testing/define-all.js';

function makeMenu (): { host: HTMLDivElement; el: JellyMenu } {
  const host = mount(`
    <jelly-menu>
      <button slot="trigger">Actions</button>
      <jelly-menu-item value="edit">Edit</jelly-menu-item>
      <jelly-menu-item value="del" danger>Delete</jelly-menu-item>
    </jelly-menu>`);
  return { host, el: host.querySelector('jelly-menu') as JellyMenu };
}

test('marks the trigger as a menu button', () => {
  const { host } = makeMenu();
  const trigger = host.querySelector('[slot="trigger"]') as HTMLElement;

  expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
  expect(trigger.getAttribute('aria-expanded')).toBe('false');

  host.remove();
});

test('renders one row per item when opened', () => {
  const { host, el } = makeMenu();
  const trigger = host.querySelector('[slot="trigger"]') as HTMLElement;

  el.open();

  expect(el.shadowRoot!.querySelectorAll('.item').length).toBe(2);
  expect(trigger.getAttribute('aria-expanded')).toBe('true');
  expect(el.shadowRoot!.querySelector('.item[data-danger]')).not.toBeNull();

  host.remove();
});

test('picking a row fires select with the item value and closes', () => {
  const { host, el } = makeMenu();

  let picked = '';
  el.addEventListener('select', (event) => { picked = (event as CustomEvent).detail.value; });

  el.open();
  const rows = el.shadowRoot!.querySelectorAll('.item');
  (rows[1] as HTMLElement).click();

  expect(picked).toBe('del');
  expect(el.isOpen).toBe(false);

  host.remove();
});
