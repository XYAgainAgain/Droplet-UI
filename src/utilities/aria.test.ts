import { expect, test } from 'vitest';

import { AriaLink, FORWARDED_ARIA, forwardAria } from './aria.js';

// A detached document still parsing, so DOMContentLoaded can be fired without touching the page
function loadingDocument (): Document {
  const doc = document.implementation.createHTMLDocument('');

  Object.defineProperty(doc, 'readyState', { value: 'loading', configurable: true });

  return doc;
}

test('a reconnect keeps one DOMContentLoaded pass per host, and disconnect drops it', () => {
  const doc  = loadingDocument();
  const host = doc.createElement('div');
  let passes = 0;
  const link = new AriaLink(host, () => { passes++; });

  link.connect();
  link.connect();
  expect(passes).toBe(2);

  doc.dispatchEvent(new Event('DOMContentLoaded'));
  expect(passes).toBe(3);

  link.connect();
  link.disconnect();
  expect(passes).toBe(4);

  doc.dispatchEvent(new Event('DOMContentLoaded'));
  expect(passes).toBe(4);
});

test('no DOMContentLoaded listener once the document has parsed', () => {
  const host = document.createElement('div');
  let passes = 0;
  const link = new AriaLink(host, () => { passes++; });

  link.connect();
  host.ownerDocument.dispatchEvent(new Event('DOMContentLoaded'));
  expect(passes).toBe(1);

  link.disconnect();
});

test('focusin on the host re-forwards only while connected', () => {
  const host = document.createElement('div');
  let passes = 0;
  const link = new AriaLink(host, () => { passes++; });
  const focusin = (): boolean => host.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));

  link.connect();
  focusin();
  focusin();
  expect(passes).toBe(3);

  link.disconnect();
  focusin();
  expect(passes).toBe(3);
});

test('aria-disabled is forwarded; aria-hidden and live-region attributes stay on the host', () => {
  expect(FORWARDED_ARIA).toContain('aria-disabled');

  for (const name of ['aria-hidden', 'aria-live', 'aria-atomic', 'aria-relevant']) {
    expect(FORWARDED_ARIA).not.toContain(name);
  }
});

type Reflecting = Element & { ariaDescribedByElements: Element[] | null; ariaActiveDescendantElement: Element | null };

test('IDREF attributes and explicitly set elements both forward by reference', () => {
  const page   = document.createElement('div');
  const hint   = document.createElement('p');
  const other  = document.createElement('p');
  const host   = document.createElement('div') as unknown as Reflecting;
  const target = host.attachShadow({ mode: 'open' }).appendChild(document.createElement('input')) as unknown as Reflecting;

  hint.id = 'aria-test-hint';
  page.append(hint, other, host);
  document.body.append(page);

  if (!('ariaDescribedByElements' in target)) {
    page.remove();
    return;
  }

  host.setAttribute('aria-describedby', 'aria-test-hint');
  forwardAria(host, target, 'aria-describedby');
  expect(target.ariaDescribedByElements).toEqual([hint]);

  // Explicit elements leave aria-describedby="" on the host, which must not wipe the link
  host.ariaDescribedByElements = [other, hint];
  expect(host.getAttribute('aria-describedby')).toBe('');
  forwardAria(host, target, 'aria-describedby');
  expect(target.ariaDescribedByElements).toEqual([other, hint]);

  host.ariaActiveDescendantElement = other;
  forwardAria(host, target, 'aria-activedescendant');
  expect(target.ariaActiveDescendantElement).toBe(other);

  host.removeAttribute('aria-describedby');
  host.removeAttribute('aria-activedescendant');
  forwardAria(host, target, 'aria-describedby');
  forwardAria(host, target, 'aria-activedescendant');
  expect(target.ariaDescribedByElements ?? []).toEqual([]);
  expect(target.ariaActiveDescendantElement).toBeNull();

  page.remove();
});
