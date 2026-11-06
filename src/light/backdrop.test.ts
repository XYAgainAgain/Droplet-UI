import { afterEach, describe, expect, test, vi } from 'vitest';

import { mount, settle } from '../testing/index.js';
import '../testing/define-all.js';

import type { DropletElement } from '../element/index.js';

import { sampleBackdrop, watchBackdrop } from './backdrop.js';
import { getLights, setLights } from './index.js';
import type { DropletLight } from './index.js';

afterEach(() => {
  setLights(null, { flashSafety: false });
  vi.restoreAllMocks();
  delete (document as { visibilityState?: unknown }).visibilityState;
});

type Triple = readonly [number, number, number];

const colorOf = (light: DropletLight): Triple => light.color as Triple;

function halves (width: number, height: number, style: string): { host: HTMLDivElement; canvas: HTMLCanvasElement } {
  const host   = mount(`<canvas width="${width}" height="${height}" style="position: fixed; ${style}"></canvas>`);
  const canvas = host.querySelector('canvas')!;
  const ctx    = canvas.getContext('2d')!;

  ctx.fillStyle = '#ff8040';
  ctx.fillRect(0, 0, width / 2, height);
  ctx.fillStyle = '#2060ff';
  ctx.fillRect(width / 2, 0, width / 2, height);

  return { host, canvas };
}

function sampler (el: DropletElement): (x: number, y: number) => [number, number, number, number] {
  const canvas = el.canvas;
  const host   = el.getBoundingClientRect();
  const rect   = canvas.getBoundingClientRect();
  const scale  = canvas.width / rect.width;
  const data   = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;

  return (x, y) => {
    const i = (Math.round((host.top + y - rect.top) * scale) * canvas.width + Math.round((host.left + x - rect.left) * scale)) * 4;

    return [data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0, data[i + 3] ?? 0];
  };
}

type GPUish = {
  requestAdapter (): Promise<{ requestDevice (): Promise<GPUDeviceish> } | null>;
  getPreferredCanvasFormat (): string;
};

type GPUDeviceish = {
  queue: { submit (buffers: unknown[]): void; onSubmittedWorkDone (): Promise<void> };
  createCommandEncoder (): {
    beginRenderPass (descriptor: unknown): { end (): void };
    finish (): unknown;
  };
  destroy (): void;
};

async function gpuDevice (): Promise<{ gpu: GPUish; device: GPUDeviceish } | null> {
  const gpu     = (navigator as Navigator & { gpu?: GPUish }).gpu;
  const adapter = gpu ? await gpu.requestAdapter().catch(() => null) : null;
  const device  = adapter ? await adapter.requestDevice().catch(() => null) : null;

  return gpu && device ? { gpu, device } : null;
}

// Returns once the clear is queued, in the caller's task
function clearWebGPU (canvas: HTMLCanvasElement, gpu: GPUish, device: GPUDeviceish, color: { r: number; g: number; b: number }): void {
  const context = canvas.getContext('webgpu') as unknown as {
    configure (options: unknown): void;
    getCurrentTexture (): { createView (): unknown };
  };

  context.configure({ device, format: gpu.getPreferredCanvasFormat(), alphaMode: 'opaque' });

  const encoder = device.createCommandEncoder();

  encoder.beginRenderPass({
    colorAttachments: [{ view: context.getCurrentTexture().createView(), clearValue: { ...color, a: 1 }, loadOp: 'clear', storeOp: 'store' }],
  }).end();
  device.queue.submit([encoder.finish()]);
}

