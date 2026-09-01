import { expect, test, vi } from 'vitest';

import { mount, settle } from '../../testing/index.js';

import './index.js';
import type { JellyButton } from './index.js';

test('upgrades and renders a real inner <button>', async () => {
  const host = mount('<jelly-button>Go</jelly-button>');
  const el = host.querySelector('jelly-button') as JellyButton;

  await settle(20);

  expect(el.shadowRoot).toBeTruthy();
  expect(el.shadowRoot!.querySelector('button')).toBeInstanceOf(HTMLButtonElement);

  host.remove();
});

test('disabled reflects onto the inner button and back', async () => {
  const host = mount('<jelly-button disabled>Go</jelly-button>');
  const el = host.querySelector('jelly-button') as JellyButton;

  await settle(3);
  const inner = el.shadowRoot!.querySelector('button')!;
  expect(inner.disabled).toBe(true);

  el.removeAttribute('disabled');
  await settle(2);
  expect(inner.disabled).toBe(false);

  host.remove();
});

test('variant="mint" paints the mint fill on the canvas', async () => {
  const host = mount('<jelly-button variant="mint">Go</jelly-button>');
  const el = host.querySelector('jelly-button') as JellyButton;

  await settle(20);

  const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
  const pixel = canvas.getContext('2d')!.getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data;

  // mint = #178746 = rgb(23, 135, 70)
  expect(Math.abs(pixel[0]! - 23)).toBeLessThan(8);
  expect(Math.abs(pixel[1]! - 135)).toBeLessThan(8);
  expect(Math.abs(pixel[2]! - 70)).toBeLessThan(8);
  expect(pixel[3]).toBe(255);

  host.remove();
});

test('type="submit" drives the closest light-DOM form', async () => {
  const host = mount('<form><jelly-button type="submit">Save</jelly-button></form>');
  const el = host.querySelector('jelly-button') as JellyButton;

  await settle(3);

  let submitted = false;
  host.querySelector('form')!.addEventListener('submit', (event) => {
    event.preventDefault();
    submitted = true;
  });

  el.shadowRoot!.querySelector('button')!.click();
  expect(submitted).toBe(true);

  host.remove();
});

test('does not activate when a pointer is released outside the button', async () => {
  const host = mount('<jelly-button>Go</jelly-button>');
  const el = host.querySelector('jelly-button') as JellyButton;
  const onClick = vi.fn();

  el.addEventListener('click', onClick);
  await settle(3);

  const button = el.shadowRoot!.querySelector('button') as HTMLButtonElement;

  button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, clientX: 0, clientY: 0 }));
  button.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1, clientX: -100, clientY: -100 }));
  button.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, detail: 1 }));

  expect(onClick).not.toHaveBeenCalled();

  host.remove();
});
