import { expect, test } from 'vitest';

import { mount, raf } from '../../testing/index.js';

import type { DropletCollapsible } from '../collapsible/index.js';
import '../../testing/define-all.js';

test('single mode closes siblings when one item opens', async () => {
  const host = mount(`
    <droplet-accordion single>
      <droplet-collapsible open><span slot="header">One</span>1</droplet-collapsible>
      <droplet-collapsible><span slot="header">Two</span>2</droplet-collapsible>
    </droplet-accordion>`);
  await raf();

  const [one, two] = [...host.querySelectorAll('droplet-collapsible')] as [DropletCollapsible, DropletCollapsible];

  (two.shadowRoot!.querySelector('.head') as HTMLButtonElement).click();

  expect(two.open).toBe(true);
  expect(one.open).toBe(false);

  host.remove();
});

test('propagates its size to child collapsibles', async () => {
  const host = mount(`
    <droplet-accordion size="large">
      <droplet-collapsible><span slot="header">One</span>1</droplet-collapsible>
    </droplet-accordion>`);
  await raf();

  expect(host.querySelector('droplet-collapsible')!.getAttribute('size')).toBe('large');

  host.remove();
});
