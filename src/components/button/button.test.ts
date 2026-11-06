import { describe, expect, test, vi } from 'vitest';
import { userEvent } from 'vitest/browser';

import { mount, settle } from '../../testing/index.js';

import { installScopeBridge } from '../../cascade/index.js';
import { DEFAULT_CONFIG, DropletBody } from '../../core/index.js';
import { registerPreset } from '../../presets/index.js';
import { defineAll, RegistrationError } from '../../register.js';
import { defineButton, DropletButton } from './index.js';

defineAll({ strict: false });

// Gecko runs an ARIA element setter's attribute reaction in a microtask
const reactions = (): Promise<void> => Promise.resolve();

test('upgrades and renders a real inner <button>', async () => {
  const host = mount('<droplet-button>Go</droplet-button>');
  const el = host.querySelector('droplet-button') as DropletButton;

  await settle(20);

  expect(el.shadowRoot).toBeTruthy();
  expect(el.shadowRoot!.querySelector('button')).toBeInstanceOf(HTMLButtonElement);

  host.remove();
});

test('disabled reflects onto the inner button and back', async () => {
  const host = mount('<droplet-button disabled>Go</droplet-button>');
  const el = host.querySelector('droplet-button') as DropletButton;

  await settle(3);
  const inner = el.shadowRoot!.querySelector('button')!;
  expect(inner.disabled).toBe(true);

  el.removeAttribute('disabled');
  await settle(2);
  expect(inner.disabled).toBe(false);

  host.remove();
});

