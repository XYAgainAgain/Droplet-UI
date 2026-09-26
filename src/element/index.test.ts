import { expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { DEFAULT_CONFIG } from '../core/index.js';
import type { JellyConfig } from '../core/index.js';
import { registerPreset } from '../presets/index.js';
import { mount, settle } from '../testing/index.js';

import { JellyElement } from './index.js';
import type { PainterFrame } from './index.js';

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

// Paints the whole canvas, so every overhang pixel is deterministic at rest
class FloodJelly extends JellyElement {
  override paintSurface (frame: PainterFrame): void {
    frame.ctx.fillRect(-frame.width / 2, -frame.height / 2, frame.width, frame.height);
  }
}

customElements.define('jelly-flood', FloodJelly);

async function expectNoPageOverflow (dir: 'ltr' | 'rtl', edge: string): Promise<void> {
  const root = document.documentElement;
  const scroller = document.scrollingElement!;

  root.dir = dir;

  const before = { width: scroller.scrollWidth, height: scroller.scrollHeight };
  const host = mount(`<jelly-plain-unconverted style="position:absolute;${edge};bottom:0;width:40px;height:40px"></jelly-plain-unconverted>`);

  try {
    await settle();

    const el = host.firstElementChild as PlainJelly;
    const canvas = el.canvas.getBoundingClientRect();

    // The overhang really does cross the viewport edge by PAD, it just adds no scroll
    const crossing = dir === 'ltr' ? canvas.right - scroller.clientWidth : -canvas.left;

    expect(crossing).toBeCloseTo(JellyElement.PAD, 0);
    expect(scroller.scrollWidth).toBe(scroller.clientWidth);
    expect(scroller.scrollWidth).toBe(before.width);
    expect(scroller.scrollHeight).toBe(before.height);
  } finally {
    host.remove();
    root.removeAttribute('dir');
  }
}

test('a component flush against the right edge adds no page overflow', async () => {
  await expectNoPageOverflow('ltr', 'right:0');
});

test('a component flush against the left edge of an RTL page adds no page overflow', async () => {
  await expectNoPageOverflow('rtl', 'left:0');
});

test('a component at the edge of a scroll container leaves it unscrollable', async () => {
  const host = mount('<div style="width:200px;height:120px;overflow:auto;display:flex;justify-content:flex-end;align-items:flex-end"><jelly-plain-unconverted style="width:40px;height:40px"></jelly-plain-unconverted></div>');
  await settle();

  const panel = host.firstElementChild as HTMLElement;

  expect(panel.scrollWidth).toBe(panel.clientWidth);
  expect(panel.scrollHeight).toBe(panel.clientHeight);

  host.remove();
});

test('the canvas still extends PAD past the host box on every side', async () => {
  const host = mount('<jelly-plain-unconverted style="display:block;width:80px;height:40px;margin:60px"></jelly-plain-unconverted>');
  await settle();

  const el = host.firstElementChild as PlainJelly;
  const box = el.getBoundingClientRect();
  const canvas = el.canvas.getBoundingClientRect();
  const pad = JellyElement.PAD;

  expect(canvas.left).toBeCloseTo(box.left - pad, 0);
  expect(canvas.top).toBeCloseTo(box.top - pad, 0);
  expect(canvas.right).toBeCloseTo(box.right + pad, 0);
  expect(canvas.bottom).toBeCloseTo(box.bottom + pad, 0);
  expect(el.canvas.width).toBe(Math.round((80 + pad * 2) * el.dpr));

  host.remove();
});

test('the overhang paints on screen outside the host box', async () => {
  const host = mount('<div style="display:inline-block;padding:60px;background:#fff"><jelly-flood style="display:block;width:40px;height:40px;--jelly-fill:rgb(255,0,0)"></jelly-flood></div>');
  await settle();

  const frame = host.firstElementChild as HTMLElement;
  const el = frame.firstElementChild as FloodJelly;
  const shot = await page.screenshot({ element: frame, save: false });

  const img = new Image();
  img.src = `data:image/png;base64,${shot}`;
  await img.decode();

  const scratch = document.createElement('canvas');
  scratch.width = img.width;
  scratch.height = img.height;

  const ctx = scratch.getContext('2d')!;
  ctx.drawImage(img, 0, 0);

  const outer = frame.getBoundingClientRect();
  const inner = el.getBoundingClientRect();
  const scale = img.width / outer.width;
  const red = (x: number, y: number): boolean => {
    const [r, g, b] = ctx.getImageData(Math.round((x - outer.left) * scale), Math.round((y - outer.top) * scale), 1, 1).data;

    return r! > 200 && g! < 60 && b! < 60;
  };

  // Inside the host, then halfway into the overhang on each side, then past it
  expect(red(inner.left + 20, inner.top + 20)).toBe(true);
  expect(red(inner.left - 24, inner.top + 20)).toBe(true);
  expect(red(inner.right + 24, inner.top + 20)).toBe(true);
  expect(red(inner.left + 20, inner.top - 24)).toBe(true);
  expect(red(inner.left + 20, inner.bottom + 24)).toBe(true);
  expect(red(outer.left + 4, outer.top + 4)).toBe(false);

  host.remove();
});

test('the overhang wrapper never intercepts pointer hits beside the host', async () => {
  const host = mount('<div style="padding:60px"><jelly-plain-unconverted style="display:block;width:40px;height:40px"></jelly-plain-unconverted></div>');
  await settle();

  const frame = host.firstElementChild as HTMLElement;
  const el = frame.firstElementChild as PlainJelly;
  const box = el.getBoundingClientRect();

  expect(document.elementFromPoint(box.left - 24, box.top + 20)).toBe(frame);
  expect(document.elementFromPoint(box.left + 20, box.top + 20)).toBe(el);

  host.remove();
});
