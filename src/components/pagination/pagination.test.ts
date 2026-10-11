import { expect, test } from 'vitest';

import { mount, raf } from '../../testing/index.js';

import type { JellyPagination } from './index.js';
import '../../testing/define-all.js';

test('renders a windowed page list with a current page', async () => {
  const host = mount('<jelly-pagination total="12" page="3"></jelly-pagination>');
  const el = host.querySelector('jelly-pagination') as JellyPagination;
  await raf();

  expect(el.page).toBe(3);
  const current = el.shadowRoot!.querySelector('jelly-button[aria-current]');
  expect(current?.textContent).toBe('3');

  host.remove();
});

test('clicking a page button navigates and fires change', async () => {
  const host = mount('<jelly-pagination total="5" page="1"></jelly-pagination>');
  const el = host.querySelector('jelly-pagination') as JellyPagination;
  await raf();

  let detailPage = 0;
  el.addEventListener('change', (event) => { detailPage = (event as CustomEvent).detail.page; });

  const buttons = [...el.shadowRoot!.querySelectorAll('jelly-button')];
  const pageTwo = buttons.find((b) => b.textContent === '2')!;
  pageTwo.dispatchEvent(new MouseEvent('click', { bubbles: true }));

  expect(el.page).toBe(2);
  expect(detailPage).toBe(2);

  host.remove();
});
