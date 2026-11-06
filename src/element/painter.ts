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
  points: readonly SurfacePoint[];
  resting: boolean;
  dpr: number;
  width: number;
  height: number;
}

// The surface fill and the border stroke share one Path2D
export function buildFrame ({ ctx, points, resting, dpr, width, height }: FrameInput): PainterFrame {
  const path = new Path2D();

  traceSmoothPath(path, points);

  const frame: PainterFrame = {
    ctx,
    path,
    // Copied so freezing never locks a buffer the caller still writes to
    points: Object.freeze(points.slice()),
    resting,
    dpr,
    width,
    height,
    version: 1,
  };

  return Object.freeze(frame);
}
