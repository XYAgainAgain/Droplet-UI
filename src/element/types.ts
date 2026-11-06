import type { SurfacePoint } from '../core/index.js';

// rgb 0–255, alpha 0–1
export type RGBA = [number, number, number, number];

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
