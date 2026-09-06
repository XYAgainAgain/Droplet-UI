import { expect, test } from 'vitest';

import { defineAll } from '../../register.js';
import { jellyToast, JellyToaster } from './index.js';

defineAll({ strict: false });

test('jellyToast creates a shared toaster and appends a toast', () => {
  document.querySelector('jelly-toaster')?.remove();

  const el = jellyToast('Saved!', { tone: 'success', duration: 0 });

  const toaster = document.querySelector('jelly-toaster') as JellyToaster;
  expect(toaster).not.toBeNull();
  expect(el.classList.contains('toast')).toBe(true);
  expect(el.querySelector('.toast-text')!.textContent).toBe('Saved!');
  expect(el.getAttribute('role')).toBe('status');

  toaster.remove();
});

test('labels the tone for screen readers', () => {
  document.querySelector('jelly-toaster')?.remove();

  const el = jellyToast('Disk full', { tone: 'danger', duration: 0 });

  expect(el.querySelector('.sr-tone')!.textContent).toBe('Error:');

  document.querySelector('jelly-toaster')?.remove();
});

test('clicking the toast removes it', async () => {
  document.querySelector('jelly-toaster')?.remove();

  const el = jellyToast('Dismiss me', { duration: 0 });
  expect(el.isConnected).toBe(true);

  el.click();
  // toastOut resolves on the next animation frame under reduced motion / no anim
  await new Promise((resolve) => setTimeout(resolve, 400));

  expect(el.isConnected).toBe(false);

  document.querySelector('jelly-toaster')?.remove();
});