test('variant="mint" paints the mint fill on the canvas', async () => {
  const host = mount('<droplet-button variant="mint">Go</droplet-button>');
  const el = host.querySelector('droplet-button') as DropletButton;

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
  const host = mount('<form><droplet-button type="submit">Save</droplet-button></form>');
  const el = host.querySelector('droplet-button') as DropletButton;

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
  const host = mount('<droplet-button>Go</droplet-button>');
  const el = host.querySelector('droplet-button') as DropletButton;
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

describe('droplet-button contracts', () => {

  test('registers through the helper and is a no-op the second time', () => {
    expect(defineButton().alreadyDefined).toEqual(['droplet-button']);
  });

  test('reads feel from the nearest scope and lets the element override it', async () => {
    installScopeBridge(document);
    registerPreset('feel', 'test-stiff', { pressure: 900 }, { override: true });

    const host = mount('<div data-droplet-feel="test-stiff"><droplet-button>A</droplet-button><droplet-button feel="gel">B</droplet-button></div>');

    // Before any frame, so the bridge's observer hasn't seen the scope yet
    const first = host.querySelector('droplet-button') as DropletButton;
    expect(first.feel).toBe('test-stiff');
    expect(first.resolvedConfig.pressure).toBe(900);

    await settle();

    const [a, b] = host.querySelectorAll('droplet-button') as NodeListOf<DropletButton>;

    expect(a!.feel).toBe('test-stiff');
    expect(a!.resolvedConfig.pressure).toBe(900);
    expect(b!.feel).toBe('gel');
    expect(b!.resolvedConfig.pressure).toBe(DEFAULT_CONFIG.pressure);

    host.remove();
  });

  test('a fractional pass count in a preset does not rebuild the membrane on every resolve', async () => {
    registerPreset('feel', 'test-fractional', { normalBlendPasses: 2.5 }, { override: true });

    const host = mount('<droplet-button feel="test-fractional">F</droplet-button>');
    await settle();

    const el = host.firstElementChild as DropletButton;

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

    const resize = vi.spyOn(DropletBody.prototype, 'resize');
    const host   = mount('<droplet-button feel="test-coarse">S</droplet-button>');

    await settle(6);

    const el = host.firstElementChild as DropletButton;

    expect(el.resolvedConfig.samples).toBe(96);
    expect(el.body!.config.samples).toBe(96);
    expect(resize).not.toHaveBeenCalled();

    resize.mockRestore();
    host.remove();
  });

  test('warns once per unknown feel name', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const host = mount('<droplet-button feel="no-such-feel">A</droplet-button><droplet-button feel="no-such-feel">B</droplet-button>');
    await settle();

    const [a] = host.querySelectorAll('droplet-button') as NodeListOf<DropletButton>;

    expect(a!.feel).toBe('gel');
    expect(a!.getAttribute('feel')).toBe('no-such-feel');
    expect(warn).toHaveBeenCalledTimes(1);

    warn.mockRestore();
    host.remove();
  });

  test('warns and falls back to gel for an empty feel attribute', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const host = mount('<droplet-button feel="">E</droplet-button>');
    await settle();

    const el = host.firstElementChild as DropletButton;

    expect(el.feel).toBe('gel');
    expect(el.getAttribute('feel')).toBe('');
    expect(warn).toHaveBeenCalledTimes(1);

    warn.mockRestore();
    host.remove();
  });

  test('warns once per unknown feel name in each document', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const host = mount('<droplet-button feel="ghost-feel">A</droplet-button>');
    await settle();

    expect(warn).toHaveBeenCalledTimes(1);

    const elsewhere = document.implementation.createHTMLDocument('second page');
    const framed = document.createElement('droplet-button') as DropletButton;

    // Still this document's, whose one warning is spent
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
    const host = mount('<droplet-button quality="med">Q</droplet-button>');
    await settle();

    const el = host.firstElementChild as DropletButton;

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
    const host = mount('<droplet-button quality="potato">Q</droplet-button>');
    await settle();

    const el = host.firstElementChild as DropletButton;

    expect(el.getAttribute('quality')).toBe('potato');
    expect(el.quality).toBe('medium');

    host.remove();
  });

  test('validates, copies and applies a raw config override', async () => {
    const host = mount('<droplet-button>C</droplet-button>');
    await settle();

    const el = host.firstElementChild as DropletButton;
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

    customElements.define('jelly-button-not-yet', class extends DropletButton {});
    await settle();

    expect((el as unknown as DropletButton).feel).toBe('gel');
    expect(el.getAttribute('feel')).toBe('gel');

    el.remove();
  });

  test('replays a config assigned before upgrade through the validating setter', async () => {
    const el = document.createElement('jelly-button-config-early') as HTMLElement & { config?: object };
    el.config = { samples: 64 };
    document.body.appendChild(el);

    customElements.define('jelly-button-config-early', class extends DropletButton {});
    await settle();

    const button = el as unknown as DropletButton;
    expect(Object.hasOwn(button, 'config')).toBe(false);
    expect(button.resolvedConfig.samples).toBe(64);

    el.remove();
  });

  test('hands out config as a frozen copy that cannot be edited around the resolver', async () => {
    const host = mount('<droplet-button>C</droplet-button>');
    await settle();

    const el = host.firstElementChild as DropletButton;
    const input = { samples: 72 };
    el.config = input;
    input.samples = 300;

    expect(el.config!.samples).toBe(72);
    expect(Object.isFrozen(el.config)).toBe(true);
    expect(() => { (el.config as { samples: number }).samples = 999; }).toThrow(TypeError);
    expect(el.resolvedConfig.samples).toBe(72);

    host.remove();
  });

  test('reflects palette and material and reads them through the cascade', async () => {
    installScopeBridge(document);
    const host = mount('<div data-droplet-palette="dusk" data-droplet-material="glass"><droplet-button>M</droplet-button></div>');
    await settle();

    const el = host.querySelector('droplet-button') as DropletButton;
    expect(el.palette).toBe('dusk');
    expect(el.material).toBe('glass');

    el.palette = 'rose';
    expect(el.getAttribute('palette')).toBe('rose');
    expect(el.palette).toBe('rose');

    el.material = null;
    host.firstElementChild!.removeAttribute('data-droplet-material');
    await settle(2);
    expect(el.material).toBe('matte');

    host.remove();
  });

  test('an invalid element quality still beats the scope and resolves as medium', async () => {
    installScopeBridge(document);
    const host = mount('<div data-droplet-quality="low"><droplet-button quality="bogus">Q</droplet-button></div>');
    await settle();

    const el = host.querySelector('droplet-button') as DropletButton;
    expect(el.quality).toBe('medium');
    expect(el.getAttribute('quality')).toBe('bogus');

    host.remove();
  });

  test('trims an element feel attribute like a scope value', async () => {
    registerPreset('feel', 'test-trimmed', { pressure: 777 }, { override: true });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const host = mount('<droplet-button feel=" test-trimmed ">T</droplet-button>');
    await settle();

    try {
      const el = host.firstElementChild as DropletButton;
      expect(el.feel).toBe('test-trimmed');
      expect(el.resolvedConfig.pressure).toBe(777);
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
      host.remove();
    }
  });

  test('a scope change that leaves the record unchanged does not wake the body', async () => {
    installScopeBridge(document);
    const host = mount('<div><droplet-button>W</droplet-button></div>');
    await settle(6);

    const el = host.querySelector('droplet-button') as DropletButton;
    const wake = vi.spyOn(el, 'requestFrame');

    try {
      host.firstElementChild!.setAttribute('data-droplet-palette', 'dusk');
      await settle(2);

      expect(el.palette).toBe('dusk');
      expect(wake).not.toHaveBeenCalled();
    } finally {
      wake.mockRestore();
      host.remove();
    }
  });

  test('every explicit helper is strict by default', () => {
    const foreign = class extends HTMLElement {};
    const registry = { get: () => foreign, define: () => {} } as unknown as CustomElementRegistry;

    expect(() => defineButton({ registry })).toThrow(RegistrationError);
    expect(() => DropletButton.define({ registry })).toThrow(RegistrationError);
    expect(() => defineAll({ registry })).toThrow(RegistrationError);

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      expect(defineAll({ registry, strict: false }).collisions.length).toBeGreaterThan(0);
    } finally {
      warn.mockRestore();
    }
  });

  test('lets a markup attribute win over a pre-upgrade property', async () => {
    const el = document.createElement('jelly-button-markup-wins') as HTMLElement & { quality?: string };
    el.setAttribute('quality', 'high');
    el.quality = 'low';
    document.body.appendChild(el);

    customElements.define('jelly-button-markup-wins', class extends DropletButton {});
    await settle();

    expect(el.getAttribute('quality')).toBe('high');
    expect((el as unknown as DropletButton).quality).toBe('high');

    el.remove();
  });

  test('exposes pressed state through :state() and clears it on pointer cancel', async () => {
    const host = mount('<droplet-button>P</droplet-button>');
    await settle();

    const el = host.firstElementChild as DropletButton;

    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true, pointerId: 1, isPrimary: true }));
    await settle();
    expect(el.matches(':state(pressed)')).toBe(true);

    el.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, composed: true, pointerId: 1, isPrimary: true }));
    await settle();
    expect(el.matches(':state(pressed)')).toBe(false);

    host.remove();
  });

  test('clears pressed state on disconnect', async () => {
    const host = mount('<droplet-button>P</droplet-button>');
    await settle();

    const el = host.firstElementChild as DropletButton;

    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true, pointerId: 2, isPrimary: true }));
    await settle();
    expect(el.matches(':state(pressed)')).toBe(true);

    host.remove();
    await settle();
    expect(el.matches(':state(pressed)')).toBe(false);
  });

  // :host(:focus-visible) never matches under delegatesFocus, so the fallback sits on the inner control
  test('shows a canvas-free focus indicator when the inner button is keyboard-focused', async () => {
    const host = mount('<droplet-button data-droplet-nocanvas>F</droplet-button>');
    await settle();

    const el    = host.firstElementChild as DropletButton;
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

describe('droplet-button as a native button', () => {

  const inner = (el: DropletButton): HTMLButtonElement => el.shadowRoot!.querySelector('button')!;

  test('the host matches :disabled from its own attribute', async () => {
    const host = mount('<droplet-button disabled>D</droplet-button>');
    await settle(2);

    const el = host.firstElementChild as DropletButton;

    expect(el.matches(':disabled')).toBe(true);

    el.disabled = false;
    expect(el.matches(':disabled')).toBe(false);
    expect(el.matches(':enabled')).toBe(true);

    host.remove();
  });

  test('a disabled fieldset disables it without touching the host attribute', async () => {
    const host = mount('<form><fieldset><droplet-button type="submit">F</droplet-button></fieldset></form>');
    await settle(2);

    const form     = host.querySelector('form')!;
    const fieldset = host.querySelector('fieldset')!;
    const el       = host.querySelector('droplet-button') as DropletButton;
    const onSubmit = vi.fn((event: Event) => event.preventDefault());

    form.addEventListener('submit', onSubmit);

    fieldset.disabled = true;
    await settle(1);

    expect(el.matches(':disabled')).toBe(true);
    expect(el.hasAttribute('disabled')).toBe(false);
    expect(el.disabled).toBe(false);
    expect(inner(el).disabled).toBe(true);
    expect(inner(el).tabIndex).toBe(-1);

    inner(el).dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    expect(onSubmit).not.toHaveBeenCalled();

    fieldset.disabled = false;
    await settle(1);

    expect(el.matches(':disabled')).toBe(false);
    expect(inner(el).disabled).toBe(false);
    expect(inner(el).tabIndex).toBe(0);

    inner(el).click();
    expect(onSubmit).toHaveBeenCalledTimes(1);

    host.remove();
  });

  test('form="id" picks the owner form over the enclosing one', async () => {
    const host = mount(`
      <form id="jb-owner"></form>
      <form id="jb-enclosing"><droplet-button type="submit" form="jb-owner">O</droplet-button></form>`);
    await settle(2);

    const owner     = host.querySelector('#jb-owner') as HTMLFormElement;
    const enclosing = host.querySelector('#jb-enclosing') as HTMLFormElement;
    const el        = host.querySelector('droplet-button') as DropletButton;
    const submitted: string[] = [];

    for (const form of [owner, enclosing]) {
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        submitted.push(form.id);
      });
    }

    expect(el.form).toBe(owner);

    inner(el).click();
    expect(submitted).toEqual(['jb-owner']);

    host.remove();
  });

  test('submits with a native submitter that carries name=value and the form overrides', async () => {
    const host = mount(`
      <form action="/default">
        <input name="q" value="jelly">
        <droplet-button type="submit" name="intent" value="save" formaction="/save" formmethod="post" formtarget="_self">Save</droplet-button>
      </form>`);
    await settle(2);

    const form = host.querySelector('form')!;
    const el   = host.querySelector('droplet-button') as DropletButton;
    const before = form.elements.length;

    let submitter: HTMLElement | null = null;
    let data: FormData | null = null;

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      submitter = (event as SubmitEvent).submitter;
      data      = new FormData(form, submitter);
    });

    inner(el).click();

    expect(submitter).toBeInstanceOf(HTMLButtonElement);

    const native = submitter! as HTMLButtonElement;

    expect(native.name).toBe('intent');
    expect(native.value).toBe('save');
    expect(native.formAction).toBe(new URL('/save', document.baseURI).href);
    expect(native.formMethod).toBe('post');
    expect(native.formTarget).toBe('_self');

    expect(data!.get('q')).toBe('jelly');
    expect(data!.get('intent')).toBe('save');

    expect(native.isConnected).toBe(false);
    expect(form.elements.length).toBe(before);

    host.remove();
  });

  test('without a name the submission carries no submitter entry', async () => {
    const host = mount('<form><input name="q" value="x"><droplet-button type="submit">S</droplet-button></form>');
    await settle(2);

    const form = host.querySelector('form')!;
    let entries: string[] = [];

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      entries = [...new FormData(form, (event as SubmitEvent).submitter).keys()];
    });

    inner(host.querySelector('droplet-button') as DropletButton).click();
    expect(entries).toEqual(['q']);

    host.remove();
  });

  test('constraint validation blocks submission unless formnovalidate is set', async () => {
    const host = mount('<form><input name="r" required><droplet-button type="submit">V</droplet-button></form>');
    await settle(2);

    const form     = host.querySelector('form')!;
    const el       = host.querySelector('droplet-button') as DropletButton;
    const onSubmit = vi.fn((event: Event) => event.preventDefault());
    const onInvalid = vi.fn();

    form.addEventListener('submit', onSubmit);
    host.querySelector('input')!.addEventListener('invalid', onInvalid);

    inner(el).click();
    expect(onInvalid).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();

    el.formNoValidate = true;
    inner(el).click();
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onInvalid).toHaveBeenCalledTimes(1);

    host.remove();
  });

  test('type="reset" resets the owner form', async () => {
    const host = mount('<form><input name="r" value="start"><droplet-button type="reset">R</droplet-button></form>');
    await settle(2);

    const field = host.querySelector('input')!;

    field.value = 'edited';
    inner(host.querySelector('droplet-button') as DropletButton).click();

    expect(field.value).toBe('start');

    host.remove();
  });

  test('reflects the native IDL attributes with native parsing', async () => {
    const host = mount('<droplet-button>I</droplet-button>');
    await settle(2);

    const el     = host.firstElementChild as DropletButton;
    const native = document.createElement('button');

    expect(el.type).toBe('button');
    expect(el.form).toBeNull();
    expect(el.name).toBe('');
    expect(el.value).toBe('');
    expect(el.formAction).toBe(native.formAction);
    expect(el.formMethod).toBe(native.formMethod);
    expect(el.formEnctype).toBe(native.formEnctype);

    el.disabled = true;
    expect(el.hasAttribute('disabled')).toBe(true);
    expect(inner(el).disabled).toBe(true);

    el.name  = 'n';
    el.value = 'v';
    expect(el.getAttribute('name')).toBe('n');
    expect(el.getAttribute('value')).toBe('v');

    el.type = 'SUBMIT';
    expect(el.type).toBe('submit');
    expect(inner(el).type).toBe('submit');
    el.setAttribute('type', 'bogus');
    expect(el.type).toBe('button');
    expect(inner(el).type).toBe('button');

    const cases: Array<[keyof DropletButton & keyof HTMLButtonElement, string, string]> = [
      ['formAction', 'formaction', 'next/page?x=1'],
      ['formMethod', 'formmethod', 'POST'],
      ['formMethod', 'formmethod', 'bogus'],
      ['formEnctype', 'formenctype', 'multipart/form-data'],
      ['formEnctype', 'formenctype', 'bogus'],
      ['formTarget', 'formtarget', '_blank'],
    ];

    for (const [prop, attr, value] of cases) {
      el.setAttribute(attr, value);
      native.setAttribute(attr, value);
      expect(el[prop]).toBe(native[prop]);
    }

    el.formMethod = 'dialog';
    expect(el.getAttribute('formmethod')).toBe('dialog');

    el.formNoValidate = true;
    expect(el.hasAttribute('formnovalidate')).toBe(true);

    host.remove();
  });

  test('exposes its labels through ElementInternals', async () => {
    const host = mount('<label for="jb-labeled">Caption</label><droplet-button id="jb-labeled">L</droplet-button>');
    await settle(2);

    const el = host.querySelector('droplet-button') as DropletButton;

    expect(el.labels.length).toBe(1);
    expect(el.labels[0]).toBe(host.querySelector('label'));

    host.remove();
  });

  test('replays native properties set before upgrade', async () => {
    const el = document.createElement('jelly-button-native-replay') as HTMLElement & { disabled?: boolean; name?: string };
    el.disabled = true;
    el.name     = 'early';
    document.body.appendChild(el);

    customElements.define('jelly-button-native-replay', class extends DropletButton {});
    await settle(2);

    expect(el.hasAttribute('disabled')).toBe(true);
    expect(el.getAttribute('name')).toBe('early');
    expect((el as unknown as DropletButton).shadowRoot!.querySelector('button')!.disabled).toBe(true);

    el.remove();
  });

  test('forwards aria-busy, aria-label, and aria-describedby onto the inner button', async () => {
    const host = mount('<p id="jb-hint">Saves a draft</p><droplet-button aria-busy="true" aria-label="Save draft" aria-describedby="jb-hint">S</droplet-button>');
    await settle(2);

    const el     = host.querySelector('droplet-button') as DropletButton;
    const button = inner(el);

    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.getAttribute('aria-label')).toBe('Save draft');

    if ('ariaDescribedByElements' in button) {
      expect(button.ariaDescribedByElements).toEqual([host.querySelector('#jb-hint')]);
    }

    el.removeAttribute('aria-busy');
    expect(button.hasAttribute('aria-busy')).toBe(false);

    host.remove();
  });

  test('label wins over aria-label, which returns when label is removed', async () => {
    const host = mount('<droplet-button label="From label" aria-label="From aria">X</droplet-button>');
    await settle(2);

    const el = host.firstElementChild as DropletButton;

    expect(inner(el).getAttribute('aria-label')).toBe('From label');

    el.setAttribute('aria-label', 'Changed aria');
    expect(inner(el).getAttribute('aria-label')).toBe('From label');

    el.removeAttribute('label');
    expect(inner(el).getAttribute('aria-label')).toBe('Changed aria');

    el.removeAttribute('aria-label');
    expect(inner(el).hasAttribute('aria-label')).toBe(false);

    host.remove();
  });

  test('aria-controls becomes an element reference that resolves across the shadow boundary', async () => {
    const host = mount('<droplet-button aria-controls="jb-panel" aria-expanded="false">T</droplet-button><div id="jb-panel">Panel</div>');
    await settle(2);

    const el     = host.querySelector('droplet-button') as DropletButton;
    const button = inner(el);

    expect(button.getAttribute('aria-expanded')).toBe('false');

    if (!('ariaControlsElements' in button)) {
      return;
    }

    expect(button.ariaControlsElements).toEqual([host.querySelector('#jb-panel')]);
    // A raw IDREF can't resolve from inside the shadow root
    expect(button.getAttribute('aria-controls') ?? '').toBe('');

    el.removeAttribute('aria-controls');
    expect(button.ariaControlsElements).toBeNull();

    host.remove();
  });

  test('re-resolves IDREFs when the host is reconnected', async () => {
    const host = mount('<droplet-button aria-controls="jb-late">T</droplet-button>');
    await settle(2);

    const el     = host.querySelector('droplet-button') as DropletButton;
    const button = inner(el);

    if (!('ariaControlsElements' in button)) {
      host.remove();
      return;
    }

    expect(button.ariaControlsElements ?? []).toEqual([]);

    const late = document.createElement('div');
    late.id = 'jb-late';
    host.append(late);

    host.append(el);
    expect(button.ariaControlsElements).toEqual([late]);

    host.remove();
  });

  test('links an IDREF target inserted after connect when the button takes focus', async () => {
    const host = mount('<droplet-button aria-describedby="jb-focus-late">F</droplet-button>');
    await settle(2);

    const el     = host.querySelector('droplet-button') as DropletButton;
    const button = inner(el);

    if (!('ariaDescribedByElements' in button)) {
      host.remove();
      return;
    }

    const late = document.createElement('p');
    late.id = 'jb-focus-late';
    host.append(late);

    button.dispatchEvent(new FocusEvent('focusin', { bubbles: true, composed: true }));
    expect(button.ariaDescribedByElements).toEqual([late]);

    host.remove();
  });

  test('explicitly set host ARIA elements forward onto the inner button, each time they change', async () => {
    const host = mount('<p>Hint</p><p>Other</p><droplet-button>E</droplet-button>');
    await settle(2);

    const el              = host.querySelector('droplet-button') as DropletButton & { ariaDescribedByElements: Element[] | null };
    const button          = inner(el) as HTMLButtonElement & { ariaDescribedByElements?: Element[] | null };
    const [hint, other]   = Array.from(host.querySelectorAll('p'));

    if (!('ariaDescribedByElements' in button)) {
      host.remove();
      return;
    }

    el.ariaDescribedByElements = [hint!];
    await reactions();
    expect(button.ariaDescribedByElements).toEqual([hint]);

    el.ariaDescribedByElements = [other!];
    await reactions();
    expect(button.ariaDescribedByElements).toEqual([other]);

    el.ariaDescribedByElements = null;
    await reactions();
    expect(button.ariaDescribedByElements ?? []).toEqual([]);

    host.remove();
  });

  test('forwards aria-disabled without disabling activation', async () => {
    const host = mount('<droplet-button aria-disabled="true">A</droplet-button>');
    await settle(2);

    const el      = host.firstElementChild as DropletButton;
    const onClick = vi.fn();

    el.addEventListener('click', onClick);

    expect(inner(el).getAttribute('aria-disabled')).toBe('true');
    el.click();
    expect(onClick).toHaveBeenCalledTimes(1);

    el.removeAttribute('aria-disabled');
    expect(inner(el).hasAttribute('aria-disabled')).toBe(false);

    host.remove();
  });

  test('host.click() submits and resets its form with exactly one host click', async () => {
    const host = mount(`
      <form>
        <input name="r" value="start">
        <droplet-button type="submit" name="intent" value="go">S</droplet-button>
        <droplet-button type="reset">R</droplet-button>
      </form>`);
    await settle(2);

    const form = host.querySelector('form')!;
    const [submit, reset] = Array.from(host.querySelectorAll('droplet-button')) as DropletButton[];
    const field  = host.querySelector('input')!;
    const clicks = vi.fn();
    let data: FormData | null = null;

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      data = new FormData(form, (event as SubmitEvent).submitter);
    });
    submit!.addEventListener('click', clicks);

    submit!.click();
    expect(clicks).toHaveBeenCalledTimes(1);
    expect(data!.get('intent')).toBe('go');

    const resets = vi.fn();
    reset!.addEventListener('click', resets);

    field.value = 'edited';
    reset!.click();
    expect(resets).toHaveBeenCalledTimes(1);
    expect(field.value).toBe('start');

    host.remove();
  });

  test('host.click() does nothing while disabled by attribute or fieldset', async () => {
    const host = mount('<form><fieldset><droplet-button type="submit">S</droplet-button></fieldset></form>');
    await settle(2);

    const form     = host.querySelector('form')!;
    const fieldset = host.querySelector('fieldset')!;
    const el       = host.querySelector('droplet-button') as DropletButton;
    const clicks   = vi.fn();
    const onSubmit = vi.fn((event: Event) => event.preventDefault());

    el.addEventListener('click', clicks);
    form.addEventListener('submit', onSubmit);

    el.disabled = true;
    el.click();

    el.disabled = false;
    fieldset.disabled = true;
    el.click();

    expect(clicks).not.toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();

    fieldset.disabled = false;
    el.click();
    expect(clicks).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledTimes(1);

    host.remove();
  });

  test('a click canceled by a host or document listener neither submits nor resets', async () => {
    const host = mount(`
      <form>
        <input name="r" value="start">
        <droplet-button type="submit">S</droplet-button>
        <droplet-button type="reset">R</droplet-button>
      </form>`);
    await settle(2);

    const form     = host.querySelector('form')!;
    const field    = host.querySelector('input')!;
    const onSubmit = vi.fn((event: Event) => event.preventDefault());
    const cancel   = (event: Event): void => event.preventDefault();

    form.addEventListener('submit', onSubmit);

    for (const el of Array.from(host.querySelectorAll('droplet-button')) as DropletButton[]) {
      el.addEventListener('click', cancel, { once: true });
      field.value = 'edited';
      el.click();

      document.addEventListener('click', cancel, { once: true });
      inner(el).click();
    }

    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(field.value).toBe('edited');

    host.remove();
  });

  test('a host listener that disables the button or renames it is honored', async () => {
    const host = mount('<form><droplet-button type="submit" name="intent" value="save">S</droplet-button></form>');
    await settle(2);

    const form     = host.querySelector('form')!;
    const el       = host.querySelector('droplet-button') as DropletButton;
    const received: Array<string | null> = [];

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      received.push(new FormData(form, (event as SubmitEvent).submitter).get('renamed') as string | null);
    });

    el.addEventListener('click', () => { el.disabled = true; }, { once: true });
    el.click();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(received).toEqual([]);

    el.disabled = false;
    el.addEventListener('click', () => { el.name = 'renamed'; }, { once: true });
    el.click();
    expect(received).toEqual(['save']);

    host.remove();
  });

  test('stopPropagation() in a host listener still submits, once dispatch is over', async () => {
    const host = mount('<form><droplet-button type="submit">S</droplet-button></form>');
    await settle(2);

    const form     = host.querySelector('form')!;
    const el       = host.querySelector('droplet-button') as DropletButton;
    const clicks   = vi.fn((event: Event) => event.stopPropagation());
    const onSubmit = vi.fn((event: Event) => event.preventDefault());

    form.addEventListener('submit', onSubmit);
    el.addEventListener('click', clicks);

    el.click();
    expect(clicks).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(clicks).toHaveBeenCalledTimes(1);

    host.remove();
  });

  test('a click on a <label for> submits through the host with one host click', async () => {
    const host = mount('<form><label for="jb-label-submit">Send</label><droplet-button id="jb-label-submit" type="submit">S</droplet-button></form>');
    await settle(2);

    const form     = host.querySelector('form')!;
    const el       = host.querySelector('droplet-button') as DropletButton;
    const clicks   = vi.fn();
    const onSubmit = vi.fn((event: Event) => event.preventDefault());

    form.addEventListener('submit', onSubmit);
    el.addEventListener('click', clicks);

    await userEvent.click(host.querySelector('label')!);
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(clicks).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledTimes(1);

    host.remove();
  });

  test('host.click() before build still dispatches one click', () => {
    const el     = document.createElement('droplet-button') as DropletButton;
    const clicks = vi.fn();

    el.addEventListener('click', clicks);
    el.click();

    expect(clicks).toHaveBeenCalledTimes(1);
  });

  test('reassigning a reflected property to its current value writes no attribute', async () => {
    const host = mount('<droplet-button>I</droplet-button>');
    await settle(2);

    const el       = host.firstElementChild as DropletButton;
    const observer = new MutationObserver(() => {});
    const writes: Array<[string, unknown]> = [
      ['name', 'n'], ['value', 'v'], ['type', 'SUBMIT'], ['formAction', 'next'], ['formMethod', 'post'],
      ['formEnctype', 'text/plain'], ['formTarget', '_blank'], ['formNoValidate', true], ['disabled', true],
    ];

    observer.observe(el, { attributes: true });

    for (const [prop, value] of writes) {
      (el as unknown as Record<string, unknown>)[prop] = value;
      observer.takeRecords();

      (el as unknown as Record<string, unknown>)[prop] = value;
      expect(observer.takeRecords(), prop).toEqual([]);
    }

    observer.disconnect();
    host.remove();
  });

});
