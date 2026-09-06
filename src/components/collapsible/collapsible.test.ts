import { expect, test } from 'vitest';

import { mount } from '../../testing/index.js';

import { defineAll } from '../../register.js';
import type { JellyCollapsible } from './index.js';

defineAll({ strict: false });

test('renders a header button reflecting the open state', () => {
  const host = mount('<jelly-collapsible open><span slot="header">Details</span>Body</jelly-collapsible>');
  const el = host.querySelector('jelly-collapsible') as JellyCollapsible;

  const head = el.shadowRoot!.querySelector('.head')!;
  expect(head.getAttribute('aria-expanded')).toBe('true');

  host.remove();
});

test('toggling fires exactly one toggle event per real change', () => {
  const host = mount('<jelly-collapsible><span slot="header">Details</span>Body</jelly-collapsible>');
  const el = host.querySelector('jelly-collapsible') as JellyCollapsible;

  let toggles = 0;
  el.addEventListener('toggle', () => { toggles += 1; });

  (el.shadowRoot!.querySelector('.head') as HTMLButtonElement).click();
  expect(el.open).toBe(true);
  expect(el.shadowRoot!.querySelector('.head')!.getAttribute('aria-expanded')).toBe('true');
  expect(toggles).toBe(1);

  host.remove();
});
