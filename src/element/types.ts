// Shared shape, paint, and wiring types for DropletElement and its subclasses

import type { SurfacePoint } from '../core/index.js';

// [r, g, b, a] with rgb in 0–255 and alpha in 0–1
export type RGBA = [number, number, number, number];

// The soft-body shape a subclass builds from its measured host size
export interface Shape {
  width: number;
  height: number;
  radius: number;
}

export interface Ring {
  color: string;
  width: number;
  gap: number;
}

export interface Border {
  width: number;
  color: string;
}

export interface PaintOptions {
  fill?: string;
  cx?: number;
  cy?: number;
  alpha?: number;
  ctx?: CanvasRenderingContext2D;
  cssW?: number;
  cssH?: number;
  ring?: Ring | null;
  scaleX?: number;
  scaleY?: number;
  border?: Border | null;
  warp?: ((point: SurfacePoint) => SurfacePoint) | null;
  ease?: boolean;
  easeKey?: string;
}

export interface WirePressOptions {
  keyboard?: boolean;
  disabled?: () => boolean;
}
