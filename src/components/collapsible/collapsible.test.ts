import { describe, expect, it, test, vi } from 'vitest';

import { mount, settle } from '../../testing/index.js';

import { defineAll } from '../../register.js';
import { installScopeBridge } from '../../cascade/index.js';
import { DropletCollapsible, defineCollapsible } from './index.js';

defineAll({ strict: false });

test('renders a header button reflecting the open state', () => {
  const host = mount('<droplet-collapsible open><span slot="header">Details</span>Body</droplet-collapsible>');
  const el = host.querySelector('droplet-collapsible') as DropletCollapsible;

  const head = el.shadowRoot!.querySelector('.head')!;
  expect(head.getAttribute('aria-expanded')).toBe('true');

  host.remove();
});

test('toggling fires exactly one toggle event per real change', () => {
  const host = mount('<droplet-collapsible><span slot="header">Details</span>Body</droplet-collapsible>');
  const el = host.querySelector('droplet-collapsible') as DropletCollapsible;

  let toggles = 0;
  el.addEventListener('toggle', () => { toggles += 1; });

  (el.shadowRoot!.querySelector('.head') as HTMLButtonElement).click();
  expect(el.open).toBe(true);
  expect(el.shadowRoot!.querySelector('.head')!.getAttribute('aria-expanded')).toBe('true');
  expect(toggles).toBe(1);

  host.remove();
});

