import { expect, test } from 'vitest';

import { mount } from '../../testing/index.js';

import './index.js';
import type { JellyOtp } from './index.js';

test('renders one input box per digit', () => {
  const host = mount('<jelly-otp length="4"></jelly-otp>');
  const el = host.querySelector('jelly-otp') as JellyOtp;

  expect(el.shadowRoot!.querySelectorAll('input').length).toBe(4);

  host.remove();
});

test('typing a digit fills the box, advances focus and reports value', () => {
  const host = mount('<jelly-otp length="3"></jelly-otp>');
  const el = host.querySelector('jelly-otp') as JellyOtp;

  const boxes = [...el.shadowRoot!.querySelectorAll('input')] as HTMLInputElement[];
  boxes[0]!.value = '7';
  boxes[0]!.dispatchEvent(new Event('input', { bubbles: true }));

  expect(boxes[0]!.value).toBe('7');
  expect(el.value).toBe('7');

  host.remove();
});

test('fires complete with the joined value when every box is filled', () => {
  const host = mount('<jelly-otp length="3"></jelly-otp>');
  const el = host.querySelector('jelly-otp') as JellyOtp;

  let completed = '';
  el.addEventListener('complete', (event) => { completed = (event as CustomEvent).detail.value; });

  el.value = '123';
  const boxes = [...el.shadowRoot!.querySelectorAll('input')] as HTMLInputElement[];
  boxes[2]!.dispatchEvent(new Event('input', { bubbles: true }));

  expect(completed).toBe('123');

  host.remove();
});
