import { afterEach, beforeEach, describe, expect, it, test, vi } from 'vitest';
import { userEvent } from 'vitest/browser';

import { mount, settle } from '../../testing/index.js';

import { installScopeBridge } from '../../cascade/index.js';
import { defineAll } from '../../register.js';
import { defineToaster, jellyToast, JellyToaster } from './index.js';

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

describe('jelly-toaster contracts', () => {
  it('registers through the helper and is a no-op the second time', () => {
    expect(defineToaster().alreadyDefined).toEqual(['jelly-toaster']);
    expect(JellyToaster.define().alreadyDefined).toEqual(['jelly-toaster']);
  });

  it('reads quality from the nearest scope and lets the element attribute win', async () => {
    installScopeBridge(document);

    const host = mount(`<div data-droplet-quality="low">
      <jelly-toaster id="a"></jelly-toaster>
      <jelly-toaster id="b" quality="hi"></jelly-toaster>
    </div>`);
    await settle();

    expect((host.querySelector('#a') as JellyToaster).quality).toBe('low');
    expect((host.querySelector('#b') as JellyToaster).quality).toBe('high');

    host.remove();
  });

  it('reflects the canonical quality keyword and leaves garbage as written', async () => {
    const host = mount('<jelly-toaster quality="med"></jelly-toaster>');
    await settle();
    const el = host.firstElementChild as JellyToaster;

    expect(el.quality).toBe('medium');
    expect(el.getAttribute('quality')).toBe('medium');

    el.quality = 'lo';
    expect(el.getAttribute('quality')).toBe('low');
    expect(el.quality).toBe('low');

    // Unrecognized text resolves to the default and is left as written
    el.setAttribute('quality', 'potato');
    expect(el.quality).toBe('medium');
    expect(el.getAttribute('quality')).toBe('potato');

    el.quality = null;
    expect(el.hasAttribute('quality')).toBe(false);

    host.remove();
  });

  it('registers the toaster on demand when the tag is not defined', async () => {
    // A realm that imported the module but never called defineAll(): jellyToast
    // has to register the tag itself or push() lands on an unupgraded element.
    const url   = new URL('./index.ts', import.meta.url).href;
    const frame = document.createElement('iframe');

    frame.srcdoc = `<!doctype html><body><script type="module">
      window.onerror = (m) => { document.documentElement.dataset.ready = 'err:' + m; };
      import(${JSON.stringify(url)}).then((m) => {
        m.jellyToast('from a bare realm', { duration: 0 });
        document.documentElement.dataset.ready = 'yes';
      }).catch((e) => { document.documentElement.dataset.ready = 'err:' + e; });
    <\/script>`;

    document.body.appendChild(frame);
    await vi.waitFor(() => {
      expect(frame.contentDocument?.documentElement.dataset['ready']).toBe('yes');
    }, { timeout: 5000 });

    const inner   = frame.contentDocument!;
    const toaster = inner.querySelector('jelly-toaster');

    expect(frame.contentWindow!.customElements.get('jelly-toaster')).toBeTruthy();
    expect(toaster!.shadowRoot!.querySelector('.toast-text')!.textContent).toBe('from a bare realm');

    frame.remove();
  });

  it('replays a quality property set before upgrade and lets markup win', async () => {
    const tag = 'jelly-toaster-not-yet';
    const early = document.createElement(tag) as HTMLElement & { quality?: string };
    const markup = document.createElement(tag) as HTMLElement & { quality?: string };

    early.quality = 'lo';
    markup.setAttribute('quality', 'high');
    markup.quality = 'low';

    document.body.append(early, markup);
    customElements.define(tag, class extends JellyToaster {});
    await settle();

    expect((early as unknown as JellyToaster).quality).toBe('low');
    expect(early.getAttribute('quality')).toBe('low');
    expect((markup as unknown as JellyToaster).quality).toBe('high');

    early.remove();
    markup.remove();
  });
});

