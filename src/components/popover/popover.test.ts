import { expect, test } from 'vitest';

import { mount } from '../../testing/index.js';

import './index.js';
import { defineAll } from '../../register.js';
import type { JellyPopover } from './index.js';

defineAll({ strict: false });

function makePopover (): { host: HTMLDivElement; el: JellyPopover } {
  const host = mount(`
    <jelly-popover label="Options">
      <button slot="trigger">Open</button>
      <div slot="content"><button>Item</button></div>
    </jelly-popover>`);
  return { host, el: host.querySelector('jelly-popover') as JellyPopover };
}

test('marks the trigger with aria-haspopup and reflects expanded state', () => {
  const { host, el } = makePopover();
  const trigger = host.querySelector('[slot="trigger"]') as HTMLElement;

  expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
  expect(trigger.getAttribute('aria-expanded')).toBe('false');

  el.open();
  expect(trigger.getAttribute('aria-expanded')).toBe('true');

  host.remove();
});

test('opens on trigger click and closes on Escape', () => {
  const { host, el } = makePopover();
  const trigger = host.querySelector('[slot="trigger"]') as HTMLButtonElement;
  const panel = el.shadowRoot!.querySelector('.panel') as HTMLElement;

  trigger.click();
  expect(el.isOpen).toBe(true);
  expect(panel.hasAttribute('data-open')).toBe(true);

  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  expect(el.isOpen).toBe(false);

  host.remove();
});

test('emits open and close events', () => {
  const { host, el } = makePopover();

  let opened = 0;
  let closed = 0;
  el.addEventListener('open', () => { opened++; });
  el.addEventListener('close', () => { closed++; });

  el.open();
  el.close();

  expect(opened).toBe(1);
  expect(closed).toBe(1);

  host.remove();
});
