import { afterEach, describe, expect, test, vi } from 'vitest';

import { mount, settle } from '../testing/index.js';
import '../testing/define-all.js';

import { canvasPointToViewport, setLights } from '../light/index.js';
import type { DropletLight } from '../light/index.js';
import { registerPreset, PresetError } from '../presets/index.js';
import type { DropletElement } from '../element/index.js';

import { contrast, luminance, materialRecord } from './index.js';

afterEach(() => {
  setLights(null, { flashSafety: false });
  vi.restoreAllMocks();
});

type Pixel = [number, number, number, number];

// Canvas pixels at CSS px offsets from the host's border box
function sampler (el: DropletElement): (x: number, y: number) => Pixel {
  const canvas = el.canvas;
  const ctx    = canvas.getContext('2d')!;
  const host   = el.getBoundingClientRect();
  const rect   = canvas.getBoundingClientRect();
  const scale  = canvas.width / rect.width;
  const data   = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

  return (x, y) => {
    const px = Math.round((host.left + x - rect.left) * scale);
    const py = Math.round((host.top + y - rect.top) * scale);
    const i  = (py * canvas.width + px) * 4;

    return [data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0, data[i + 3] ?? 0];
  };
}

const brightness = ([r, g, b]: Pixel): number => 0.2126 * r + 0.7152 * g + 0.0722 * b;

async function button (attrs = '', style = ''): Promise<{ host: HTMLDivElement; el: DropletElement }> {
  const host = mount(`<droplet-button ${attrs} style="width: 240px; ${style}">Lit label</droplet-button>`);
  const el   = host.firstElementChild as DropletElement;

  await settle(40);

  return { host, el };
}

async function repaint (el: DropletElement, lights: DropletLight[] | null, scope?: Element): Promise<void> {
  setLights(lights, scope ? { scope, flashSafety: false } : { flashSafety: false });
  el.requestFrame();
  await settle(4);
}

describe('materials', () => {

  test('ship matte and gloss through the preset registry and validate custom ones', () => {
    expect(materialRecord('matte')).toMatchObject({ specular: 0, defaultLight: false });
    expect(materialRecord('gloss')).toMatchObject({ defaultLight: true });
    expect(materialRecord('nope')).toBe(null);

    registerPreset('material', 'satin', { specular: 0.2, rim: 0.1 }, { override: true });
    expect(materialRecord('satin')).toMatchObject({ specular: 0.2, rim: 0.1, diffuse: 1 });

    expect(() => registerPreset('material', 'bad', { specular: 2 })).toThrow(PresetError);
    expect(() => registerPreset('material', 'worse', { shine: 1 })).toThrow(PresetError);
  });

  test('warns once for an unknown material and paints it as matte', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const host = mount('<droplet-button material="velvet">A</droplet-button><droplet-button material="velvet">B</droplet-button>');

    await settle(4);

    expect(warn.mock.calls.filter((call) => String(call[0]).includes('velvet'))).toHaveLength(1);
    expect((host.firstElementChild as DropletElement).materialRecordCache.specular).toBe(0);

    host.remove();
  });

});

