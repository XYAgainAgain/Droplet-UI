import { expect, test } from 'vitest';

import { mount, raf } from '../../testing/index.js';

import './index.js';
import type { JellyCollapsible } from '../collapsible/index.js';

test('single mode closes siblings when one item opens', async () => {
  const host = mount(`
    <jelly-accordion single>
      <jelly-collapsible open><span slot="header">One</span>1</jelly-collapsible>
      <jelly-collapsible><span slot="header">Two</span>2</jelly-collapsible>
    </jelly-accordion>`);
  await raf();

  const [one, two] = [...host.querySelectorAll('jelly-collapsible')] as [JellyCollapsible, JellyCollapsible];

  (two.shadowRoot!.querySelector('.head') as HTMLButtonElement).click();

  expect(two.open).toBe(true);
  expect(one.open).toBe(false);

  host.remove();
});

test('propagates its size to child collapsibles', async () => {
  const host = mount(`
    <jelly-accordion size="large">
      <jelly-collapsible><span slot="header">One</span>1</jelly-collapsible>
    </jelly-accordion>`);
  await raf();

  expect(host.querySelector('jelly-collapsible')!.getAttribute('size')).toBe('large');

  host.remove();
});
