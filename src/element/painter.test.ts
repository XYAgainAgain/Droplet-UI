import { describe, expect, it, vi } from 'vitest';

import { JellyElement }      from './index.js';
import { buildFrame }        from './painter.js';
import type { PainterFrame } from './painter.js';

import type { Border, Shape } from './types.js';
import { traceSmoothPath }    from '../core/index.js';
import type { SurfacePoint }  from '../core/index.js';

import { mount, settle }     from '../testing/index.js';

class ProbeElement extends JellyElement {

  frames: PainterFrame[] = [];
  fillStyles: string[] = [];

  override shape (): Shape {
    return { width: 100, height: 40, radius: 20 };
  }

  override fill (): string {
    return '#123456';
  }

  override paintSurface (frame: PainterFrame): void {
    this.frames.push(frame);
    this.fillStyles.push(String(frame.ctx.fillStyle));
    super.paintSurface(frame);
  }

}

/*
 * Leaks transform, clip and fill style before throwing: the fallback fill and
 * the border must still land undistorted in the surface color.
 */
class HostileElement extends ProbeElement {

  calls = 0;

  override paintSurface (frame: PainterFrame): void {
    this.calls++;

    frame.ctx.translate(400, 400);
    frame.ctx.scale(0.02, 0.02);
    frame.ctx.beginPath();
    frame.ctx.rect(-1, -1, 2, 2);
    frame.ctx.clip();
    frame.ctx.fillStyle = '#00ff00';
    frame.ctx.globalAlpha = 0.1;

    throw new Error('boom');
  }

  override surfaceBorder (): Border {
    return { width: 3, color: '#ff0000' };
  }

}

class AsyncElement extends ProbeElement {
  override paintSurface (frame: PainterFrame): unknown {
    super.paintSurface(frame);
    return Promise.resolve();
  }
}

customElements.define('x-probe-paint', ProbeElement);
customElements.define('x-hostile-paint', HostileElement);
customElements.define('x-async-paint', AsyncElement);

const SIZED = 'style="width:100px;height:40px"';

function pixel (el: JellyElement, x: number, y: number): Uint8ClampedArray {
  return el.ctx.getImageData(x, y, 1, 1).data;
}

// True when the pixel at the canvas center is not fully transparent
function centerPainted (el: JellyElement): boolean {
  const data = pixel(el, Math.round(el.canvas.width / 2), Math.round(el.canvas.height / 2));

  return (data[3] ?? 0) > 0;
}

// Any strongly red pixel, i.e. the border stroke survived the failed painter
function hasRedStroke (el: JellyElement): boolean {
  const { data } = el.ctx.getImageData(0, 0, el.canvas.width, el.canvas.height);

  for (let i = 0; i < data.length; i += 4) {
    if ((data[i] ?? 0) > 150 && (data[i + 1] ?? 255) < 90 && (data[i + 2] ?? 255) < 90) {
      return true;
    }
  }

  return false;
}

function freshCanvas (w: number, h: number): CanvasRenderingContext2D {
  const canvas  = document.createElement('canvas');
  canvas.width  = w;
  canvas.height = h;

  return canvas.getContext('2d')!;
}

