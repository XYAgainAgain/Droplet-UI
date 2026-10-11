import { expect, test } from 'vitest';

import { mount, settle } from '../../testing/index.js';

import type { DropletKbd } from './index.js';
import '../../testing/define-all.js';

test('upgrades as a role=button keycap', async () => {
  const host = mount('<droplet-kbd>K</droplet-kbd>');
  const el = host.querySelector('droplet-kbd') as DropletKbd;

  await settle(3);
  expect(el.getAttribute('role')).toBe('button');
  expect(el.shadowRoot!.querySelector('.cap')).toBeTruthy();

  host.remove();
});

test('key="a" mirrors the physical key document-wide', async () => {
  const host = mount('<droplet-kbd key="a">A</droplet-kbd>');
  const el = host.querySelector('droplet-kbd') as DropletKbd;

  await settle(3);
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
  expect(el.classList.contains('pressed')).toBe(true);

  document.dispatchEvent(new KeyboardEvent('keyup', { key: 'a' }));
  expect(el.classList.contains('pressed')).toBe(false);

  host.remove();
});

function mirrored (html: string): { host: HTMLDivElement; el: DropletKbd } {
  const host = mount(html);
  return { host, el: host.querySelector('droplet-kbd') as DropletKbd };
}

function tap (target: EventTarget, init: KeyboardEventInit): void {
  target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, composed: true, ...init }));
}

test('the key mirror ignores typing, including in a field inside a shadow root', async () => {
  const { host, el } = mirrored('<droplet-kbd key="a">A</droplet-kbd><input><div class="shadow"></div>');
  const shadowInput = document.createElement('input');
  host.querySelector('.shadow')!.attachShadow({ mode: 'open' }).append(shadowInput);

  await settle(3);
  tap(host.querySelector('input')!, { key: 'a' });
  expect(el.classList.contains('pressed')).toBe(false);

  tap(shadowInput, { key: 'a' });
  expect(el.classList.contains('pressed')).toBe(false);

  const checkbox = Object.assign(document.createElement('input'), { type: 'checkbox' });
  host.append(checkbox);
  tap(checkbox, { key: 'a' });
  expect(el.classList.contains('pressed')).toBe(true);

  host.remove();
});

test('the key mirror ignores Ctrl, Alt, and Meta chords but not Shift', async () => {
  const { host, el } = mirrored('<droplet-kbd key="a">A</droplet-kbd><droplet-kbd key="Control">Ctrl</droplet-kbd>');
  const ctrl = host.querySelectorAll('droplet-kbd')[1] as DropletKbd;

  await settle(3);
  for (const modifier of ['ctrlKey', 'altKey', 'metaKey']) {
    tap(document, { key: 'a', [modifier]: true });
    expect(el.classList.contains('pressed')).toBe(false);
  }

  tap(document, { key: 'A', shiftKey: true });
  expect(el.classList.contains('pressed')).toBe(true);

  tap(document, { key: 'Control', ctrlKey: true });
  expect(ctrl.classList.contains('pressed')).toBe(true);

  host.remove();
});

test('a chord key presses only with its modifiers and releases with them', async () => {
  const { host, el } = mirrored('<droplet-kbd key="Meta+k">K</droplet-kbd>');

  await settle(3);
  tap(document, { key: 'k' });
  expect(el.classList.contains('pressed')).toBe(false);

  tap(document, { key: 'k', metaKey: true, ctrlKey: true });
  expect(el.classList.contains('pressed')).toBe(false);

  tap(document, { key: 'k', metaKey: true });
  expect(el.classList.contains('pressed')).toBe(true);

  document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Meta' }));
  expect(el.classList.contains('pressed')).toBe(false);

  host.remove();
});

