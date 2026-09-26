import { afterEach, expect, test } from 'vitest';

import { mount, settle } from '../testing/index.js';

import '../components/kbd/index.js';
import '../components/spinner/index.js';
import { defineCollapsible } from '../components/collapsible/index.js';

defineCollapsible({ strict: false });

const root = document.documentElement;
const osReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

afterEach(() => root.removeAttribute('data-jelly-motion'));

function inner (host: HTMLElement, tag: string, selector: string): CSSStyleDeclaration {
  const el = host.querySelector(tag)!;

  return getComputedStyle(el.shadowRoot!.querySelector(selector)!);
}

test('data-jelly-motion on <html> switches shadow transitions live', async () => {
  const host = mount('<jelly-kbd>K</jelly-kbd>');

  await settle(3);
  const cap = inner(host, 'jelly-kbd', '.cap');

  expect(cap.transitionProperty).toBe(osReduced ? 'none' : 'transform');

  root.setAttribute('data-jelly-motion', 'reduce');
  expect(cap.transitionProperty).toBe('none');

  root.setAttribute('data-jelly-motion', 'no-preference');
  expect(cap.transitionProperty).toBe('transform');

  root.removeAttribute('data-jelly-motion');
  expect(cap.transitionProperty).toBe(osReduced ? 'none' : 'transform');

  host.remove();
});

test('the override also stops animations, including :host()-qualified rules', async () => {
  const host = mount(`
    <jelly-spinner></jelly-spinner>
    <jelly-collapsible open><span slot="header">Details</span>Body</jelly-collapsible>
  `);

  await settle(3);
  const rover = inner(host, 'jelly-spinner', '.rover');
  const panel = inner(host, 'jelly-collapsible', '.inner');
  const wrap  = inner(host, 'jelly-collapsible', '.wrap');

  root.setAttribute('data-jelly-motion', 'no-preference');
  expect(rover.animationName).toBe('sp-rove');
  expect(panel.animationName).toBe('pop');
  expect(wrap.transitionProperty).toBe('grid-template-rows');

  root.setAttribute('data-jelly-motion', 'reduce');
  expect(rover.animationName).toBe('none');
  expect(panel.animationName).toBe('none');
  expect(wrap.transitionProperty).toBe('none');

  host.remove();
});
