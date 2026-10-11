import { expect, test } from 'vitest';

import { mount, settle } from '../../testing/index.js';

import type { DropletPopover } from './index.js';
import '../../testing/define-all.js';

function makePopover (): { host: HTMLDivElement; el: DropletPopover } {
  const host = mount(`
    <droplet-popover label="Options">
      <button slot="trigger">Open</button>
      <div slot="content"><button>Item</button></div>
    </droplet-popover>`);
  return { host, el: host.querySelector('droplet-popover') as DropletPopover };
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

// The state has to land on the roled control assistive tech reads, not on a roleless host
async function expectTriggerState (triggerMarkup: string): Promise<void> {
  const host = mount(`
    <droplet-popover label="Settings">
      ${triggerMarkup}
      <div slot="content"><button>Item</button></div>
    </droplet-popover>`);
  const el      = host.querySelector('droplet-popover') as DropletPopover;
  const trigger = host.querySelector('[slot="trigger"]') as HTMLElement;

  await settle(2);

  const roled = trigger.shadowRoot?.querySelector('button') ?? trigger;

  expect(roled).toBeInstanceOf(HTMLButtonElement);
  expect(roled.getAttribute('aria-haspopup')).toBe('dialog');
  expect(roled.getAttribute('aria-expanded')).toBe('false');

  roled.click();
  expect(el.isOpen).toBe(true);
  expect(roled.getAttribute('aria-expanded')).toBe('true');

  el.close();
  expect(roled.getAttribute('aria-expanded')).toBe('false');

  host.remove();
}

test('removing an open popover leaves its trigger collapsed', () => {
  const { host, el } = makePopover();
  const trigger = host.querySelector('[slot="trigger"]') as HTMLElement;

  el.open();
  host.remove();

  expect(trigger.getAttribute('aria-expanded')).toBe('false');
});

test('reflects trigger state onto a native <button> trigger', async () => {
  await expectTriggerState('<button slot="trigger">Open</button>');
});

test('reflects trigger state onto the inner button of a droplet-button trigger', async () => {
  await expectTriggerState('<droplet-button slot="trigger">Open</droplet-button>');
});

test('reflects trigger state onto the inner button of a droplet-icon-button trigger', async () => {
  await expectTriggerState('<droplet-icon-button slot="trigger" label="Settings">⚙</droplet-icon-button>');
});
