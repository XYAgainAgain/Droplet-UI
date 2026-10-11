import { expect, test } from 'vitest';

import { mount, raf } from '../../testing/index.js';

import type { JellyRadioGroup } from './index.js';
import '../../testing/define-all.js';

test('renders a radiogroup with a labelled legend', async () => {
  const host = mount(`
    <jelly-radio-group label="Billing">
      <jelly-radio name="b" value="m" checked>Monthly</jelly-radio>
      <jelly-radio name="b" value="y">Yearly</jelly-radio>
    </jelly-radio-group>`);
  const el = host.querySelector('jelly-radio-group') as JellyRadioGroup;
  await raf();

  const items = el.shadowRoot!.querySelector('.items')!;
  expect(items.getAttribute('role')).toBe('radiogroup');
  expect(el.shadowRoot!.querySelector('.legend')?.textContent).toBe('Billing');
  expect(items.hasAttribute('aria-labelledby')).toBe(true);

  host.remove();
});

test('propagates its size to child radios', async () => {
  const host = mount(`
    <jelly-radio-group size="large">
      <jelly-radio name="s" value="a">A</jelly-radio>
    </jelly-radio-group>`);
  await raf();

  const radio = host.querySelector('jelly-radio')!;
  expect(radio.getAttribute('size')).toBe('large');

  host.remove();
});
