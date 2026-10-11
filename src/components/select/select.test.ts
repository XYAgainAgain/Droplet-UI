import { expect, test } from 'vitest';

import { mount, settle } from '../../testing/index.js';

import type { JellySelect } from './index.js';
import '../../testing/define-all.js';

test('renders one listbox row per option and honors the selected attribute', async () => {
  const host = mount(`
    <jelly-select label="Plan">
      <jelly-option value="free">Free</jelly-option>
      <jelly-option value="pro" selected>Pro</jelly-option>
    </jelly-select>`);
  const el = host.querySelector('jelly-select') as JellySelect;
  await settle(6);

  const rows = el.shadowRoot!.querySelectorAll('.row');
  expect(rows.length).toBe(2);
  expect(el.value).toBe('pro');
  expect(el.shadowRoot!.querySelector('.value')!.textContent).toBe('Pro');

  host.remove();
});

test('opening the panel sets aria-expanded and clicking a row selects it', async () => {
  const host = mount(`
    <jelly-select label="Plan" placeholder="Choose">
      <jelly-option value="free">Free</jelly-option>
      <jelly-option value="pro">Pro</jelly-option>
    </jelly-select>`);
  const el = host.querySelector('jelly-select') as JellySelect;
  await settle(6);

  let changed = false;
  el.addEventListener('change', () => { changed = true; });

  const trigger = el.shadowRoot!.querySelector('.trigger') as HTMLButtonElement;
  trigger.click();
  expect(trigger.getAttribute('aria-expanded')).toBe('true');

  const rows = el.shadowRoot!.querySelectorAll('.row');
  (rows[1] as HTMLElement).click();

  expect(el.value).toBe('pro');
  expect(changed).toBe(true);
  expect(trigger.getAttribute('aria-expanded')).toBe('false');

  host.remove();
});

test('submits the selected value in a form', async () => {
  const host = mount(`
    <form>
      <jelly-select name="plan" value="pro">
        <jelly-option value="free">Free</jelly-option>
        <jelly-option value="pro">Pro</jelly-option>
      </jelly-select>
    </form>`);
  await settle(6);

  const data = new FormData(host.querySelector('form') as HTMLFormElement);
  expect(data.get('plan')).toBe('pro');

  host.remove();
});