describe('lit matte', () => {

  test('never touches the canvas when nothing lights it', async () => {
    const { host, el } = await button();
    const lit = vi.spyOn(el, 'paintLit');

    el.requestFrame();
    await settle(4);

    expect(el.litLights()).toBe(null);
    expect(lit).not.toHaveBeenCalled();

    host.remove();
  });

  // A light label on a dark fill, so dimming only raises its contrast
  test('paints exactly as unlit under ambient 1, and dims under a low ambient', async () => {
    const { host, el } = await button('', '--droplet-fill: #3a5f8f; --droplet-label: #ffffff');
    const before = sampler(el)(60, 31);

    await repaint(el, [{ kind: 'ambient', intensity: 1 }]);
    expect(sampler(el)(60, 31)).toEqual(before);

    await repaint(el, [{ kind: 'ambient', intensity: 0.5 }]);
    expect(brightness(sampler(el)(60, 31))).toBeLessThan(brightness(before) * 0.8);

    host.remove();
  });

  test('brightens the side facing a directional light', async () => {
    const { host, el } = await button();

    await repaint(el, [{ kind: 'ambient', intensity: 0.8 }, { kind: 'directional', angle: 270, elevation: 20, intensity: 1, softness: 0 }]);

    const at = sampler(el);

    expect(brightness(at(16, 31))).toBeGreaterThan(brightness(at(224, 31)) + 10);

    host.remove();
  });

  test('holds back dimming that would sink a dark label into its fill', async () => {
    const { host, el } = await button('', '--droplet-fill: #e8e8e8; --droplet-label: #333333');
    const before = sampler(el)(60, 31);

    await repaint(el, [{ kind: 'ambient', intensity: 0.4 }]);

    const after = sampler(el)(60, 31);
    const text  = [0x33 / 255, 0x33 / 255, 0x33 / 255] as const;

    expect(brightness(after)).toBeLessThan(brightness(before));
    expect(contrast([after[0] / 255, after[1] / 255, after[2] / 255], text)).toBeGreaterThanOrEqual(4.45);

    host.remove();
  });

  test('keeps the label above WCAG AA wherever light lands on the fill', async () => {
    const { host, el } = await button('', '--droplet-fill: #3a5f8f; --droplet-label: #ffffff');
    const text = [1, 1, 1] as const;

    await repaint(el, [{ kind: 'ambient', intensity: 1.6 }, { kind: 'directional', angle: 300, elevation: 30, intensity: 1.5, softness: 0 }]);

    const at  = sampler(el);
    let worst = Infinity;

    for (let x = 14; x <= 226; x += 4) {
      for (let y = 12; y <= 50; y += 4) {
        const [r, g, b, a] = at(x, y);

        if (a < 250) continue;
        worst = Math.min(worst, contrast([r / 255, g / 255, b / 255], text));
      }
    }

    expect(contrast([0x3a / 255, 0x5f / 255, 0x8f / 255], text)).toBeGreaterThan(4.5);
    expect(worst).toBeGreaterThanOrEqual(4.45);

    host.remove();
  });

});

describe('repainting', () => {

  test('a light change too small to show leaves a parked control asleep', async () => {
    const { host, el } = await button();

    setLights([{ kind: 'ambient', intensity: 0.8 }], { flashSafety: false });
    await settle(10);

    const frame = vi.spyOn(el, 'frame');

    setLights([{ kind: 'ambient', intensity: 0.802 }], { flashSafety: false });
    await settle(3);
    expect(frame).not.toHaveBeenCalled();

    setLights([{ kind: 'ambient', intensity: 0.9 }], { flashSafety: false });
    await settle(3);
    expect(frame).toHaveBeenCalled();

    host.remove();
  });

  test('a point light repaints a control that scrolls under it', async () => {
    const host = mount('<div class="box" style="height: 120px; overflow: auto"><div style="height: 40px"></div><droplet-button>Scroll</droplet-button><div style="height: 400px"></div></div>');
    const box  = host.querySelector('.box') as HTMLElement;
    const el   = host.querySelector('droplet-button') as DropletElement;

    await settle(20);
    setLights([{ kind: 'point', x: 0, y: 0, intensity: 1 }, { kind: 'ambient', intensity: 0.7 }], { flashSafety: false });
    await settle(10);

    const frame = vi.spyOn(el, 'frame');

    box.scrollTop = 30;
    await settle(6);

    expect(frame).toHaveBeenCalled();

    host.remove();
  });

});

