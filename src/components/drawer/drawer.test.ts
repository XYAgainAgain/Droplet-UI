import { expect, test } from 'vitest';

import { mount } from '../../testing/index.js';

import type { DropletDrawer } from './index.js';
import '../../testing/define-all.js';

test('defaults to the end side and presents as a modal dialog', () => {
  const host = mount('<droplet-drawer><nav>Links</nav></droplet-drawer>');
  const el = host.querySelector('droplet-drawer') as DropletDrawer;

  expect(el.getAttribute('side')).toBe('end');

  const sheet = el.shadowRoot!.querySelector('.sheet') as HTMLElement;
  expect(sheet.getAttribute('role')).toBe('dialog');
  expect(sheet.getAttribute('aria-modal')).toBe('true');

  host.remove();
});

test('opening emits open, locks scroll and mirrors the heading name', () => {
  const host = mount('<droplet-drawer><h2>Filters</h2></droplet-drawer>');
  const el = host.querySelector('droplet-drawer') as DropletDrawer;

  let opened = 0;
  el.addEventListener('open', () => { opened++; });

  el.open = true;

  const sheet = el.shadowRoot!.querySelector('.sheet') as HTMLElement;
  expect(opened).toBe(1);
  expect(document.body.style.overflow).toBe('hidden');
  expect(sheet.getAttribute('aria-label')).toBe('Filters');

  el.open = false;
  host.remove();
});

test('the close button dismisses the drawer and emits close', async () => {
  const host = mount('<droplet-drawer><nav>Links</nav></droplet-drawer>');
  const el = host.querySelector('droplet-drawer') as DropletDrawer;

  el.open = true;

  const close = el.shadowRoot!.querySelector('.close') as HTMLButtonElement;
  expect(close.getAttribute('aria-label')).toBe('Close');

  // The close plays a slide-out; the open attribute drops when it finishes
  const closed = new Promise<void>((resolve) => el.addEventListener('close', () => resolve(), { once: true }));
  close.click();
  await closed;

  expect(el.open).toBe(false);

  host.remove();
});

test('resolvedSide maps start / end to physical sides', () => {
  const host = mount('<droplet-drawer side="start"><p>x</p></droplet-drawer>');
  const el = host.querySelector('droplet-drawer') as DropletDrawer;

  expect(el.resolvedSide).toBe('left');

  el.setAttribute('side', 'bottom');
  expect(el.resolvedSide).toBe('bottom');

  host.remove();
});