describe('jelly-toaster timers', () => {
  // toastOut resolves synchronously under reduced motion, so these tests can
  // assert removal on a short wait instead of the 320 ms exit animation.
  beforeEach(() => {
    document.documentElement.setAttribute('data-jelly-motion', 'reduce');
    document.querySelector('jelly-toaster')?.remove();
  });

  afterEach(() => {
    document.documentElement.removeAttribute('data-jelly-motion');
    document.querySelector('jelly-toaster')?.remove();
  });

  it('pauses the toast timer while hovered', async () => {
    const el = jellyToast('hi', { duration: 60 });
    el.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 120));
    expect(el.isConnected).toBe(true);
    el.dispatchEvent(new PointerEvent('pointerleave', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 120));
    expect(el.isConnected).toBe(false);
  });

  it('pauses the toast timer while focus is inside', async () => {
    const el = jellyToast('focus me', { duration: 60 });
    const close = el.querySelector('.close') as HTMLButtonElement;

    close.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 120));
    expect(el.isConnected).toBe(true);

    // Focus moving between the toast's own children must not resume it
    close.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: el.querySelector('.toast-text') }));
    await new Promise((r) => setTimeout(r, 120));
    expect(el.isConnected).toBe(true);

    close.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 120));
    expect(el.isConnected).toBe(false);
  });

  it('clears a live timer when the toast is removed', async () => {
    const el = jellyToast('live', { duration: 60 });
    const spy = vi.spyOn(el, 'remove');

    el.parentNode!.removeChild(el);
    await new Promise((r) => setTimeout(r, 150));

    expect(spy).not.toHaveBeenCalled();
  });

  it('clears a paused timer when the toast is removed', async () => {
    const el = jellyToast('paused', { duration: 60 });
    el.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));

    const spy = vi.spyOn(el, 'remove');
    el.parentNode!.removeChild(el);
    el.dispatchEvent(new PointerEvent('pointerleave', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 150));

    expect(spy).not.toHaveBeenCalled();
  });

  it('does not re-arm the timer after a click dismissal', async () => {
    const el   = jellyToast('bye', { duration: 100 });
    const rail = (document.querySelector('jelly-toaster') as JellyToaster).shadowRoot!.querySelector('.rail')!;

    // The click cancels the timer and starts the exit; a pointer crossing the
    // toast during that window must not schedule an untracked second timeout.
    el.click();
    el.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));
    el.dispatchEvent(new PointerEvent('pointerleave', { bubbles: true }));

    await new Promise((r) => setTimeout(r, 60));
    rail.appendChild(el);
    await new Promise((r) => setTimeout(r, 300));

    expect(el.isConnected).toBe(true);
    el.remove();
  });

  it('does not re-arm the timer after it has fired', async () => {
    const el   = jellyToast('gone', { duration: 60 });
    const rail = (document.querySelector('jelly-toaster') as JellyToaster).shadowRoot!.querySelector('.rail')!;

    await new Promise((r) => setTimeout(r, 150));
    expect(el.isConnected).toBe(false);

    // Stand in for the exit-animation window, where the toast is still in the
    // rail but its cancel handle is already gone
    rail.appendChild(el);

    const spy = vi.spyOn(el, 'remove');
    el.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));
    el.dispatchEvent(new PointerEvent('pointerleave', { bubbles: true }));

    await new Promise((r) => setTimeout(r, 250));

    expect(spy).not.toHaveBeenCalled();
    el.remove();
  });

  it('dismisses from the keyboard through the close button', async () => {
    const el = jellyToast('keyboard', { duration: 0 });
    const close = el.querySelector('.close') as HTMLButtonElement;

    close.focus();
    expect((el.getRootNode() as ShadowRoot).activeElement).toBe(close);

    await userEvent.keyboard('{Enter}');
    await settle();

    expect(el.isConnected).toBe(false);
  });
});
