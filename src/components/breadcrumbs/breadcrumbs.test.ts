import { expect, test } from 'vitest';

import { mount } from '../../testing/index.js';

import './index.js';
import type { JellyBreadcrumbs } from './index.js';

test('renders a nav trail with links and a current page', () => {
  const host = mount('<jelly-breadcrumbs><a href="/">Home</a><a href="/lib">Library</a><span>Switch</span></jelly-breadcrumbs>');
  const el = host.querySelector('jelly-breadcrumbs') as JellyBreadcrumbs;

  const links = el.shadowRoot!.querySelectorAll('a');
  expect(links.length).toBe(2);
  expect(links[0]!.getAttribute('href')).toBe('/');

  const current = el.shadowRoot!.querySelector('.current');
  expect(current?.getAttribute('aria-current')).toBe('page');
  expect(current?.textContent).toBe('Switch');

  host.remove();
});
