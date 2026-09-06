import { expect, test } from 'vitest';

import { ensureThemeTokens, onThemeChange } from './runtime.js';

// MutationObserver callbacks land as microtasks; a macrotask turn clears them all
const flush = (): Promise<void> => new Promise(resolve => { setTimeout(resolve, 0); });

async function bodylessFrame (): Promise<HTMLIFrameElement> {
  const frame = document.createElement('iframe');

  frame.srcdoc = '<!doctype html><html><head></head><body></body></html>';
  document.body.appendChild(frame);

  await new Promise(resolve => frame.addEventListener('load', resolve, { once: true }));
  frame.contentDocument!.body.remove();

  return frame;
}

test('observes dir on a body that arrives after the tokens were installed', async () => {
  const frame = await bodylessFrame();
  const doc = frame.contentDocument!;

  ensureThemeTokens(doc);

  doc.documentElement.appendChild(doc.createElement('body'));
  await flush();

  let fired = 0;
  const off = onThemeChange(() => { fired += 1; });

  doc.body.setAttribute('dir', 'rtl');
  await flush();
  off();
  frame.remove();

  expect(fired).toBe(1);
});

test('keeps observing dir on documentElement when there is no body', async () => {
  const frame = await bodylessFrame();
  const doc = frame.contentDocument!;

  ensureThemeTokens(doc);

  let fired = 0;
  const off = onThemeChange(() => { fired += 1; });

  doc.documentElement.setAttribute('dir', 'rtl');
  await flush();
  off();
  frame.remove();

  expect(fired).toBe(1);
});