describe('sampleBackdrop', () => {

  test('a 2D canvas split warm and cool lights each cell after its half, tiling the rect', async () => {
    const { host, canvas } = halves(800, 400, 'left: 20px; top: 30px; width: 400px; height: 200px');
    const lights = await sampleBackdrop(canvas);

    expect(lights).toHaveLength(12);

    for (const light of lights) {
      const [col] = light.id!.split('-').slice(1).map(Number) as [number, number];
      const [r, , b] = colorOf(light);

      expect(light.kind).toBe('ambient');

      if (col < 2) expect(r).toBeGreaterThan(b + 0.5);
      else expect(b).toBeGreaterThan(r + 0.5);
    }

    const region = (col: number, row: number) => lights.find((light) => light.id === `backdrop-${col}-${row}`)!.region!;

    expect(region(0, 0)).toMatchObject({ left: 20, top: 30 });
    expect(region(3, 2)).toMatchObject({ right: 420, bottom: 230 });

    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 4; col++) {
        if (col < 3) expect(region(col, row).right).toBe(region(col + 1, row).left);
        if (row < 2) expect(region(col, row).bottom).toBe(region(col, row + 1).top);
      }
    }

    host.remove();
  });

  test('a WebGL2 canvas with preserveDrawingBuffer yields its clear color', async () => {
    const host   = mount('<canvas width="320" height="180" style="position: fixed; left: 0; top: 0; width: 320px; height: 180px"></canvas>');
    const canvas = host.querySelector('canvas')!;
    const gl     = canvas.getContext('webgl2', { preserveDrawingBuffer: true })!;

    gl.clearColor(0.2, 0.6, 0.4, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    await settle(2);

    const lights = await sampleBackdrop(canvas, { columns: 2, rows: 2, gain: 2 });

    expect(lights).toHaveLength(4);

    for (const light of lights) {
      const [r, g, b] = colorOf(light);

      expect(g).toBeCloseTo(1, 2);
      expect(r).toBeCloseTo(1 / 3, 1);
      expect(b).toBeCloseTo(2 / 3, 1);
      expect(light.intensity).toBeCloseTo(1.2, 1);
    }

    host.remove();
  });

  test('a WebGPU canvas sampled in the task that drew it yields its clear color', async (context) => {
    const found = await gpuDevice();

    if (!found) {
      context.skip('WebGPU has no adapter in this browser');
      return;
    }

    const host   = mount('<canvas width="320" height="180" style="position: fixed; left: 0; top: 0; width: 320px; height: 180px"></canvas>');
    const canvas = host.querySelector('canvas')!;

    clearWebGPU(canvas, found.gpu, found.device, { r: 0.8, g: 0.4, b: 0.2 });

    const lights = await sampleBackdrop(canvas, { columns: 1, rows: 1 });
    const [r, g, b] = colorOf(lights[0]!);

    expect(r).toBeCloseTo(1, 2);
    expect(g).toBeCloseTo(0.5, 1);
    expect(b).toBeCloseTo(0.25, 1);
    expect(lights[0]!.intensity).toBeCloseTo(0.8, 1);

    found.device.destroy();
    host.remove();
  });

  test('weighs a cell by how much of it is covered', async () => {
    const host   = mount('<canvas width="40" height="20" style="position: fixed; left: 0; top: 0; width: 40px; height: 20px"></canvas>');
    const canvas = host.querySelector('canvas')!;
    const ctx    = canvas.getContext('2d')!;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 20, 20);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(20, 0, 20, 20);

    const [solid, faint] = await sampleBackdrop(canvas, { columns: 2, rows: 1 });

    expect(solid!.intensity).toBeCloseTo(1, 1);
    expect(faint!.intensity).toBeLessThan(0.2);

    host.remove();
  });

  test('refuses a grid past the per-scope cap and returns nothing for an empty canvas', async () => {
    const host   = mount('<canvas width="0" height="0"></canvas>');
    const canvas = host.querySelector('canvas')!;

    await expect(sampleBackdrop(canvas, { columns: 5, rows: 4 })).rejects.toThrow(RangeError);
    await expect(sampleBackdrop(canvas)).resolves.toEqual([]);

    host.remove();
  });

});

