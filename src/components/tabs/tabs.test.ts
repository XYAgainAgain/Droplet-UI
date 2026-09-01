import { expect, test } from 'vitest';

import { mount, settle } from '../../testing/index.js';

import './index.js';
import type { JellyTabs } from './index.js';

test('builds a tablist from panels and shows the active one', async () => {
  const host = mount(`
    <jelly-tabs>
      <jelly-tab-panel label="Overview" active>A</jelly-tab-panel>
      <jelly-tab-panel label="Activity">B</jelly-tab-panel>
    </jelly-tabs>`);
  const el = host.querySelector('jelly-tabs') as JellyTabs;
  await settle(6);

  expect(el.shadowRoot!.querySelector('jelly-segmented')).toBeTruthy();
  const [overview, activity] = [...host.querySelectorAll<HTMLElement>('jelly-tab-panel')] as [HTMLElement, HTMLElement];
  expect(overview.hidden).toBe(false);
  expect(activity.hidden).toBe(true);

  host.remove();
});

test('switches panels when the markup is set through a connected innerHTML', async () => {
  // The showcase builds each preview with `stage.innerHTML = ...` on a stage
  // that is already in the document, so jelly-tabs connects (and stamps its
  // panels) before the panels themselves upgrade. A cached per-panel value
  // would be reset by the panel's class fields and every switch would then
  // match nothing, hiding all panels.
  const stage = document.createElement('div');
  document.body.appendChild(stage);

  stage.innerHTML = `
    <jelly-tabs value="overview">
      <jelly-tab-panel label="Overview" value="overview" active>A</jelly-tab-panel>
      <jelly-tab-panel label="Activity" value="activity">B</jelly-tab-panel>
    </jelly-tabs>`;

  const el = stage.querySelector('jelly-tabs') as JellyTabs;
  await settle(6);

  el.value = 'activity';
  await settle(2);

  const [overview, activity] = [...stage.querySelectorAll<HTMLElement>('jelly-tab-panel')] as [HTMLElement, HTMLElement];
  expect(activity.hidden).toBe(false);
  expect(overview.hidden).toBe(true);

  stage.remove();
});

test('setting the value activates the matching panel and fires change', async () => {
  const host = mount(`
    <jelly-tabs>
      <jelly-tab-panel label="One" value="one" active>1</jelly-tab-panel>
      <jelly-tab-panel label="Two" value="two">2</jelly-tab-panel>
    </jelly-tabs>`);
  const el = host.querySelector('jelly-tabs') as JellyTabs;
  await settle(6);

  let changed = '';
  el.addEventListener('change', (event) => { changed = (event as CustomEvent).detail.value; });

  el.value = 'two';
  await settle(2);

  const [one, two] = [...host.querySelectorAll<HTMLElement>('jelly-tab-panel')] as [HTMLElement, HTMLElement];
  expect(two.hidden).toBe(false);
  expect(one.hidden).toBe(true);
  expect(changed).toBe('two');

  host.remove();
});
