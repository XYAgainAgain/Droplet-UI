import { expect, test } from 'vitest';

import { mount } from '../../testing/index.js';

import type { JellyResizable } from './index.js';
import '../../testing/define-all.js';

test('lays out panes with a divider between each pair', () => {
  const host = mount('<jelly-resizable><div>L</div><div>M</div><div>R</div></jelly-resizable>');
  const el = host.querySelector('jelly-resizable') as JellyResizable;

  expect(el.shadowRoot!.querySelector('.container')).toBeTruthy();
  // three panes → two dividers
  expect(el.shadowRoot!.querySelectorAll('.divider').length).toBe(2);
  // panes are assigned to slots
  expect((el.children[0] as HTMLElement).slot).toBe('p0');

  host.remove();
});

test('direction="both" builds a 2×2 grid with two axis dividers', () => {
  const host = mount('<jelly-resizable direction="both"><div>A</div><div>B</div><div>C</div><div>D</div></jelly-resizable>');
  const el = host.querySelector('jelly-resizable') as JellyResizable;

  expect(el.shadowRoot!.querySelector('.divider-x')).toBeTruthy();
  expect(el.shadowRoot!.querySelector('.divider-y')).toBeTruthy();
  expect(el.isBothAxes).toBe(true);

  host.remove();
});