describe('droplet-collapsible contracts', () => {
  it('registers through the helper', () => {
    expect(defineCollapsible().alreadyDefined).toEqual(['droplet-collapsible']);
    expect(DropletCollapsible.define().alreadyDefined).toEqual(['droplet-collapsible']);
  });

  it('emits one toggle for a programmatic open change and none for a no-op set', async () => {
    const host = mount(`<droplet-collapsible><span slot="header">H</span><p>Body</p></droplet-collapsible>`);
    await settle();
    const el = host.firstElementChild as DropletCollapsible;
    const seen = vi.fn();
    el.addEventListener('toggle', seen);
    el.open = true;
    await settle();
    expect(seen).toHaveBeenCalledTimes(1);
    expect(seen.mock.calls[0]![0].detail).toEqual({ open: true });
    expect(el.matches(':state(open)')).toBe(true);
    el.open = true;
    await settle();
    expect(seen).toHaveBeenCalledTimes(1);
    host.remove();
  });

  it('emits exactly one composed toggle per user click', async () => {
    const host = mount(`<droplet-collapsible><span slot="header">H</span><p>Body</p></droplet-collapsible>`);
    await settle();
    const el = host.firstElementChild as DropletCollapsible;
    const seen = vi.fn();
    el.addEventListener('toggle', seen);
    el.shadowRoot!.querySelector('button')!.click();
    await settle();
    expect(seen).toHaveBeenCalledTimes(1);
    expect(seen.mock.calls[0]![0].composed).toBe(true);
    expect(seen.mock.calls[0]![0].bubbles).toBe(true);
    expect(seen.mock.calls[0]![0].cancelable).toBe(false);
    host.remove();
  });

  it('emits a toggle when the open attribute changes and clears the state on close', async () => {
    const host = mount(`<droplet-collapsible><span slot="header">H</span><p>Body</p></droplet-collapsible>`);
    await settle();
    const el = host.firstElementChild as DropletCollapsible;
    const seen = vi.fn();
    el.addEventListener('toggle', seen);

    el.setAttribute('open', '');
    expect(seen).toHaveBeenCalledTimes(1);
    expect(el.matches(':state(open)')).toBe(true);

    // Rewriting a present boolean attribute is not a transition
    el.setAttribute('open', 'still-open');
    expect(seen).toHaveBeenCalledTimes(1);

    el.removeAttribute('open');
    expect(seen).toHaveBeenCalledTimes(2);
    expect(seen.mock.calls[1]![0].detail).toEqual({ open: false });
    expect(el.matches(':state(open)')).toBe(false);

    host.remove();
  });

  it('does not emit for the open attribute present at upgrade', async () => {
    const tag = 'jelly-collapsible-upgrade-open';
    const host = document.createElement('div');
    host.innerHTML = `<${tag} open><span slot="header">H</span><p>Body</p></${tag}>`;
    const seen = vi.fn();
    host.addEventListener('toggle', seen);
    document.body.appendChild(host);

    customElements.define(tag, class extends DropletCollapsible {});
    await settle();

    const el = host.firstElementChild as DropletCollapsible;
    expect(el.open).toBe(true);
    expect(el.matches(':state(open)')).toBe(true);
    expect(seen).not.toHaveBeenCalled();
    host.remove();
  });

  it('emits one toggle for an open change made while disconnected', async () => {
    const el = document.createElement('droplet-collapsible') as DropletCollapsible;
    const seen = vi.fn();
    el.addEventListener('toggle', seen);

    el.open = true;
    expect(seen).toHaveBeenCalledTimes(1);
    expect(seen.mock.calls[0]![0].detail).toEqual({ open: true });

    document.body.appendChild(el);
    await settle();
    expect(seen).toHaveBeenCalledTimes(1);
    expect(el.matches(':state(open)')).toBe(true);
    el.remove();
  });

  it('reads quality from the nearest scope and lets the element attribute win', async () => {
    installScopeBridge(document);
    const host = mount(`<div data-droplet-quality="low">
      <droplet-collapsible id="a"><span slot="header">A</span>1</droplet-collapsible>
      <droplet-collapsible id="b" quality="hi"><span slot="header">B</span>2</droplet-collapsible>
    </div>`);
    await settle();
    const a = host.querySelector('#a') as DropletCollapsible;
    const b = host.querySelector('#b') as DropletCollapsible;
    expect(a.quality).toBe('low');
    expect(b.quality).toBe('high');
    host.remove();
  });

  it('reflects the canonical quality keyword and defaults invalid input', async () => {
    const host = mount(`<droplet-collapsible quality="med"><span slot="header">H</span>B</droplet-collapsible>`);
    await settle();
    const el = host.firstElementChild as DropletCollapsible;
    expect(el.quality).toBe('medium');
    expect(el.getAttribute('quality')).toBe('medium');

    el.quality = 'low';
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

  it('replays properties set before upgrade, with markup winning', async () => {
    const tag = 'jelly-collapsible-not-yet';
    const early = document.createElement(tag) as HTMLElement & { open?: boolean; quality?: string };
    early.open = true;
    early.quality = 'lo';

    const markup = document.createElement(tag) as HTMLElement & { open?: boolean };
    markup.setAttribute('open', '');
    markup.open = false;

    document.body.append(early, markup);
    customElements.define(tag, class extends DropletCollapsible {});
    await settle();

    expect((early as unknown as DropletCollapsible).open).toBe(true);
    expect((early as unknown as DropletCollapsible).quality).toBe('low');
    expect((markup as unknown as DropletCollapsible).open).toBe(true);

    early.remove();
    markup.remove();
  });
});

test('an open chevron rotates in RTL under reduced motion too', async () => {
  document.documentElement.setAttribute('data-droplet-motion', 'reduce');
  const host = mount('<div dir="rtl"><droplet-collapsible open><span slot="header">H</span>Body</droplet-collapsible></div>');
  const el = host.querySelector('droplet-collapsible')!;

  try {
    await settle(2);
    const chevron = el.shadowRoot!.querySelector('.chevron')!;
    const open = new DOMMatrix(getComputedStyle(chevron).transform);
    expect(Math.round(open.b)).toBe(1);

    el.removeAttribute('open');
    await settle(1);
    const closed = new DOMMatrix(getComputedStyle(chevron).transform);
    expect(closed.a).toBe(-1);
  } finally {
    document.documentElement.removeAttribute('data-droplet-motion');
    host.remove();
  }
});