test('data-droplet-shortcuts="off" silences the mirror, and the closest scope wins', async () => {
  const { host, el } = mirrored('<section data-droplet-shortcuts="on"><droplet-kbd key="b">B</droplet-kbd></section><droplet-kbd key="b">B</droplet-kbd>');
  const outer = host.querySelectorAll('droplet-kbd')[1] as DropletKbd;

  await settle(3);
  document.documentElement.setAttribute('data-droplet-shortcuts', 'OFF');

  try {
    tap(document, { key: 'b' });
    expect(outer.classList.contains('pressed')).toBe(false);
    expect(el.classList.contains('pressed')).toBe(true);

    document.dispatchEvent(new KeyboardEvent('keyup', { key: 'b' }));
    document.documentElement.removeAttribute('data-droplet-shortcuts');
    tap(document, { key: 'b' });
    expect(outer.classList.contains('pressed')).toBe(true);
  } finally {
    document.documentElement.removeAttribute('data-droplet-shortcuts');
    host.remove();
  }
});

test('the scope is read through shadow roots', async () => {
  const host = mount('<div data-droplet-shortcuts="off"><div class="shell"></div></div>');
  const cap = document.createElement('droplet-kbd');
  cap.setAttribute('key', 'c');
  host.querySelector('.shell')!.attachShadow({ mode: 'open' }).append(cap);

  await settle(3);
  tap(document, { key: 'c' });
  expect(cap.classList.contains('pressed')).toBe(false);

  host.remove();
});

test('decorative drops the role and tab stop and restores them when removed', async () => {
  const host = mount('<button type="button"><droplet-kbd decorative>T</droplet-kbd> theme</button>');
  const el = host.querySelector('droplet-kbd') as DropletKbd;

  await settle(3);
  expect(el.decorative).toBe(true);
  expect(el.hasAttribute('role')).toBe(false);
  expect(el.hasAttribute('tabindex')).toBe(false);
  expect(el.getAttribute('aria-hidden')).toBe(null);
  expect(host.querySelector('button')!.textContent).toContain('T');

  el.decorative = false;
  expect(el.getAttribute('role')).toBe('button');
  expect(el.tabIndex).toBe(0);

  el.focus();
  el.decorative = true;
  expect(el.hasAttribute('tabindex')).toBe(false);
  expect(document.activeElement).not.toBe(el);

  host.remove();
});

test('changing or removing key while the old key is held lets the cap back up', async () => {
  const { host, el } = mirrored('<droplet-kbd key="a">A</droplet-kbd>');

  await settle(3);
  tap(document, { key: 'a' });
  expect(el.classList.contains('pressed')).toBe(true);

  el.setAttribute('key', 'b');
  expect(el.classList.contains('pressed')).toBe(false);

  document.dispatchEvent(new KeyboardEvent('keyup', { key: 'a' }));
  tap(document, { key: 'b' });
  expect(el.classList.contains('pressed')).toBe(true);

  el.removeAttribute('key');
  expect(el.classList.contains('pressed')).toBe(false);

  document.dispatchEvent(new KeyboardEvent('keyup', { key: 'b' }));
  expect(el.classList.contains('pressed')).toBe(false);

  host.remove();
});

test('the cap stays down until every press source lets go', async () => {
  const { host, el } = mirrored('<droplet-kbd key="a">A</droplet-kbd>');
  const pointer = (type: string): boolean => el.dispatchEvent(new PointerEvent(type, { pointerId: 7, clientX: 0, clientY: 0 }));

  await settle(3);
  pointer('pointerdown');
  tap(document, { key: 'a' });

  document.dispatchEvent(new KeyboardEvent('keyup', { key: 'a' }));
  expect(el.classList.contains('pressed')).toBe(true);

  pointer('pointerup');
  expect(el.classList.contains('pressed')).toBe(false);

  tap(document, { key: 'a' });
  pointer('pointerdown');
  pointer('pointerup');
  expect(el.classList.contains('pressed')).toBe(true);

  el.remove();
  expect(el.classList.contains('pressed')).toBe(false);

  host.remove();
});
