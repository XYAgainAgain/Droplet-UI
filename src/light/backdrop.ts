import { MAX_LIGHTS_PER_SCOPE, setLights } from './index.js';
import type { DropletLight } from './index.js';

export interface BackdropOptions {
  columns?: number;
  rows?: number;
  // 1 means a white cell leaves a control unchanged
  gain?: number;
  // Pixels read per cell side
  detail?: number;
  feather?: number;
  idPrefix?: string;
}

export type PageLights = readonly DropletLight[] | (() => readonly DropletLight[] | null | undefined);

export interface WatchBackdropOptions extends BackdropOptions {
  // ms; 0 samples every frame, never faster than the display rate
  interval?: number;
  lights?: PageLights;
  scope?: Element | Document;
  flashSafety?: boolean;
  onError?: (error: unknown) => void;
}

export interface BackdropWatch {
  stop (): void;
}

const DEFAULT_COLUMNS = 4;
const DEFAULT_ROWS = 3;
const DEFAULT_DETAIL = 4;
const DEFAULT_INTERVAL = 250;

const readers = new WeakMap<Document, CanvasRenderingContext2D | null>();

function reader (doc: Document): CanvasRenderingContext2D | null {
  let ctx = readers.get(doc);

  if (ctx === undefined) {
    ctx = doc.createElement('canvas').getContext('2d', { willReadFrequently: true });
    readers.set(doc, ctx);
  }

  return ctx;
}

function count (value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(1, Math.floor(value)) : fallback;
}

// createImageBitmap snapshots on call, so a WebGL canvas without preserveDrawingBuffer must be sampled in its draw's task
async function readPixels (source: HTMLCanvasElement, w: number, h: number): Promise<Uint8ClampedArray | null> {
  const doc  = source.ownerDocument;
  const view = doc.defaultView;
  const ctx  = reader(doc);

  if (!ctx) {
    return null;
  }

  let bitmap: ImageBitmap | null = null;

  if (view && typeof view.createImageBitmap === 'function') {
    try {
      bitmap = await view.createImageBitmap(source, { resizeWidth: w, resizeHeight: h, resizeQuality: 'low' });
    } catch {
      bitmap = null;
    }
  }

  ctx.canvas.width  = w;
  ctx.canvas.height = h;
  ctx.clearRect(0, 0, w, h);

  // An engine that can't bitmap this context still scales it through drawImage
  if (bitmap) {
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
  } else {
    ctx.drawImage(source, 0, 0, w, h);
  }

  return ctx.getImageData(0, 0, w, h).data;
}

// One ambient light per cell: its hue, at its brightest channel × gain; a transparent cell gives none
export async function sampleBackdrop (source: HTMLCanvasElement, options: BackdropOptions = {}): Promise<DropletLight[]> {
  const columns = count(options.columns, DEFAULT_COLUMNS);
  const rows    = count(options.rows, DEFAULT_ROWS);
  const detail  = count(options.detail, DEFAULT_DETAIL);
  const gain    = typeof options.gain === 'number' && Number.isFinite(options.gain) ? Math.max(0, options.gain) : 1;
  const prefix  = options.idPrefix ?? 'backdrop';

  if (columns * rows > MAX_LIGHTS_PER_SCOPE) {
    throw new RangeError(`A ${columns} × ${rows} backdrop grid exceeds ${MAX_LIGHTS_PER_SCOPE} lights`);
  }

  if (source.width === 0 || source.height === 0) {
    return [];
  }

  const rect = source.getBoundingClientRect();

  if (rect.width === 0 || rect.height === 0) {
    return [];
  }

  const w    = columns * detail;
  const data = await readPixels(source, w, rows * detail);

  if (!data) {
    return [];
  }

  const lights: DropletLight[] = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;

      for (let y = row * detail; y < (row + 1) * detail; y++) {
        for (let x = col * detail; x < (col + 1) * detail; x++) {
          const i     = (y * w + x) * 4;
          const alpha = data[i + 3] ?? 0;

          r += (data[i] ?? 0) * alpha;
          g += (data[i + 1] ?? 0) * alpha;
          b += (data[i + 2] ?? 0) * alpha;
          a += alpha;
        }
      }

      if (a === 0) continue;

      const avg   = [r / a / 255, g / a / 255, b / a / 255] as const;
      const value = Math.max(avg[0], avg[1], avg[2]);
      const color = value > 0 ? [avg[0] / value, avg[1] / value, avg[2] / value] as const : [1, 1, 1] as const;

      lights.push({
        kind:      'ambient',
        color,
        // Coverage scales the light, so a nearly transparent cell barely tints
        intensity: value * gain * (a / (255 * detail * detail)),
        id:        `${prefix}-${col}-${row}`,
        region:    {
          left:    rect.left + (col / columns) * rect.width,
          right:   rect.left + ((col + 1) / columns) * rect.width,
          top:     rect.top + (row / rows) * rect.height,
          bottom:  rect.top + ((row + 1) / rows) * rect.height,
          ...(options.feather === undefined ? {} : { feather: options.feather }),
        },
      });
    }
  }

  return lights;
}

