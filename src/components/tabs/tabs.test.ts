import { expect, test } from 'vitest';

import { mount, settle } from '../../testing/index.js';

import type { DropletTabs } from './index.js';
import '../../testing/define-all.js';

test('builds a tablist from panels and shows the active one', async () => {
  const host = mount(`
    <droplet-tabs>
      <droplet-tab-panel label="Overview" active>A</droplet-tab-panel>
      <droplet-tab-panel label="Activity">B</droplet-tab-panel>
    </droplet-tabs>`);
  const el = host.querySelector('droplet-tabs') as DropletTabs;
  await settle(6);

  expect(el.shadowRoot!.querySelector('droplet-segmented')).toBeTruthy();
  const [overview, activity] = [...host.querySelectorAll<HTMLElement>('droplet-tab-panel')] as [HTMLElement, HTMLElement];
  expect(overview.hidden).toBe(false);
  expect(activity.hidden).toBe(true);

  host.remove();
});

test('switches panels when the markup is set through a connected innerHTML', async () => {
  // Tabs connects before its panels upgrade, which resets any cached panel value
  const stage = document.createElement('div');
  document.body.appendChild(stage);

  stage.innerHTML = `
    <droplet-tabs value="overview">
      <droplet-tab-panel label="Overview" value="overview" active>A</droplet-tab-panel>
      <droplet-tab-panel label="Activity" value="activity">B</droplet-tab-panel>
    </droplet-tabs>`;

  const el = stage.querySelector('droplet-tabs') as DropletTabs;
  await settle(6);

  el.value = 'activity';
  await settle(2);

  const [overview, activity] = [...stage.querySelectorAll<HTMLElement>('droplet-tab-panel')] as [HTMLElement, HTMLElement];
  expect(activity.hidden).toBe(false);
  expect(overview.hidden).toBe(true);

  stage.remove();
});

test('setting the value activates the matching panel and fires change', async () => {
  const host = mount(`
    <droplet-tabs>
      <droplet-tab-panel label="One" value="one" active>1</droplet-tab-panel>
      <droplet-tab-panel label="Two" value="two">2</droplet-tab-panel>
    </droplet-tabs>`);
  const el = host.querySelector('droplet-tabs') as DropletTabs;
  await settle(6);

  let changed = '';
  el.addEventListener('change', (event) => { changed = (event as CustomEvent).detail.value; });

  el.value = 'two';
  await settle(2);

  const [one, two] = [...host.querySelectorAll<HTMLElement>('droplet-tab-panel')] as [HTMLElement, HTMLElement];
  expect(two.hidden).toBe(false);
  expect(one.hidden).toBe(true);
  expect(changed).toBe('two');

  host.remove();
});
