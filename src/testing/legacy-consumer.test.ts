import { expect, test } from 'vitest';

import * as JellyUI from '../jelly.js';
import { JellyButton } from '../components/button/index.js';
import { JellyCollapsible } from '../components/collapsible/index.js';
import { JellySlider } from '../components/slider/index.js';
import { mount, settle } from './index.js';
import { JELLY_UI_1_1_0_CONSUMER_MARKUP, JELLY_UI_1_1_0_TAGS } from './fixtures/jelly-ui-1.1.0.js';

test('the root import registers every Jelly UI 1.1.0 tag', () => {
  for (const tag of JELLY_UI_1_1_0_TAGS) {
    expect(customElements.get(tag), tag).toBeTypeOf('function');
  }
});

test('legacy classes and CSS tokens keep their public behavior', async () => {
  const host = mount(JELLY_UI_1_1_0_CONSUMER_MARKUP);
  const button = host.querySelector('jelly-button') as JellyButton;
  const slider = host.querySelector('jelly-slider') as JellySlider;

  await settle(12);

  expect(button).toBeInstanceOf(JellyButton);
  expect(button).toBeInstanceOf(JellyUI.JellyElement);
  expect(slider).toBeInstanceOf(JellySlider);

  const canvas = button.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
  const pixel = canvas.getContext('2d')!.getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data;

  expect(pixel[0]).toBeCloseTo(7, -1);
  expect(pixel[1]).toBeCloseTo(101, -1);
  expect(pixel[2]).toBeCloseTo(203, -1);

  host.remove();
});

test('legacy slider attributes, properties, and events remain connected', async () => {
  const host = mount(JELLY_UI_1_1_0_CONSUMER_MARKUP);
  const slider = host.querySelector('jelly-slider') as JellySlider;
  let inputs = 0;

  slider.addEventListener('input', () => { inputs += 1; });
  await settle(3);

  const input = slider.shadowRoot!.querySelector('input') as HTMLInputElement;
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));

  expect(slider.value).toBe('45');
  expect(slider.getAttribute('value')).toBe('40');
  expect(inputs).toBe(1);

  slider.value = '70';
  expect(input.value).toBe('70');

  host.remove();
});

test('legacy public methods keep their reflected state and events', () => {
  const host = mount(JELLY_UI_1_1_0_CONSUMER_MARKUP);
  const collapsible = host.querySelector('jelly-collapsible') as JellyCollapsible;
  let toggles = 0;

  collapsible.addEventListener('toggle', () => { toggles += 1; });
  collapsible.toggle(true);

  expect(collapsible.open).toBe(true);
  expect(collapsible.hasAttribute('open')).toBe(true);
  expect(collapsible.shadowRoot!.querySelector('button')!.getAttribute('aria-expanded')).toBe('true');
  expect(toggles).toBe(1);

  collapsible.toggle(true);
  expect(toggles).toBe(1);

  host.remove();
});
