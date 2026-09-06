import { describe, expect, test, vi } from 'vitest';
import { userEvent } from 'vitest/browser';

import { mount, settle } from '../../testing/index.js';

import { installScopeBridge } from '../../cascade/index.js';
import { DEFAULT_CONFIG, JellyBody } from '../../core/index.js';
import { registerPreset } from '../../presets/index.js';
import { defineAll } from '../../register.js';
import { defineButton, JellyButton } from './index.js';

defineAll({ strict: false });

test('upgrades and renders a real inner <button>', async () => {
  const host = mount('<jelly-button>Go</jelly-button>');
  const el = host.querySelector('jelly-button') as JellyButton;

  await settle(20);

  expect(el.shadowRoot).toBeTruthy();
  expect(el.shadowRoot!.querySelector('button')).toBeInstanceOf(HTMLButtonElement);

  host.remove();
});

test('disabled reflects onto the inner button and back', async () => {
  const host = mount('<jelly-button disabled>Go</jelly-button>');
  const el = host.querySelector('jelly-button') as JellyButton;

  await settle(3);
  const inner = el.shadowRoot!.querySelector('button')!;
  expect(inner.disabled).toBe(true);

  el.removeAttribute('disabled');
  await settle(2);
  expect(inner.disabled).toBe(false);

  host.remove();
});

test('variant="mint" paints the mint fill on the canvas', async () => {
  const host = mount('<jelly-button variant="mint">Go</jelly-button>');
  const el = host.querySelector('jelly-button') as JellyButton;

  await settle(20);

  const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
  const pixel = canvas.getContext('2d')!.getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data;

  // mint = #178746 = rgb(23, 135, 70)
  expect(Math.abs(pixel[0]! - 23)).toBeLessThan(8);
  expect(Math.abs(pixel[1]! - 135)).toBeLessThan(8);
  expect(Math.abs(pixel[2]! - 70)).toBeLessThan(8);
  expect(pixel[3]).toBe(255);

  host.remove();
});

test('type="submit" drives the closest light-DOM form', async () => {
  const host = mount('<form><jelly-button type="submit">Save</jelly-button></form>');
  const el = host.querySelector('jelly-button') as JellyButton;

  await settle(3);

  let submitted = false;
  host.querySelector('form')!.addEventListener('submit', (event) => {
    event.preventDefault();
    submitted = true;
  });

  el.shadowRoot!.querySelector('button')!.click();
  expect(submitted).toBe(true);

  host.remove();
});

