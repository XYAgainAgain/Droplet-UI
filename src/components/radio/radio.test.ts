import { expect, test } from 'vitest';

import { mount, settle } from '../../testing/index.js';

import './index.js';
import type { JellyRadio } from './index.js';

test('upgrades with a role=radio control', async () => {
  const host = mount('<jelly-radio>One</jelly-radio>');
  const el = host.querySelector('jelly-radio') as JellyRadio;

  await settle(3);
  const control = el.shadowRoot!.querySelector('.control')!;
  expect(control.getAttribute('role')).toBe('radio');

  host.remove();
});

test('reflects checked into aria-checked', async () => {
  const host = mount('<jelly-radio checked>One</jelly-radio>');
  const el = host.querySelector('jelly-radio') as JellyRadio;

  await settle(3);
  expect(el.shadowRoot!.querySelector('.control')!.getAttribute('aria-checked')).toBe('true');

  host.remove();
});

test('selecting one radio deselects its group siblings and fires change', async () => {
  const host = mount(`
    <jelly-radio name="plan" value="a" checked>A</jelly-radio>
    <jelly-radio name="plan" value="b">B</jelly-radio>`);
  const [a, b] = [...host.querySelectorAll('jelly-radio')] as [JellyRadio, JellyRadio];

  await settle(3);
  let fired = 0;
  b.addEventListener('change', () => { fired += 1; });

  (b.shadowRoot!.querySelector('.wrap') as HTMLElement).click();

  expect(b.checked).toBe(true);
  expect(a.checked).toBe(false);
  expect(fired).toBe(1);

  host.remove();
});

test('selected mint variant paints the accent fill', async () => {
  const host = mount('<jelly-radio checked variant="mint">One</jelly-radio>');
  const el = host.querySelector('jelly-radio') as JellyRadio;

  await settle(12);
  const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
  const pixel = canvas.getContext('2d')!.getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data;

  expect(Math.abs(pixel[0]! - 23)).toBeLessThan(10);
  expect(Math.abs(pixel[1]! - 135)).toBeLessThan(10);
  expect(Math.abs(pixel[2]! - 70)).toBeLessThan(10);

  host.remove();
});

test('submits the selected value in a form', async () => {
  const host = mount(`
    <form>
      <jelly-radio name="plan" value="a">A</jelly-radio>
      <jelly-radio name="plan" value="b" checked>B</jelly-radio>
    </form>`);

  await settle(3);
  const data = new FormData(host.querySelector('form') as HTMLFormElement);
  expect(data.get('plan')).toBe('b');

  host.remove();
});
