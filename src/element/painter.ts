/*
 * The painter frame: the frozen, versioned record a JellyElement hands to
 * paintSurface() once per body per paint. See .dev/docs/contracts/painter.md.
 */

import { traceSmoothPath }   from '../core/index.js';
import type { SurfacePoint } from '../core/index.js';

export interface PainterFrame {
  readonly ctx: CanvasRenderingContext2D;
  readonly path: Path2D;
  readonly points: ReadonlyArray<SurfacePoint>;
  readonly resting: boolean;
  readonly dpr: number;
  readonly width: number;
  readonly height: number;
  readonly version: 1;
}

export interface FrameInput {
  ctx: CanvasRenderingContext2D;
  points: SurfacePoint[];
  resting: boolean;
  dpr: number;
  width: number;
  height: number;
}

/*
 * Trace the already-projected points into a Path2D once per paint; the
 * surface fill and the border stroke share it.
 */
export function buildFrame ({ ctx, points, resting, dpr, width, height }: FrameInput): PainterFrame {
  const path = new Path2D();

  traceSmoothPath(path, points);

  const frame: PainterFrame = {
    ctx,
    path,
    points: Object.freeze(points),
    resting,
    dpr,
    width,
    height,
    version: 1,
  };

  return Object.freeze(frame);
}