describe('gloss', () => {

  test('lights itself with the default key light, sheen toward the top-left', async () => {
    const { host, el } = await button('material="gloss"', '--droplet-fill: #3a5f8f; --droplet-label: #ffffff');
    const at = sampler(el);

    // Compares the sheen, up and inline-start of center, with its mirror point
    expect(el.litLights()).not.toBe(null);
    expect(brightness(at(100, 20))).toBeGreaterThan(brightness(at(140, 42)) + 15);

    host.remove();
  });

  test('turns its default light off for data-droplet-light="none"', async () => {
    const host = mount('<div data-droplet-light="none"><droplet-button material="gloss">Dark</droplet-button></div>');

    await settle(10);

    expect((host.querySelector('droplet-button') as DropletElement).litLights()).toBe(null);

    host.remove();
  });

  test('follows a material set on a scope', async () => {
    const host = mount('<div data-droplet-material="gloss"><droplet-button>Scoped</droplet-button></div>');

    await settle(10);

    expect((host.querySelector('droplet-button') as DropletElement).materialRecordCache.defaultLight).toBe(true);

    host.remove();
  });

});

describe('light regions', () => {

  test('split a control at the line, each side lit by its own light', async () => {
    const { host, el } = await button('', '--droplet-fill: #808080');
    const rect = el.getBoundingClientRect();
    const line = rect.top + rect.height / 2;

    await repaint(el, [
      { kind: 'ambient', color: '#ff8040', intensity: 1, region: { bottom: line } },
      { kind: 'ambient', color: '#2080ff', intensity: 1, region: { top: line } },
    ]);

    const at    = sampler(el);
    const above = at(120, rect.height / 2 - 12);
    const below = at(120, rect.height / 2 + 12);

    expect(above[0]).toBeGreaterThan(above[2]);
    expect(below[2]).toBeGreaterThan(below[0]);

    host.remove();
  });

});

