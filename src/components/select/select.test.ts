import { expect, test } from 'vitest';

import { mount, settle } from '../../testing/index.js';

import type { DropletSelect } from './index.js';
import '../../testing/define-all.js';

test('renders one listbox row per option and honors the selected attribute', async () => {
  const host = mount(`
    <droplet-select label="Plan">
      <droplet-option value="free">Free</droplet-option>
      <droplet-option value="pro" selected>Pro</droplet-option>
    </droplet-select>`);
  const el = host.querySelector('droplet-select') as DropletSelect;
  await settle(6);

  const rows = el.shadowRoot!.querySelectorAll('.row');
  expect(rows.length).toBe(2);
  expect(el.value).toBe('pro');
  expect(el.shadowRoot!.querySelector('.value')!.textContent).toBe('Pro');

  host.remove();
});

test('opening the panel sets aria-expanded and clicking a row selects it', async () => {
  const host = mount(`
    <droplet-select label="Plan" placeholder="Choose">
      <droplet-option value="free">Free</droplet-option>
      <droplet-option value="pro">Pro</droplet-option>
    </droplet-select>`);
  const el = host.querySelector('droplet-select') as DropletSelect;
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
      <droplet-select name="plan" value="pro">
        <droplet-option value="free">Free</droplet-option>
        <droplet-option value="pro">Pro</droplet-option>
      </droplet-select>
    </form>`);
  await settle(6);

  const data = new FormData(host.querySelector('form') as HTMLFormElement);
  expect(data.get('plan')).toBe('pro');

  host.remove();
});
