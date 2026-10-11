import { expect, test } from 'vitest';

import { mount, raf } from '../../testing/index.js';

import type { DropletRadioGroup } from './index.js';
import '../../testing/define-all.js';

test('renders a radiogroup with a labeled legend', async () => {
  const host = mount(`
    <droplet-radio-group label="Billing">
      <droplet-radio name="b" value="m" checked>Monthly</droplet-radio>
      <droplet-radio name="b" value="y">Yearly</droplet-radio>
    </droplet-radio-group>`);
  const el = host.querySelector('droplet-radio-group') as DropletRadioGroup;
  await raf();

  const items = el.shadowRoot!.querySelector('.items')!;
  expect(items.getAttribute('role')).toBe('radiogroup');
  expect(el.shadowRoot!.querySelector('.legend')?.textContent).toBe('Billing');
  expect(items.hasAttribute('aria-labelledby')).toBe(true);

  host.remove();
});

test('propagates its size to child radios', async () => {
  const host = mount(`
    <droplet-radio-group size="large">
      <droplet-radio name="s" value="a">A</droplet-radio>
    </droplet-radio-group>`);
  await raf();

  const radio = host.querySelector('droplet-radio')!;
  expect(radio.getAttribute('size')).toBe('large');

  host.remove();
});
