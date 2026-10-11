import { expect, test } from 'vitest';

import { mount, settle } from '../../testing/index.js';

import type { DropletSegmented } from './index.js';
import '../../testing/define-all.js';

test('renders one button per segment as a radiogroup', async () => {
  const host = mount(`
    <droplet-segmented value="week">
      <droplet-segment value="day">Day</droplet-segment>
      <droplet-segment value="week">Week</droplet-segment>
      <droplet-segment value="month">Month</droplet-segment>
    </droplet-segmented>`);
  const el = host.querySelector('droplet-segmented') as DropletSegmented;
  await settle(8);

  const wrap = el.shadowRoot!.querySelector('.wrap')!;
  expect(wrap.getAttribute('role')).toBe('radiogroup');
  expect(wrap.querySelectorAll('.segment').length).toBe(3);
  expect(el.value).toBe('week');

  host.remove();
});

test('clicking a segment selects it and fires change', async () => {
  const host = mount(`
    <droplet-segmented value="day">
      <droplet-segment value="day">Day</droplet-segment>
      <droplet-segment value="week">Week</droplet-segment>
    </droplet-segmented>`);
  const el = host.querySelector('droplet-segmented') as DropletSegmented;
  await settle(8);

  let changed = '';
  el.addEventListener('change', (event) => { changed = (event as CustomEvent).detail.value; });

  const week = el.shadowRoot!.querySelectorAll('.segment')[1] as HTMLButtonElement;
  week.click();

  expect(el.value).toBe('week');
  expect(changed).toBe('week');
  expect(week.getAttribute('aria-checked')).toBe('true');

  host.remove();
});

test('submits the selected value in a form', async () => {
  const host = mount(`
    <form>
      <droplet-segmented name="range" value="week">
        <droplet-segment value="day">Day</droplet-segment>
        <droplet-segment value="week">Week</droplet-segment>
      </droplet-segmented>
    </form>`);
  await settle(8);

  const data = new FormData(host.querySelector('form') as HTMLFormElement);
  expect(data.get('range')).toBe('week');

  host.remove();
});