describe('painter frame', () => {

  it('hands the hook a frozen frame with a Path2D and readonly points', async () => {
    const host = mount(`<x-probe-paint ${SIZED}></x-probe-paint>`);
    await settle();

    const el    = host.firstElementChild as ProbeElement;
    const frame = el.frames.at(-1)!;

    expect(Object.isFrozen(frame)).toBe(true);
    expect(frame.path).toBeInstanceOf(Path2D);
    expect(frame.version).toBe(1);
    expect(frame.width).toBe(el.cssW);
    expect(frame.height).toBe(el.cssH);
    expect(frame.dpr).toBe(el.dpr);
    expect(frame.points.length).toBeGreaterThan(0);
    expect(() => { (frame.points as SurfacePoint[]).push(frame.points[0]!); }).toThrow();

    host.remove();
  });

  it('fills identically through the frame Path2D and a direct trace', async () => {
    const host = mount(`<x-probe-paint ${SIZED}></x-probe-paint>`);
    await settle();

    const el     = host.firstElementChild as ProbeElement;
    const frame  = el.frames.at(-1)!;
    const points = frame.points.map((point) => ({ ...point }));
    const w      = Math.round(frame.width);
    const h      = Math.round(frame.height);

    const direct = freshCanvas(w, h);
    direct.translate(w / 2, h / 2);
    direct.fillStyle = '#123456';
    traceSmoothPath(direct, points);
    direct.fill();

    const viaPath = freshCanvas(w, h);
    viaPath.translate(w / 2, h / 2);
    viaPath.fillStyle = '#123456';
    viaPath.fill(buildFrame({ ctx: viaPath, points, resting: frame.resting, dpr: frame.dpr, width: frame.width, height: frame.height }).path);

    const a = direct.getImageData(0, 0, w, h).data;
    const b = viaPath.getImageData(0, 0, w, h).data;

    let painted = 0;
    let diffs   = 0;

    for (let i = 0; i < a.length; i += 4) {
      if ((a[i + 3] ?? 0) > 0) {
        painted++;
      }
    }

    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) {
        diffs++;
      }
    }

    expect(painted).toBeGreaterThan(100);
    expect(diffs).toBe(0);

    host.remove();
  });

  it('exposes the eased surface color through fillStyle before the hook runs', async () => {
    const host = mount(`<x-probe-paint ${SIZED}></x-probe-paint>`);
    await settle();

    const el = host.firstElementChild as ProbeElement;

    // The frame is only valid during the call; the recorded value is the
    // eased surface color the base class set before the hook ran
    expect(el.fillStyles.at(-1)).toBe('#123456');

    host.remove();
  });

  it('disables a throwing painter after one error and re-enables it on reconnect', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const host  = mount(`<x-hostile-paint ${SIZED}></x-hostile-paint>`);

    await settle(8);

    const el = host.firstElementChild as HostileElement;

    expect(el.calls).toBe(1);
    expect(error).toHaveBeenCalledTimes(1);

    // Later frames skip the hook entirely and still paint the matte surface
    el.frame(16);

    expect(el.calls).toBe(1);
    expect(error).toHaveBeenCalledTimes(1);
    expect(centerPainted(el)).toBe(true);

    const center = pixel(el, Math.round(el.canvas.width / 2), Math.round(el.canvas.height / 2));

    expect(center[3]).toBe(255);
    expect(Math.abs((center[0] ?? 0) - 0x12)).toBeLessThanOrEqual(2);
    expect(Math.abs((center[1] ?? 0) - 0x34)).toBeLessThanOrEqual(2);
    expect(Math.abs((center[2] ?? 0) - 0x56)).toBeLessThanOrEqual(2);
    expect(hasRedStroke(el)).toBe(true);

    host.remove();
    document.body.appendChild(host);

    el.frame(16);

    expect(el.calls).toBe(2);
    expect(error).toHaveBeenCalledTimes(2);
    expect(centerPainted(el)).toBe(true);

    error.mockRestore();
    host.remove();
  });

  it('warns once when a painter returns a thenable', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const host = mount(`<x-async-paint ${SIZED}></x-async-paint>`);

    await settle(8);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(centerPainted(host.firstElementChild as AsyncElement)).toBe(true);

    warn.mockRestore();
    host.remove();
  });

  it('marks the host when no 2D context is available', async () => {
    const original = HTMLCanvasElement.prototype.getContext;

    HTMLCanvasElement.prototype.getContext = function () { return null; } as typeof original;

    const host = mount(`<x-probe-paint ${SIZED}></x-probe-paint>`);

    HTMLCanvasElement.prototype.getContext = original;

    const el = host.firstElementChild as ProbeElement;

    expect(el.hasAttribute('data-jelly-nocanvas')).toBe(true);

    await settle();

    expect(() => { el.applyShape(); el.clearCanvas(); el.frame(16); }).not.toThrow();
    expect(el.frames).toHaveLength(0);

    host.remove();
  });

});
