import { expect, test } from 'vitest';

import { mount } from '../../testing/index.js';

import type { JellyDialog } from './index.js';
import '../../testing/define-all.js';

test('opening sets aria-modal and mirrors the heading as the accessible name', () => {
  const host = mount('<jelly-dialog><h2>Confirm delete</h2><p>Sure?</p></jelly-dialog>');
  const el = host.querySelector('jelly-dialog') as JellyDialog;

  el.showModal();

  const dialog = el.shadowRoot!.querySelector('.dialog') as HTMLElement;
  expect(el.open).toBe(true);
  expect(dialog.getAttribute('aria-modal')).toBe('true');
  expect(dialog.getAttribute('aria-label')).toBe('Confirm delete');

  el.open = false;
  host.remove();
});

test('an explicit label wins over the heading', () => {
  const host = mount('<jelly-dialog label="Settings"><h2>Ignored</h2></jelly-dialog>');
  const el = host.querySelector('jelly-dialog') as JellyDialog;

  el.open = true;

  const dialog = el.shadowRoot!.querySelector('.dialog') as HTMLElement;
  expect(dialog.getAttribute('aria-label')).toBe('Settings');

  el.open = false;
  host.remove();
});

test('emits an open event and locks the body scroll while open', () => {
  const host = mount('<jelly-dialog label="X"><p>Body</p></jelly-dialog>');
  const el = host.querySelector('jelly-dialog') as JellyDialog;

  let opened = 0;
  el.addEventListener('open', () => { opened++; });

  el.open = true;
  expect(opened).toBe(1);
  expect(document.body.style.overflow).toBe('hidden');

  el.open = false;
  host.remove();
});