describe('scene-fed light', () => {

  test('a WebGL2 point light shades the near side of a gloss control', async () => {
    const host   = mount('<canvas width="1200" height="400" style="position: fixed; left: 0; top: 0; width: 600px; height: 200px"></canvas><droplet-button material="gloss" style="position: fixed; left: 280px; top: 60px; width: 200px">Sunward</droplet-button>');
    const canvas = host.querySelector('canvas')!;
    const gl     = canvas.getContext('webgl2', { preserveDrawingBuffer: true })!;

    expect(gl).not.toBe(null);

    gl.clearColor(0.05, 0.1, 0.2, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(80, 300, 60, 60);
    gl.clearColor(1, 0.85, 0.5, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    const pixel = new Uint8Array(4);

    gl.readPixels(110, 330, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    expect(pixel[0]).toBeGreaterThan(200);

    // Buffer y runs up in WebGL, down in the canvas's pixel space
    const sun = canvasPointToViewport(canvas, 110, 400 - 330);
    const el  = host.querySelector('droplet-button') as DropletElement;

    await settle(30);
    await repaint(el, [{ kind: 'ambient', intensity: 0.7 }, { kind: 'point', x: sun.x, y: sun.y, height: 120, color: [1, 0.85, 0.5], intensity: 1.2, softness: 0.2 }]);

    const at = sampler(el);

    expect(sun.x).toBeLessThan(el.getBoundingClientRect().left);
    expect(brightness(at(20, 20))).toBeGreaterThan(brightness(at(180, 20)) + 10);

    host.remove();
  });

  test('a WebGPU scene can feed it too, where the browser has WebGPU', async (context) => {
    const gpu = (navigator as Navigator & { gpu?: { requestAdapter (): Promise<unknown> } }).gpu;
    const adapter = gpu ? await gpu.requestAdapter().catch(() => null) : null;

    if (!adapter) {
      context.skip('WebGPU is not available in this browser');
      return;
    }

    const host   = mount('<canvas width="400" height="200" style="position: fixed; left: 0; top: 0; width: 400px; height: 200px"></canvas><droplet-button material="gloss" style="position: fixed; left: 100px; top: 120px">Lit</droplet-button>');
    const canvas = host.querySelector('canvas')!;

    expect(canvas.getContext('webgpu')).not.toBe(null);

    const sun = canvasPointToViewport(canvas, 30, 30);
    const el  = host.querySelector('droplet-button') as DropletElement;

    await settle(20);
    await repaint(el, [{ kind: 'point', x: sun.x, y: sun.y, intensity: 1 }, { kind: 'ambient', intensity: 0.8 }]);

    expect(el.litLights()?.some((light) => light.kind === 'point')).toBe(true);

    host.remove();
  });

});

test('luminance and contrast follow WCAG 2', () => {
  expect(luminance([1, 1, 1])).toBeCloseTo(1, 5);
  expect(contrast([0, 0, 0], [1, 1, 1])).toBeCloseTo(21, 5);
});

describe('light region edges', () => {

  test('a lone region past the center leaves the part outside it unlit', async () => {
    const { host, el } = await button('', '--droplet-fill: #808080; --droplet-label: #ffffff');
    const rect   = el.getBoundingClientRect();
    const before = sampler(el)(120, rect.height / 2 - 14);

    await repaint(el, [{ kind: 'ambient', intensity: 0.3, region: { top: rect.top + rect.height / 2 - 6 } }]);

    const at = sampler(el);

    expect(at(120, rect.height / 2 - 14)).toEqual(before);
    expect(brightness(at(120, rect.height / 2 + 12))).toBeLessThan(brightness(before) * 0.6);

    host.remove();
  });

  test('a hidden canvas is never measured as an empty rect', async () => {
    const { host, el } = await button('', 'display: none');

    el.measureLight();

    expect(el.lightRects.has(el.canvas)).toBe(false);

    host.remove();
  });

});

describe('light API polish', () => {

  test('a material registered after controls named it repaints them with it', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const host = mount('<droplet-button material="later-sheen">Later</droplet-button>');
    const el   = host.firstElementChild as DropletElement;

    await settle(6);
    expect(el.materialRecordCache.specular).toBe(0);

    const frame = vi.spyOn(el, 'frame');

    registerPreset('material', 'later-sheen', { specular: 0.9, defaultLight: true }, { override: true });
    await settle(3);

    expect(el.materialRecordCache.specular).toBe(0.9);
    expect(frame).toHaveBeenCalled();

    host.remove();
  });

  test('a point light with an elevation keeps that angle at any distance', async () => {
    const { incidences } = await import('./index.js');
    const { normalizeLight } = await import('../light/index.js');

    const near = incidences([normalizeLight({ kind: 'point', x: 10, y: 0, elevation: 30 })], 0, 0).lights[0]!;
    const far  = incidences([normalizeLight({ kind: 'point', x: 5000, y: 0, elevation: 30 })], 0, 0).lights[0]!;
    const free = incidences([normalizeLight({ kind: 'point', x: 5000, y: 0 })], 0, 0).lights[0]!;

    expect(near.facing).toBeCloseTo(0.5, 6);
    expect(far.facing).toBeCloseTo(0.5, 6);
    expect(free.facing).toBeLessThan(0.1);
  });

});

describe('seams between light, color, and direction', () => {

  test('reads the label token a control paints its text with, picked colors included', async () => {
    const host = mount('<droplet-button color="#102040" style="width: 200px">Picked</droplet-button>');
    const el   = host.firstElementChild as DropletElement;

    await settle(6);

    expect(el.materialText()).toEqual([1, 1, 1]);

    host.remove();
  });

  test('moves the default key light when the reading direction flips', async () => {
    const host = mount('<div dir="ltr"><droplet-button material="gloss">Dir</droplet-button></div>');
    const el   = host.querySelector('droplet-button') as DropletElement;

    await settle(6);

    const key = (): number | undefined => el.litLights()?.find((light) => light.kind === 'directional')?.angle;

    expect(key()).toBe(330);

    host.firstElementChild!.setAttribute('dir', 'rtl');
    el.onThemeChange();

    expect(key()).toBe(30);

    host.remove();
  });

  test('wakes a parked control when only a region feather changes', async () => {
    const { host, el } = await button();
    const rect = el.getBoundingClientRect();
    const line = rect.top + rect.height / 2;

    setLights([{ kind: 'ambient', intensity: 0.6, region: { top: line, feather: 0 } }], { flashSafety: false });
    await settle(10);

    const frame = vi.spyOn(el, 'frame');

    setLights([{ kind: 'ambient', intensity: 0.6, region: { top: line, feather: 30 } }], { flashSafety: false });
    await settle(4);

    expect(frame).toHaveBeenCalled();

    host.remove();
  });

  test('keeps a picked label readable when the color leans on a token that changes', async () => {
    const host = mount('<droplet-button color="var(--brand)" style="--brand: #000; width: 200px">Token</droplet-button>');
    const el   = host.firstElementChild as HTMLElement;

    await settle(6);
    expect(el.style.getPropertyValue('--droplet-pick-on')).toBe('#ffffff');

    el.style.setProperty('--brand', '#fff');
    await settle(4);
    expect(el.style.getPropertyValue('--droplet-pick-on')).toBe('oklch(0.2 0 0)');

    host.remove();
  });

});

test('a scope with point lights taken off the page and put back still follows scrolls', async () => {
  const host  = mount('<div class="box" style="height: 120px; overflow: auto"><div style="height: 40px"></div><div class="scope"><droplet-button>Back</droplet-button></div><div style="height: 400px"></div></div>');
  const box   = host.querySelector('.box') as HTMLElement;
  const scope = host.querySelector('.scope') as HTMLElement;
  const el    = host.querySelector('droplet-button') as DropletElement;

  await settle(20);
  setLights([{ kind: 'point', x: 0, y: 0, intensity: 1 }, { kind: 'ambient', intensity: 0.7 }], { scope, flashSafety: false });
  await settle(6);

  scope.remove();
  await settle(4);
  box.insertBefore(scope, box.lastElementChild);
  await settle(10);

  const frame = vi.spyOn(el, 'frame');

  box.scrollTop = 30;
  await settle(6);

  expect(frame).toHaveBeenCalled();

  setLights(null, { scope });
  host.remove();
});

test('an outer point-light scope uncovered after a reconnect still follows scrolls', async () => {
  const host  = mount('<div class="box" style="height: 120px; overflow: auto"><div style="height: 40px"></div><div class="outer"><div class="inner"><droplet-button>Nested</droplet-button></div></div><div style="height: 400px"></div></div>');
  const box   = host.querySelector('.box') as HTMLElement;
  const outer = host.querySelector('.outer') as HTMLElement;
  const inner = host.querySelector('.inner') as HTMLElement;
  const el    = host.querySelector('droplet-button') as DropletElement;

  await settle(20);
  setLights([{ kind: 'point', x: 0, y: 0, intensity: 1 }, { kind: 'ambient', intensity: 0.7 }], { scope: outer, flashSafety: false });
  setLights([{ kind: 'directional', angle: 90, intensity: 0.5 }], { scope: inner, flashSafety: false });
  await settle(6);

  outer.remove();
  await settle(4);
  box.insertBefore(outer, box.lastElementChild);
  await settle(6);

  setLights(null, { scope: inner });
  await settle(6);

  const frame = vi.spyOn(el, 'frame');

  box.scrollTop = 30;
  await settle(6);

  expect(frame).toHaveBeenCalled();

  setLights(null, { scope: outer });
  host.remove();
});

describe('whole-run review', () => {

  test('where two regions overlap, both lights reach the overlap', async () => {
    const { host, el } = await button('', '--droplet-fill: #808080; --droplet-label: #ffffff');
    const rect = el.getBoundingClientRect();
    const cx   = rect.left + rect.width / 2;
    const cy   = rect.top + rect.height / 2;

    await repaint(el, [
      { kind: 'ambient', color: '#ff0000', intensity: 1, region: { left: cx, feather: 1 } },
      { kind: 'ambient', color: '#0000ff', intensity: 1, region: { top: cy, feather: 1 } },
    ]);

    const at         = sampler(el);
    const upperRight = at(190, rect.height / 2 - 12);
    const lowerRight = at(190, rect.height / 2 + 12);
    const lowerLeft  = at(50, rect.height / 2 + 12);

    expect(lowerRight[2]).toBeGreaterThan(upperRight[2] + 30);
    expect(lowerRight[0]).toBeGreaterThan(lowerLeft[0] + 30);

    host.remove();
  });

  test('every region crossing a control gets its light, however many overlap elsewhere', async () => {
    const { host, el } = await button('', '--droplet-fill: #808080; --droplet-label: #ffffff');
    const rect = el.getBoundingClientRect();
    const cx   = rect.left + rect.width / 2;

    await repaint(el, [
      ...[0, 2, 4, 6, 8].map((k) => ({ kind: 'ambient' as const, intensity: 1, region: { left: cx + k, feather: 1 } })),
      { kind: 'ambient', color: '#ff0000', intensity: 1, region: { right: cx - 40, feather: 1 } },
    ]);

    const left = sampler(el)(30, rect.height / 2);

    expect(left[0]).toBeGreaterThan(left[1] + 30);

    host.remove();
  });

  test('shading keeps a translucent surface as translucent as it was', async () => {
    const host = mount('<droplet-skeleton style="width: 200px; height: 40px"></droplet-skeleton>');
    const el   = host.firstElementChild as DropletElement;

    await settle(30);

    const before = sampler(el)(100, 20);

    await repaint(el, [{ kind: 'ambient', intensity: 0.3 }], host);

    const after = sampler(el)(100, 20);

    expect(before[3]).toBeGreaterThan(150);
    expect(Math.abs(after[3] - before[3])).toBeLessThanOrEqual(3);
    expect(brightness(after)).toBeLessThan(brightness(before) * 0.8);

    setLights(null, { scope: host });
    host.remove();
  });

  test('a nearly transparent fill stays as faint while lit', async () => {
    const { host, el } = await button('color="rgba(255, 0, 0, 0.01)"');
    const y      = el.getBoundingClientRect().height / 2;
    const before = sampler(el)(24, y);

    await repaint(el, [{ kind: 'ambient', intensity: 1 }], host);

    const after = sampler(el)(24, y);

    expect(before[3]).toBeGreaterThan(0);
    expect(Math.abs(after[3] - before[3])).toBeLessThanOrEqual(1);

    setLights(null, { scope: host });
    host.remove();
  });

  test('a translucent track keeps its accent mixture while lit', async () => {
    const host = mount('<droplet-slider value="50" style="width: 200px; --droplet-track: rgba(255, 0, 0, 0.4); --droplet-accent: rgba(0, 0, 255, 0.4)"></droplet-slider>');
    const el   = host.firstElementChild as DropletElement;

    await settle(40);

    const y      = el.getBoundingClientRect().height / 2;
    const before = [sampler(el)(40, y), sampler(el)(170, y)];

    await repaint(el, [{ kind: 'ambient', intensity: 1 }], host);

    const after = [sampler(el)(40, y), sampler(el)(170, y)];

    for (const [i, pixel] of after.entries()) {
      for (let c = 0; c < 4; c++) {
        expect(Math.abs((pixel[c] ?? 0) - (before[i]![c] ?? 0))).toBeLessThanOrEqual(4);
      }
    }

    setLights(null, { scope: host });
    host.remove();
  });

  test('a translucent thumb still shows its track through it while lit', async () => {
    const host = mount('<droplet-slider color="rgba(255, 0, 0, 0.4)" value="50" style="width: 200px"></droplet-slider>');
    const el   = host.firstElementChild as DropletElement;

    await settle(40);

    const y      = el.getBoundingClientRect().height / 2;
    const before = sampler(el)(100, y);

    await repaint(el, [{ kind: 'ambient', intensity: 1 }], host);

    const after = sampler(el)(100, y);

    for (let i = 0; i < 4; i++) {
      expect(Math.abs((after[i] ?? 0) - (before[i] ?? 0))).toBeLessThanOrEqual(3);
    }

    setLights(null, { scope: host });
    host.remove();
  });

});