describe('watchBackdrop', () => {

  test('lights its scope with page lights first, then the backdrop, and stop() hands back', async () => {
    const { host, canvas } = halves(200, 100, 'left: 0; top: 0; width: 200px; height: 100px');
    const scope = host;
    const page  = [{ kind: 'directional', angle: 30, intensity: 0.3, id: 'page-key' }] satisfies DropletLight[];
    const watch = watchBackdrop(canvas, { scope, interval: 0, columns: 2, rows: 1, lights: () => page, flashSafety: false });

    await vi.waitFor(() => expect(getLights(scope)).toHaveLength(3));
    expect(getLights(scope).map((light) => light.id)).toEqual(['page-key', 'backdrop-0-0', 'backdrop-1-0']);
    expect(getLights(document)).toHaveLength(0);

    watch.stop();
    expect(getLights(scope).map((light) => light.id)).toEqual(['page-key']);

    host.remove();
  });

  test('reports a grid that would crowd out page lights instead of cropping it', async () => {
    const { host, canvas } = halves(200, 100, 'left: 0; top: 0; width: 200px; height: 100px');
    const page    = Array.from({ length: 6 }, (_, i) => ({ kind: 'ambient', intensity: 0.1, id: `p${i}` })) satisfies DropletLight[];
    const onError = vi.fn();
    const watch   = watchBackdrop(canvas, { scope: host, interval: 0, columns: 4, rows: 3, lights: page, onError, flashSafety: false });

    await vi.waitFor(() => expect(onError).toHaveBeenCalled());
    expect(onError.mock.calls[0]![0]).toBeInstanceOf(RangeError);
    expect(getLights(host)).toHaveLength(0);

    watch.stop();
    host.remove();
  });

  test('ends by itself when its canvas leaves the page', async () => {
    const { host, canvas } = halves(200, 100, 'left: 0; top: 0; width: 200px; height: 100px');
    const watch = watchBackdrop(canvas, { scope: host, interval: 0, columns: 2, rows: 1, flashSafety: false });

    await vi.waitFor(() => expect(getLights(host)).toHaveLength(2));

    canvas.remove();
    await settle(6);
    expect(getLights(host)).toHaveLength(0);

    host.append(canvas);
    await settle(10);
    expect(getLights(host)).toHaveLength(0);

    watch.stop();
    host.remove();
  });

  test('skips frames while a sample is pending and never samples a hidden page', async () => {
    const { host, canvas } = halves(200, 100, 'left: 0; top: 0; width: 200px; height: 100px');
    const real    = window.createImageBitmap.bind(window);
    const waiting: Array<() => void> = [];

    const bitmap = vi.spyOn(window, 'createImageBitmap').mockImplementation(((...args: Parameters<typeof createImageBitmap>) => {
      const result = real(...args);

      return new Promise<ImageBitmap>((resolve) => waiting.push(() => resolve(result)));
    }) as typeof createImageBitmap);

    const watch = watchBackdrop(canvas, { interval: 0, columns: 2, rows: 1, flashSafety: false });

    await settle(6);
    expect(bitmap).toHaveBeenCalledTimes(1);

    waiting.shift()!();
    await vi.waitFor(() => expect(bitmap).toHaveBeenCalledTimes(2));
    expect(getLights()).toHaveLength(2);

    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
    waiting.shift()!();
    await settle(6);
    expect(bitmap).toHaveBeenCalledTimes(2);

    delete (document as { visibilityState?: unknown }).visibilityState;
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.waitFor(() => expect(bitmap).toHaveBeenCalledTimes(3));

    watch.stop();
    waiting.shift()!();
    await settle(6);
    expect(bitmap).toHaveBeenCalledTimes(3);
    expect(getLights()).toHaveLength(0);

    host.remove();
  });

  test('holds to its interval between samples', async () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });

    try {
      const { host, canvas } = halves(200, 100, 'left: 0; top: 0; width: 200px; height: 100px');
      const bitmap = vi.spyOn(window, 'createImageBitmap');
      const watch  = watchBackdrop(canvas, { columns: 1, rows: 1, flashSafety: false });

      await vi.advanceTimersByTimeAsync(16);
      expect(bitmap).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(200);
      expect(bitmap).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(100);
      expect(bitmap).toHaveBeenCalledTimes(2);

      watch.stop();
      host.remove();
    } finally {
      vi.useRealTimers();
    }
  });

  test('samples a WebGL canvas without preserveDrawingBuffer when started after its render loop', async () => {
    const host   = mount('<canvas width="320" height="180" style="position: fixed; left: 0; top: 0; width: 320px; height: 180px"></canvas>');
    const canvas = host.querySelector('canvas')!;
    const gl     = canvas.getContext('webgl2')!;

    let running = true;

    const draw = (): void => {
      if (!running) return;
      gl.clearColor(0.1, 0.3, 0.9, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      requestAnimationFrame(draw);
    };

    requestAnimationFrame(draw);
    await settle(2);

    const watch = watchBackdrop(canvas, { interval: 0, columns: 1, rows: 1, flashSafety: false });

    await vi.waitFor(() => expect(getLights()).toHaveLength(1));

    const [light] = getLights();

    expect(light!.rgb[2]).toBeCloseTo(1, 2);
    expect(light!.rgb[0]).toBeCloseTo(1 / 9, 1);
    expect(light!.intensity).toBeCloseTo(0.9, 1);

    watch.stop();
    running = false;
    host.remove();
  });

});

test('a control over a warm cell paints warmer than one over a cool cell', async () => {
  const { host, canvas } = halves(400, 100, 'left: 0; top: 0; width: 400px; height: 100px');

  host.insertAdjacentHTML('beforeend', `
    <droplet-button style="position: fixed; left: 40px; top: 20px; width: 120px; --droplet-fill: #808080">Warm</droplet-button>
    <droplet-button style="position: fixed; left: 240px; top: 20px; width: 120px; --droplet-fill: #808080">Cool</droplet-button>`);

  await settle(30);

  const [warm, cool] = host.querySelectorAll('droplet-button') as unknown as [DropletElement, DropletElement];

  setLights(await sampleBackdrop(canvas, { columns: 2, rows: 1 }), { flashSafety: false });
  warm.requestFrame();
  cool.requestFrame();
  await settle(4);

  const [wr, , wb] = sampler(warm)(12, 20);
  const [cr, , cb] = sampler(cool)(12, 20);

  expect(wr).toBeGreaterThan(wb);
  expect(cb).toBeGreaterThan(cr);
  expect((wr - wb) - (cr - cb)).toBeGreaterThan(30);

  host.remove();
});

