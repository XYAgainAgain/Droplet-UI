import { expect, test, vi } from 'vitest';

import { mount, settle } from '../../testing/index.js';

import './index.js';
import type { JellyIconButton } from './index.js';

test('upgrades with a labelled inner button', async () => {
  const host = mount('<jelly-icon-button label="Search">🔍</jelly-icon-button>');
  const el = host.querySelector('jelly-icon-button') as JellyIconButton;

  await settle(3);
  const button = el.shadowRoot!.querySelector('button') as HTMLButtonElement;
  expect(button).toBeInstanceOf(HTMLButtonElement);
  expect(button.getAttribute('aria-label')).toBe('Search');

  host.remove();
});

test('disabled reflects onto the inner button', async () => {
  const host = mount('<jelly-icon-button label="Close" disabled>✕</jelly-icon-button>');
  const el = host.querySelector('jelly-icon-button') as JellyIconButton;

  await settle(3);
  expect((el.shadowRoot!.querySelector('button') as HTMLButtonElement).disabled).toBe(true);

  host.remove();
});

test('does not activate when a pointer is released outside the button', async () => {
  const host = mount('<jelly-icon-button label="Close">✕</jelly-icon-button>');
  const el = host.querySelector('jelly-icon-button') as JellyIconButton;
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

const inner = (el: JellyIconButton): HTMLButtonElement => el.shadowRoot!.querySelector('button')!;

test('aria-label names the inner button when label is absent, and label wins', async () => {
  const host = mount('<jelly-icon-button aria-label="Next image">→</jelly-icon-button>');
  const el = host.querySelector('jelly-icon-button') as JellyIconButton;

  await settle(2);
  expect(inner(el).getAttribute('aria-label')).toBe('Next image');

  el.setAttribute('aria-label', 'Previous image');
  expect(inner(el).getAttribute('aria-label')).toBe('Previous image');

  el.setAttribute('label', 'Close');
  expect(inner(el).getAttribute('aria-label')).toBe('Close');

  el.removeAttribute('label');
  expect(inner(el).getAttribute('aria-label')).toBe('Previous image');

  host.remove();
});

test('forwards expanded, haspopup, pressed, and controls state onto the inner button', async () => {
  const host = mount(`
    <jelly-icon-button label="Settings" aria-expanded="false" aria-haspopup="dialog" aria-pressed="true" aria-controls="ib-tray">⚙</jelly-icon-button>
    <div id="ib-tray">Tray</div>`);
  const el = host.querySelector('jelly-icon-button') as JellyIconButton;

  await settle(2);
  const button = inner(el);

  expect(button.getAttribute('aria-expanded')).toBe('false');
  expect(button.getAttribute('aria-haspopup')).toBe('dialog');
  expect(button.getAttribute('aria-pressed')).toBe('true');

  el.setAttribute('aria-expanded', 'true');
  expect(button.getAttribute('aria-expanded')).toBe('true');

  el.removeAttribute('aria-pressed');
  expect(button.hasAttribute('aria-pressed')).toBe(false);

  if ('ariaControlsElements' in button) {
    expect(button.ariaControlsElements).toEqual([host.querySelector('#ib-tray')]);
  }

  host.remove();
});

test('disabled and name reflect as IDL properties', async () => {
  const host = mount('<jelly-icon-button label="Zoom" name="zoom">+</jelly-icon-button>');
  const el = host.querySelector('jelly-icon-button') as JellyIconButton;

  await settle(2);

  expect(el.name).toBe('zoom');
  expect(el.disabled).toBe(false);

  el.disabled = true;
  expect(el.hasAttribute('disabled')).toBe(true);
  expect(el.matches(':disabled')).toBe(true);
  expect(inner(el).disabled).toBe(true);

  el.name = 'zoom-in';
  expect(el.getAttribute('name')).toBe('zoom-in');

  host.remove();
});

test('a disabled fieldset disables it without touching the host attribute', async () => {
  const host = mount('<fieldset><jelly-icon-button label="Next">→</jelly-icon-button></fieldset>');
  const el = host.querySelector('jelly-icon-button') as JellyIconButton;
  const fieldset = host.querySelector('fieldset')!;

  await settle(2);

  fieldset.disabled = true;
  await settle(1);

  expect(el.matches(':disabled')).toBe(true);
  expect(el.hasAttribute('disabled')).toBe(false);
  expect(inner(el).disabled).toBe(true);
  expect(inner(el).tabIndex).toBe(-1);

  fieldset.disabled = false;
  await settle(1);

  expect(el.matches(':disabled')).toBe(false);
  expect(inner(el).disabled).toBe(false);
  expect(inner(el).tabIndex).toBe(0);

  host.remove();
});

test('host.click() activates the inner button once and does nothing while disabled', async () => {
  const host = mount('<fieldset><jelly-icon-button label="Next">→</jelly-icon-button></fieldset>');
  const el = host.querySelector('jelly-icon-button') as JellyIconButton;
  const fieldset = host.querySelector('fieldset')!;
  const onClick = vi.fn();
  const onInner = vi.fn();

  await settle(2);
  el.addEventListener('click', onClick);
  inner(el).addEventListener('click', onInner);

  el.click();
  expect(onClick).toHaveBeenCalledTimes(1);
  expect(onInner).toHaveBeenCalledTimes(1);

  el.disabled = true;
  el.click();
  el.disabled = false;
  fieldset.disabled = true;
  el.click();
  expect(onClick).toHaveBeenCalledTimes(1);

  host.remove();
});

test('host.click() before build still dispatches one click', () => {
  const el = document.createElement('jelly-icon-button') as JellyIconButton;
  const onClick = vi.fn();

  el.addEventListener('click', onClick);
  el.click();
  expect(onClick).toHaveBeenCalledTimes(1);
});

test('forwards aria-disabled and links a late IDREF target on focusin', async () => {
  const host = mount('<jelly-icon-button label="Menu" aria-disabled="true" aria-controls="ib-late">≡</jelly-icon-button>');
  const el = host.querySelector('jelly-icon-button') as JellyIconButton;

  await settle(2);
  const button = inner(el);

  expect(button.getAttribute('aria-disabled')).toBe('true');

  if ('ariaControlsElements' in button) {
    const late = document.createElement('div');
    late.id = 'ib-late';
    host.append(late);

    button.dispatchEvent(new FocusEvent('focusin', { bubbles: true, composed: true }));
    expect(button.ariaControlsElements).toEqual([late]);
  }

  host.remove();
});

test('reassigning name or disabled to its current value writes no attribute', async () => {
  const host = mount('<jelly-icon-button label="Zoom">+</jelly-icon-button>');
  const el = host.querySelector('jelly-icon-button') as JellyIconButton;
  const observer = new MutationObserver(() => {});

  await settle(2);
  el.name = 'zoom';
  el.disabled = true;

  observer.observe(el, { attributes: true });
  el.name = 'zoom';
  el.disabled = true;
  expect(observer.takeRecords()).toEqual([]);

  observer.disconnect();
  host.remove();
});