test('does not activate when a pointer is released outside the button', async () => {
  const host = mount('<jelly-button>Go</jelly-button>');
  const el = host.querySelector('jelly-button') as JellyButton;
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

describe('jelly-button contracts', () => {

  test('registers through the helper and is a no-op the second time', () => {
    expect(defineButton().alreadyDefined).toEqual(['jelly-button']);
  });

  test('reads feel from the nearest scope and lets the element override it', async () => {
    installScopeBridge(document);
    registerPreset('feel', 'test-stiff', { pressure: 900 }, { override: true });

    const host = mount('<div data-droplet-feel="test-stiff"><jelly-button>A</jelly-button><jelly-button feel="gel">B</jelly-button></div>');

    // Read before any frame: the scope and its children were inserted together,
    // so this is the case the bridge's observer has not seen yet
    const first = host.querySelector('jelly-button') as JellyButton;
    expect(first.feel).toBe('test-stiff');
    expect(first.resolvedConfig.pressure).toBe(900);

    await settle();

    const [a, b] = host.querySelectorAll('jelly-button') as NodeListOf<JellyButton>;

    expect(a!.feel).toBe('test-stiff');
    expect(a!.resolvedConfig.pressure).toBe(900);
    expect(b!.feel).toBe('gel');
    expect(b!.resolvedConfig.pressure).toBe(DEFAULT_CONFIG.pressure);

    host.remove();
  });

  test('a fractional pass count in a preset does not rebuild the membrane on every resolve', async () => {
    registerPreset('feel', 'test-fractional', { normalBlendPasses: 2.5 }, { override: true });

    const host = mount('<jelly-button feel="test-fractional">F</jelly-button>');
    await settle();

    const el = host.firstElementChild as JellyButton;

    expect(el.resolvedConfig.normalBlendPasses).toBe(3);

    const resize = vi.spyOn(el.body!, 'resize');

    el.resolve();
    el.resolve();

    expect(resize).not.toHaveBeenCalled();

    resize.mockRestore();
    host.remove();
  });

  test('builds the membrane once on first shape, seeded from the resolved record', async () => {
    registerPreset('feel', 'test-coarse', { samples: 96 }, { override: true });

    const resize = vi.spyOn(JellyBody.prototype, 'resize');
    const host   = mount('<jelly-button feel="test-coarse">S</jelly-button>');

    await settle(6);

    const el = host.firstElementChild as JellyButton;

    expect(el.resolvedConfig.samples).toBe(96);
    expect(el.body!.config.samples).toBe(96);
    expect(resize).not.toHaveBeenCalled();

    resize.mockRestore();
    host.remove();
  });

  test('warns once per unknown feel name', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const host = mount('<jelly-button feel="no-such-feel">A</jelly-button><jelly-button feel="no-such-feel">B</jelly-button>');
    await settle();

    const [a] = host.querySelectorAll('jelly-button') as NodeListOf<JellyButton>;

    expect(a!.feel).toBe('gel');
    expect(a!.getAttribute('feel')).toBe('no-such-feel');
    expect(warn).toHaveBeenCalledTimes(1);

    warn.mockRestore();
    host.remove();
  });

  test('warns and falls back to gel for an empty feel attribute', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const host = mount('<jelly-button feel="">E</jelly-button>');
    await settle();

    const el = host.firstElementChild as JellyButton;

    expect(el.feel).toBe('gel');
    expect(el.getAttribute('feel')).toBe('');
    expect(warn).toHaveBeenCalledTimes(1);

    warn.mockRestore();
    host.remove();
  });

  test('warns once per unknown feel name in each document', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const host = mount('<jelly-button feel="ghost-feel">A</jelly-button>');
    await settle();

    expect(warn).toHaveBeenCalledTimes(1);

    const elsewhere = document.implementation.createHTMLDocument('second page');
    const framed = document.createElement('jelly-button') as JellyButton;

    // Still this document's element, and its one warning is already spent
    framed.setAttribute('feel', 'ghost-feel');
    expect(warn).toHaveBeenCalledTimes(1);

    elsewhere.adoptNode(framed);
    framed.resolve();
    framed.resolve();

    expect(warn).toHaveBeenCalledTimes(2);

    warn.mockRestore();
    host.remove();
  });

  test('applies the quality cap and reflects the canonical alias', async () => {
    const host = mount('<jelly-button quality="med">Q</jelly-button>');
    await settle();

    const el = host.firstElementChild as JellyButton;

    expect(el.quality).toBe('medium');
    expect(el.getAttribute('quality')).toBe('medium');
    expect(el.resolvedConfig.samples).toBe(DEFAULT_CONFIG.samples);

    el.quality = 'low';
    await settle();

    expect(el.getAttribute('quality')).toBe('low');
    expect(el.resolvedConfig.samples).toBeLessThanOrEqual(120);
    expect(el.body!.config.samples).toBe(el.resolvedConfig.samples);

    host.remove();
  });

  test('leaves an unrecognized quality as written and resolves it as medium', async () => {
    const host = mount('<jelly-button quality="potato">Q</jelly-button>');
    await settle();

    const el = host.firstElementChild as JellyButton;

    expect(el.getAttribute('quality')).toBe('potato');
    expect(el.quality).toBe('medium');

    host.remove();
  });

  test('validates, copies and applies a raw config override', async () => {
    const host = mount('<jelly-button>C</jelly-button>');
    await settle();

    const el = host.firstElementChild as JellyButton;
    const raw = { pressure: 700, samples: 9999 };

    el.config = raw;
    await settle();

    raw.pressure = 1;

    expect(el.resolvedConfig.pressure).toBe(700);
    expect(el.resolvedConfig.samples).toBe(480);
    expect(el.body!.config.pressure).toBe(700);

    host.remove();
  });

  test('replays a property set before upgrade', async () => {
    const el = document.createElement('jelly-button-not-yet') as HTMLElement & { feel?: string };
    el.feel = 'gel';
    document.body.appendChild(el);

    customElements.define('jelly-button-not-yet', class extends JellyButton {});
    await settle();

    expect((el as unknown as JellyButton).feel).toBe('gel');
    expect(el.getAttribute('feel')).toBe('gel');

    el.remove();
  });

  test('lets a markup attribute win over a pre-upgrade property', async () => {
    const el = document.createElement('jelly-button-markup-wins') as HTMLElement & { quality?: string };
    el.setAttribute('quality', 'high');
    el.quality = 'low';
    document.body.appendChild(el);

    customElements.define('jelly-button-markup-wins', class extends JellyButton {});
    await settle();

    expect(el.getAttribute('quality')).toBe('high');
    expect((el as unknown as JellyButton).quality).toBe('high');

    el.remove();
  });

  test('exposes pressed state through :state() and clears it on pointer cancel', async () => {
    const host = mount('<jelly-button>P</jelly-button>');
    await settle();

    const el = host.firstElementChild as JellyButton;

    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true, pointerId: 1, isPrimary: true }));
    await settle();
    expect(el.matches(':state(pressed)')).toBe(true);

    el.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, composed: true, pointerId: 1, isPrimary: true }));
    await settle();
    expect(el.matches(':state(pressed)')).toBe(false);

    host.remove();
  });

  test('clears pressed state on disconnect', async () => {
    const host = mount('<jelly-button>P</jelly-button>');
    await settle();

    const el = host.firstElementChild as JellyButton;

    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true, pointerId: 2, isPrimary: true }));
    await settle();
    expect(el.matches(':state(pressed)')).toBe(true);

    host.remove();
    await settle();
    expect(el.matches(':state(pressed)')).toBe(false);
  });

  // :host(:focus-visible) never matches under delegatesFocus in any of the three
  // browsers, so the focus fallback has to land on the delegated control
  test('shows a canvas-free focus indicator when the inner button is keyboard-focused', async () => {
    const host = mount('<jelly-button data-jelly-nocanvas>F</jelly-button>');
    await settle();

    const el    = host.firstElementChild as JellyButton;
    const inner = el.shadowRoot!.querySelector('button')!;

    await userEvent.tab();

    expect(el.shadowRoot!.activeElement).toBe(inner);
    expect(el.matches(':focus')).toBe(true);
    expect(el.matches(':focus-visible')).toBe(false);
    expect(inner.matches(':focus-visible')).toBe(true);

    const outline = getComputedStyle(inner);

    expect(outline.outlineStyle).toBe('solid');
    expect(outline.outlineWidth).toBe('2px');

    host.remove();
  });

});