describe('cost at 2560 × 1440', () => {

  const RUNS = 9;

  const median = (values: number[]): number => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? NaN;

  async function measure (label: string, canvas: HTMLCanvasElement, redraw: () => void): Promise<void> {
    const callMs: number[] = [];
    const bitmapMs: number[] = [];
    const readMs: number[] = [];
    const totalMs: number[] = [];
    const stillMs: number[] = [];
    const drawMs: number[] = [];
    const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;

    ctx.canvas.width  = 16;
    ctx.canvas.height = 12;

    for (let i = 0; i < RUNS + 1; i++) {
      redraw();

      // The synchronous part of the call is what blocks the main thread
      const t0      = performance.now();
      const promise = createImageBitmap(canvas, { resizeWidth: 16, resizeHeight: 12, resizeQuality: 'low' });
      const tc      = performance.now();
      const bitmap  = await promise;
      const t1      = performance.now();

      ctx.drawImage(bitmap, 0, 0);
      ctx.getImageData(0, 0, 16, 12);
      bitmap.close();

      const t2 = performance.now();

      redraw();

      const t3 = performance.now();

      await sampleBackdrop(canvas);

      const t4 = performance.now();

      // Again with no new draw, so pending draw work is not billed to the sample
      await sampleBackdrop(canvas);

      const t5 = performance.now();

      redraw();

      const t6 = performance.now();

      ctx.drawImage(canvas, 0, 0, 16, 12);
      ctx.getImageData(0, 0, 16, 12);

      const t7 = performance.now();

      // The first run warms shaders and caches
      if (i === 0) continue;
      callMs.push(tc - t0);
      bitmapMs.push(t1 - t0);
      readMs.push(t2 - t1);
      totalMs.push(t4 - t3);
      stillMs.push(t5 - t4);
      drawMs.push(t7 - t6);
    }

    console.log(`[backdrop-cost] ${navigator.userAgent.match(/(Firefox|Chrome|Version)\/[\d.]+/)?.[0] ?? 'unknown'} ${label}: call ${median(callMs).toFixed(2)} ms, bitmap ${median(bitmapMs).toFixed(2)} ms, read ${median(readMs).toFixed(2)} ms, total ${median(totalMs).toFixed(2)} ms, unchanged canvas ${median(stillMs).toFixed(2)} ms, drawImage path ${median(drawMs).toFixed(2)} ms (median of ${RUNS})`);

    expect(median(totalMs)).toBeLessThan(1000);
  }

  const big = (): { host: HTMLDivElement; canvas: HTMLCanvasElement } => {
    const host = mount('<canvas width="2560" height="1440" style="position: fixed; left: 0; top: 0; width: 640px; height: 360px"></canvas>');

    return { host, canvas: host.querySelector('canvas')! };
  };

  test('2D', async () => {
    const { host, canvas } = big();
    const ctx = canvas.getContext('2d')!;

    let hue = 0;

    await measure('2d', canvas, () => {
      const gradient = ctx.createLinearGradient(0, 0, 2560, 1440);

      gradient.addColorStop(0, `hsl(${hue += 37} 70% 50%)`);
      gradient.addColorStop(1, `hsl(${hue + 180} 70% 30%)`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 2560, 1440);
    });

    host.remove();
  });

  test('WebGL2', async () => {
    const { host, canvas } = big();
    const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true })!;

    let shade = 0;

    const info     = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);

    await measure(`webgl2 (${String(renderer)})`, canvas, () => {
      shade = (shade + 0.13) % 1;
      gl.clearColor(shade, 0.4, 1 - shade, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    });

    host.remove();
  });

  test('WebGPU', async (context) => {
    const found = await gpuDevice();

    if (!found) {
      context.skip('WebGPU has no adapter in this browser');
      return;
    }

    const { host, canvas } = big();

    let shade = 0;

    await measure('webgpu', canvas, () => {
      shade = (shade + 0.13) % 1;
      clearWebGPU(canvas, found.gpu, found.device, { r: shade, g: 0.4, b: 1 - shade });
    });

    found.device.destroy();
    host.remove();
  });

});