// Start after the scene's render loop so each sample follows its draw; page lights go first so the cap never drops them
export function watchBackdrop (source: HTMLCanvasElement, options: WatchBackdropOptions = {}): BackdropWatch {
  const doc      = source.ownerDocument;
  const view     = doc.defaultView;
  const scope    = options.scope ?? doc;
  const interval = typeof options.interval === 'number' && Number.isFinite(options.interval) ? Math.max(0, options.interval) : DEFAULT_INTERVAL;
  const settings = { scope, flashSafety: options.flashSafety !== false };

  // Fails here rather than inside the first frame
  if (count(options.columns, DEFAULT_COLUMNS) * count(options.rows, DEFAULT_ROWS) > MAX_LIGHTS_PER_SCOPE) {
    throw new RangeError(`A backdrop grid may hold at most ${MAX_LIGHTS_PER_SCOPE} lights`);
  }

  let stopped = false;
  let pending = false;
  let frame: number | undefined;
  let last = -Infinity;

  const pageLights = (): readonly DropletLight[] => {
    const lights = typeof options.lights === 'function' ? options.lights() : options.lights;

    return lights ?? [];
  };

  const report = (error: unknown): void => {
    if (options.onError) options.onError(error);
    else console.warn('[droplet] backdrop sample failed', error);
  };

  const hidden = (): boolean => doc.visibilityState === 'hidden';

  // Past the per-scope cap is an error, never a silent crop
  const apply = (backdrop: DropletLight[]): void => {
    if (stopped) return;

    const page = pageLights();

    if (page.length + backdrop.length > MAX_LIGHTS_PER_SCOPE) {
      throw new RangeError(`${page.length} page lights plus a ${backdrop.length}-cell backdrop exceed ${MAX_LIGHTS_PER_SCOPE} lights`);
    }

    setLights([...page, ...backdrop], settings);
  };

  const sample = (): void => {
    pending = true;

    sampleBackdrop(source, options).then(apply).catch(report).finally(() => {
      pending = false;
    });
  };

  let seen = source.isConnected;

  const tick = (now: number): void => {
    frame = undefined;

    if (stopped || hidden()) {
      return;
    }

    // A canvas taken off the page ends its watch
    if (seen && !source.isConnected) {
      watch.stop();
      return;
    }

    seen ||= source.isConnected;

    if (!pending && now - last >= interval) {
      last = now;
      sample();
    }

    schedule();
  };

  const schedule = (): void => {
    if (frame === undefined && !stopped && view) {
      frame = view.requestAnimationFrame(tick);
    }
  };

  const onVisibility = (): void => {
    if (hidden()) {
      if (frame !== undefined) view?.cancelAnimationFrame(frame);
      frame = undefined;
    } else {
      schedule();
    }
  };

  doc.addEventListener('visibilitychange', onVisibility);
  schedule();

  const watch: BackdropWatch = {
    stop () {
      if (stopped) return;

      stopped = true;
      doc.removeEventListener('visibilitychange', onVisibility);
      if (frame !== undefined) view?.cancelAnimationFrame(frame);

      let page: readonly DropletLight[] = [];

      try {
        page = pageLights();
      } catch (error) {
        report(error);
      }

      setLights(page.length > 0 ? page : null, settings);
    },
  };

  return watch;
}
