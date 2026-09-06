import { expect, test, vi } from 'vitest';

import { DEFAULT_CONFIG } from '../core/index.js';
import type { JellyConfig } from '../core/index.js';
import { registerPreset } from '../presets/index.js';
import { mount, settle } from '../testing/index.js';

import { JellyElement } from './index.js';

// A stand-in for the 36 components that have not been converted: no opt-in, no
// attachInternals(), nothing but the pre-fork base class.
class PlainJelly extends JellyElement {}

customElements.define('jelly-plain-unconverted', PlainJelly);

test('the resolver half is opt-in and off by default', () => {
  expect(JellyElement.usesResolver).toBe(false);
  expect(PlainJelly.usesResolver).toBe(false);
});

test('an unconverted subclass connects without the scope bridge or a resolve', async () => {
  registerPreset('feel', 'test-unconverted', { pressure: 901 }, { override: true });

  const host = mount('<div data-droplet-feel="test-unconverted" data-droplet-quality="low"><jelly-plain-unconverted style="display:block;width:80px;height:40px"></jelly-plain-unconverted></div>');
  await settle();

  const el = host.firstElementChild!.firstElementChild as PlainJelly;
  const scope = host.firstElementChild as HTMLElement;

  // The bridge would have mirrored the scope attributes onto inline custom
  // properties; an unconverted connect must not install it
  expect(scope.style.getPropertyValue('--droplet-feel')).toBe('');
  expect(scope.style.getPropertyValue('--droplet-quality')).toBe('');

  expect(el.resolvedRecord).toBeUndefined();
  expect(el.scopeUnsubscribe).toBeNull();
  expect(el.body!.config.pressure).toBe(DEFAULT_CONFIG.pressure);
  expect(el.body!.config.samples).toBe(DEFAULT_CONFIG.samples);

  host.remove();
});

test('an unconverted connect never attaches ElementInternals', async () => {
  const spy = vi.spyOn(HTMLElement.prototype, 'attachInternals');

  // Defined after the spy so the upgrade itself is observed, not just the connect
  class LateJelly extends JellyElement {}
  customElements.define('jelly-plain-late', LateJelly);

  const host = mount('<jelly-plain-late style="display:block;width:80px;height:40px"></jelly-plain-late>');
  await settle();

  expect(host.firstElementChild).toBeInstanceOf(LateJelly);
  expect(spy).not.toHaveBeenCalled();

  spy.mockRestore();
  host.remove();
});

test('reading feel on an unconverted subclass resolves without touching the body', async () => {
  const host = mount('<jelly-plain-unconverted style="width:120px;height:40px"></jelly-plain-unconverted>');
  await settle();

  const el = host.firstElementChild as JellyElement;
  const resize = vi.spyOn(el.body!, 'resize');

  expect(el.feel).toBe('gel');
  expect(el.quality).toBe('medium');
  expect(resize).not.toHaveBeenCalled();

  resize.mockRestore();
  host.remove();
});

test('config on an unconverted subclass stores the raw value without validating', async () => {
  const host = mount('<jelly-plain-unconverted style="display:block;width:80px;height:40px"></jelly-plain-unconverted>');
  await settle();

  const el = host.firstElementChild as PlainJelly;
  const raw = { pressure: 123 };

  el.config = raw;

  expect(el.config).toBe(raw);
  expect(el.resolvedRecord).toBeUndefined();

  host.remove();
});

test('a raw config assigned before connection seeds the first unconverted body', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const el   = document.createElement('jelly-plain-unconverted') as PlainJelly;

  el.setAttribute('style', 'display:block;width:80px;height:40px');

  // Includes a key the resolver would strip, proving no validation ran
  const raw = { pressure: 321, notAConfigKey: 7 } as unknown as Partial<JellyConfig>;

  el.config = raw;

  const host = mount('');

  host.appendChild(el);
  await settle();

  expect(el.config).toBe(raw);
  expect(el.resolvedRecord).toBeUndefined();
  expect(el.body!.config.pressure).toBe(321);
  expect((el.body!.config as unknown as Record<string, unknown>).notAConfigKey).toBe(7);
  expect(warn).not.toHaveBeenCalled();

  warn.mockRestore();
  host.remove();
});
