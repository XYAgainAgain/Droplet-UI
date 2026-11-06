import '../presets/material.js';

import { getPreset } from '../presets/index.js';
import { MAX_LIGHTS_PER_CONTROL } from '../light/index.js';
import type { Light } from '../light/index.js';

export interface MaterialRecord {
  diffuse: number;
  specular: number;
  sharpness: number;
  rim: number;
  glint: number;
  transmission: number;
  meniscus: number;
  defaultLight: boolean;
}

export const MATTE: Readonly<MaterialRecord> = Object.freeze({ diffuse: 1, specular: 0, sharpness: 0.5, rim: 0, glint: 0, transmission: 0, meniscus: 0, defaultLight: false });

export type RGB = readonly [number, number, number];

export interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

// dirX and dirY are in the rotated painting space
export interface Incidence {
  rgb: RGB;
  intensity: number;
  softness: number;
  dirX: number;
  dirY: number;
  facing: number;
  raking: number;
}

export interface Caustic {
  rgb: RGB;
  amount: number;
}

// points are in the painting space, toViewport maps that space to viewport px, time is seconds (0 under reduced motion)
export interface SurfaceExtras {
  points: ReadonlyArray<{ x: number; y: number }>;
  fill: RGB;
  toViewport: DOMMatrix;
  time: number;
  ambient: RGB;
  caustics: Caustic[];
}

export interface Shading {
  multiply: RGB;
  screen: RGB;
  lights: Incidence[];
  lightScale: number;
  darkScale: number;
}

// MAX_DARKEN and MAX_BRIGHTEN cap how far light may move a fill, whatever the contrast allows
// FLOOR is the WCAG AA contrast ratio the label keeps
const MAX_DARKEN = 0.6;
const MAX_BRIGHTEN = 0.5;
const SHADOW = 0.5;
const SIDE = 0.5;
const FLOOR = 4.5;

const DEG = Math.PI / 180;

export function materialRecord (name: string, doc?: Document): Readonly<MaterialRecord> | null {
  const record = getPreset<Partial<MaterialRecord>>('material', name, doc);

  return record ? { ...MATTE, ...record } : null;
}

// By intensity × luma, capped per control
export function strongest (lights: readonly Light[]): Light[] {
  return [...lights]
    .sort((a, b) => b.intensity * luma(b.rgb) - a.intensity * luma(a.rgb))
    .slice(0, MAX_LIGHTS_PER_CONTROL);
}

export function causticsOf (lights: readonly Light[]): Caustic[] {
  const out: Caustic[] = [];

  for (const light of strongest(lights)) {
    if (light.caustics > 0 && light.intensity > 0) out.push({ rgb: light.rgb, amount: light.caustics * Math.min(1, light.intensity * 8) });
  }

  return out;
}

function luma (rgb: RGB): number {
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}

// (cx, cy) in viewport px; angles run clockwise from 0° up
export function incidences (lights: readonly Light[], cx: number, cy: number, rotation = 0): { ambient: RGB; lights: Incidence[] } {
  const ambient: [number, number, number] = [0, 0, 0];
  const out: Incidence[] = [];

  for (const light of strongest(lights)) {
    if (light.kind === 'ambient') {
      for (let i = 0; i < 3; i++) ambient[i]! += light.rgb[i]! * light.intensity;
      continue;
    }

    let dx: number;
    let dy: number;
    let elevation: number;

    if (light.kind === 'point') {
      dx = light.x - cx;
      dy = light.y - cy;

      const distance = Math.hypot(dx, dy);

      elevation = Number.isNaN(light.elevation) ? Math.atan2(light.height, distance) : light.elevation * DEG;
    } else {
      dx = Math.sin(light.angle * DEG);
      dy = -Math.cos(light.angle * DEG);
      elevation = light.elevation * DEG;
    }

    const length = Math.hypot(dx, dy);
    const cos    = Math.cos(-rotation);
    const sin    = Math.sin(-rotation);
    const ux     = length > 1e-6 ? dx / length : 0;
    const uy     = length > 1e-6 ? dy / length : 0;

    out.push({
      rgb:       light.rgb,
      intensity: light.intensity,
      softness:  light.softness,
      dirX:      ux * cos - uy * sin,
      dirY:      ux * sin + uy * cos,
      facing:    Math.sin(elevation),
      raking:    length > 1e-6 ? Math.cos(elevation) : 0,
    });
  }

  return { ambient, lights: out };
}

// WCAG 2 relative luminance of an sRGB color in 0–1
export function luminance (rgb: RGB): number {
  const channel = (c: number): number => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

  return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
}

export function contrast (a: RGB, b: RGB): number {
  const la = luminance(a);
  const lb = luminance(b);

  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const screen = (a: number, b: number): number => 1 - (1 - a) * (1 - b);

// Light and shadow budgets bisect separately until the label holds WCAG AA against the brightest
// and darkest painted colors, or never worsens if it started below
export function shade (fill: RGB, text: RGB | null, ambient: RGB, lights: Incidence[], material: Readonly<MaterialRecord>): Shading {
  const exposure: [number, number, number] = [ambient[0], ambient[1], ambient[2]];

  for (const light of lights) {
    for (let i = 0; i < 3; i++) exposure[i]! += light.rgb[i]! * light.intensity * light.facing;
  }

  // Exposure 1 leaves colors unchanged; below 1 the fill multiplies toward it, above 1 the excess screens on
  const blend = (e: number): number => 1 + material.diffuse * (e - 1);

  const multiply = exposure.map((e) => Math.max(1 - MAX_DARKEN, Math.min(1, blend(e)))) as unknown as RGB;
  const over     = exposure.map((e) => Math.min(MAX_BRIGHTEN, Math.max(0, blend(e) - 1))) as unknown as RGB;

  // Upper bounds on what paintShading lays down, every layer's peak stacked at one point
  const raking = (light: Incidence): number => light.intensity * light.raking * (1 - 0.6 * light.softness) * SIDE;
  const glossy = (light: Incidence): number => light.intensity * (1 - 0.4 * light.softness);
  const shown  = lights.slice(0, 2);

  const darkest = (k: number): RGB => fill.map((c, i) => {
    let value = c * (1 - k * (1 - multiply[i]!));

    for (const light of lights) value *= 1 - k * Math.min(MAX_DARKEN, raking(light) * SHADOW);

    return value;
  }) as unknown as RGB;

  const brightest = (k: number): RGB => fill.map((c, i) => {
    let value = screen(c * multiply[i]!, Math.min(MAX_BRIGHTEN, k * over[i]!));

    for (const light of lights) value = screen(value, Math.min(MAX_BRIGHTEN, light.rgb[i]! * raking(light) * k));

    for (const light of shown) {
      value = screen(value, light.rgb[i]! * Math.min(MAX_BRIGHTEN, material.specular * glossy(light) * k));
      value = screen(value, light.rgb[i]! * Math.min(MAX_BRIGHTEN, material.rim * glossy(light) * k * light.raking));
    }

    return value;
  }) as unknown as RGB;

  let lightScale = 1;
  let darkScale  = 1;

  if (text) {
    // Staying on the fill's side of the text keeps every in-between shade above the floor too
    const floor   = Math.min(FLOOR, contrast(fill, text));
    const lighter = luminance(fill) >= luminance(text);
    const fits    = (color: RGB): boolean => contrast(color, text) >= floor - 1e-6 && (luminance(color) >= luminance(text)) === lighter;

    if (!fits(darkest(1))) darkScale = bisect((k) => fits(darkest(k)));
    if (!fits(brightest(1))) lightScale = bisect((k) => fits(brightest(k)));
  }

  return {
    multiply: multiply.map((m) => 1 - darkScale * (1 - m)) as unknown as RGB,
    screen:   over.map((o) => o * lightScale) as unknown as RGB,
    lights,
    lightScale,
    darkScale,
  };
}

// The largest k in 0–1 that still passes; passing at 0 is guaranteed by the floor
function bisect (passes: (k: number) => boolean): number {
  let lo = 0;
  let hi = 1;

  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2;

    if (passes(mid)) lo = mid;
    else hi = mid;
  }

  return lo;
}

const css = (rgb: RGB, alpha = 1): string => `rgba(${Math.round(rgb[0] * 255)}, ${Math.round(rgb[1] * 255)}, ${Math.round(rgb[2] * 255)}, ${alpha})`;

// The caller masks the result to the surface, so a layer fills its box instead of re-tracing the outline
function cover (ctx: CanvasRenderingContext2D, bounds: Bounds): void {
  ctx.fillRect(bounds.x - 2, bounds.y - 2, bounds.w + 4, bounds.h + 4);
}

// fixed is what a steady light paints and the shading cache can stretch; live follows the membrane or the clock (rim, caustics, water)
export type ShadePhase = 'all' | 'fixed' | 'live';

// bounds is in ctx's current space; the caller restores ctx state and masks the result to the surface
export function paintShading (ctx: CanvasRenderingContext2D, path: Path2D, bounds: Bounds, shading: Shading, material: Readonly<MaterialRecord>, gloss: number, extras?: SurfaceExtras, phase: ShadePhase = 'all'): void {
  const { multiply, screen: over, lights, lightScale, darkScale } = shading;
  const cx    = bounds.x + bounds.w / 2;
  const cy    = bounds.y + bounds.h / 2;
  const fixed = phase !== 'live';
  const live  = phase !== 'fixed';

  if (fixed && multiply.some((m) => m < 0.999)) {
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = css(multiply);
    cover(ctx, bounds);
  }

  for (const light of fixed ? lights : []) {
    if (light.raking < 1e-3) continue;

    // Half-extent of the box along the light's direction
    const reach  = Math.abs(light.dirX) * bounds.w / 2 + Math.abs(light.dirY) * bounds.h / 2 || 1;
    const amount = light.intensity * light.raking * (1 - 0.6 * light.softness) * SIDE;
    const x0     = cx + light.dirX * reach;
    const y0     = cy + light.dirY * reach;
    const x1     = cx - light.dirX * reach;
    const y1     = cy - light.dirY * reach;

    const lit = ctx.createLinearGradient(x0, y0, x1, y1);

    lit.addColorStop(0, css(light.rgb.map((c) => Math.min(MAX_BRIGHTEN, c * amount * lightScale)) as unknown as RGB));
    lit.addColorStop(0.5, 'rgba(0, 0, 0, 1)');
    lit.addColorStop(1, 'rgba(0, 0, 0, 1)');

    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = lit;
    cover(ctx, bounds);

    const dark = ctx.createLinearGradient(x0, y0, x1, y1);
    const far  = 1 - darkScale * Math.min(MAX_DARKEN, amount * SHADOW);

    dark.addColorStop(0, 'rgba(255, 255, 255, 1)');
    dark.addColorStop(0.5, 'rgba(255, 255, 255, 1)');
    dark.addColorStop(1, css([far, far, far]));

    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = dark;
    cover(ctx, bounds);
  }

  if (fixed && over.some((o) => o > 0.001)) {
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = css(over);
    cover(ctx, bounds);
  }

  if ((fixed && material.specular > 0) || (live && material.rim > 0)) {
    paintGloss(ctx, path, bounds, lights.slice(0, 2), material, gloss, lightScale, phase);
  }

  // Caustics and the gloss sheen are both screens, which commute, so the split keeps the result
  if (live && extras?.caustics.length) {
    paintCaustics(ctx, bounds, extras, lightScale);
  }

  if (live && (material.glint > 0 || material.transmission > 0 || material.meniscus > 0)) {
    paintWater(ctx, bounds, waterLights(lights, extras?.ambient), material, extras);
  }

  ctx.globalCompositeOperation = 'source-over';
}

// The sheen is fixed and stretches with the body; the rim strokes the outline, so it's live
function paintGloss (ctx: CanvasRenderingContext2D, path: Path2D, bounds: Bounds, lights: Incidence[], material: Readonly<MaterialRecord>, gloss: number, lightScale: number, phase: ShadePhase): void {
  const cx      = bounds.x + bounds.w / 2;
  const cy      = bounds.y + bounds.h / 2;
  const minSide = Math.min(bounds.w, bounds.h);

  ctx.globalCompositeOperation = 'screen';

  for (const light of lights) {
    const strength = light.intensity * (1 - 0.4 * light.softness) * lightScale;

    if (strength < 1e-3) continue;

    const offset = 0.55 * light.raking;
    const sx     = cx + light.dirX * offset * bounds.w / 2;
    const sy     = cy + light.dirY * offset * bounds.h / 2;
    const radius = Math.max(2, minSide * (0.95 - 0.6 * gloss) + Math.max(bounds.w, bounds.h) * 0.12 * (1 - gloss));
    const peak   = Math.min(MAX_BRIGHTEN, material.specular * strength);

    if (phase !== 'live' && peak > 0) {
      const sheen = ctx.createRadialGradient(sx, sy, 0, sx, sy, radius);

      sheen.addColorStop(0, css(light.rgb.map((c) => c * peak) as unknown as RGB));
      sheen.addColorStop(0.35 + 0.3 * (1 - gloss), css(light.rgb.map((c) => c * peak * 0.35) as unknown as RGB));
      sheen.addColorStop(1, 'rgba(0, 0, 0, 1)');

      ctx.fillStyle = sheen;
      cover(ctx, bounds);
    }

    if (phase !== 'fixed' && material.rim > 0 && light.raking > 1e-3) {
      const reach = Math.abs(light.dirX) * bounds.w / 2 + Math.abs(light.dirY) * bounds.h / 2 || 1;
      const rim   = ctx.createLinearGradient(cx + light.dirX * reach, cy + light.dirY * reach, cx, cy);
      const level = Math.min(MAX_BRIGHTEN, material.rim * strength * light.raking);

      rim.addColorStop(0, css(light.rgb.map((c) => c * level) as unknown as RGB));
      rim.addColorStop(0.6, 'rgba(0, 0, 0, 1)');
      rim.addColorStop(1, 'rgba(0, 0, 0, 1)');

      // The caller's mask keeps only the inner half of the stroke
      ctx.lineWidth   = 3;
      ctx.lineJoin    = 'round';
      ctx.strokeStyle = rim;
      ctx.stroke(path);
    }
  }
}

// Water

interface Edge {
  x: number;
  y: number;
  nx: number;
  ny: number;
  spread: number;
}

// Soft weights, so a flat edge facing the light holds one steady spot instead of jumping along it
const EDGE_WEIGHT = 12;

// Where the outward normal best faces (dirX, dirY); it slides as the membrane wobbles
function facingEdge (points: ReadonlyArray<{ x: number; y: number }>, bounds: Bounds, dirX: number, dirY: number): Edge {
  const cx = bounds.x + bounds.w / 2;
  const cy = bounds.y + bounds.h / 2;

  // A track hands over only its corners, so its capsule outline stands in
  if (points.length < 8) points = capsule(bounds);

  const n      = points.length;
  const nxs    = new Float64Array(n);
  const nys    = new Float64Array(n);
  const scores = new Float64Array(n).fill(-Infinity);

  let best = -Infinity;

  for (let i = 0; i < n; i++) {
    const p    = points[i]!;
    const prev = points[(i - 1 + n) % n]!;
    const next = points[(i + 1) % n]!;
    const tx   = next.x - prev.x;
    const ty   = next.y - prev.y;
    const len  = Math.hypot(tx, ty);

    if (len < 1e-6) continue;

    let nx = ty / len;
    let ny = -tx / len;

    if (nx * (p.x - cx) + ny * (p.y - cy) < 0) {
      nx = -nx;
      ny = -ny;
    }

    nxs[i]    = nx;
    nys[i]    = ny;
    scores[i] = nx * dirX + ny * dirY;
    best      = Math.max(best, nx * dirX + ny * dirY);
  }

  let sw  = 0;
  let sx  = 0;
  let sy  = 0;
  let snx = 0;
  let sny = 0;

  for (let i = 0; i < n; i++) {
    if (scores[i] === -Infinity) continue;

    const w = Math.exp(EDGE_WEIGHT * (scores[i]! - best));

    sw  += w;
    sx  += points[i]!.x * w;
    sy  += points[i]!.y * w;
    snx += nxs[i]! * w;
    sny += nys[i]! * w;
  }

  if (sw === 0) return { x: cx, y: cy, nx: dirX, ny: dirY, spread: 0 };

  const nl = Math.hypot(snx, sny) || 1;
  const x  = sx / sw;
  const y  = sy / sw;
  const nx = snx / nl;
  const ny = sny / nl;

  // How far the facing stretch runs along the edge: long on a flat side, short on a curve.
  // A sharper weight here, so a faintly facing side doesn't stretch a curve's glint.
  let sv  = 0;
  let svw = 0;

  for (let i = 0; i < n; i++) {
    if (scores[i] === -Infinity) continue;

    const along = (points[i]!.x - x) * -ny + (points[i]!.y - y) * nx;
    const w     = Math.exp(3 * EDGE_WEIGHT * (scores[i]! - best));

    sv  += w * along * along;
    svw += w;
  }

  return { x, y, nx, ny, spread: svw > 0 ? Math.sqrt(sv / svw) : 0 };
}

// Clockwise from the top-left: each straight side, then the quarter turn after it
function capsule (bounds: Bounds): { x: number; y: number }[] {
  const r   = Math.min(bounds.w, bounds.h) / 2;
  const cx  = bounds.x + bounds.w / 2;
  const cy  = bounds.y + bounds.h / 2;
  const hx  = Math.max(0, bounds.w / 2 - r);
  const hy  = Math.max(0, bounds.h / 2 - r);
  const out: { x: number; y: number }[] = [];
  const corners = [[hx, -hy], [hx, hy], [-hx, hy], [-hx, -hy]] as const;

  corners.forEach(([ox, oy], side) => {
    const start = (side - 1) * (Math.PI / 2);
    const [px, py] = corners[(side + 3) % 4]!;

    for (let i = 0; i < 8; i++) {
      const f = i / 8;

      out.push({ x: cx + px + (ox - px) * f + r * Math.cos(start), y: cy + py + (oy - py) * f + r * Math.sin(start) });
    }

    for (let i = 0; i < 8; i++) {
      const a = start + (i / 8) * (Math.PI / 2);

      out.push({ x: cx + ox + r * Math.cos(a), y: cy + oy + r * Math.sin(a) });
    }
  });

  return out;
}

// A soft ellipse, long axis along angle
function glow (ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, rx: number, ry: number, rgb: RGB, falloff: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(Math.max(0.5, rx), Math.max(0.5, ry));

  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);

  gradient.addColorStop(0, css(rgb));
  gradient.addColorStop(falloff, css(rgb.map((c) => c * 0.55) as unknown as RGB));
  gradient.addColorStop(1, 'rgba(0, 0, 0, 1)');

  ctx.fillStyle = gradient;
  ctx.fillRect(-1, -1, 2, 2);
  ctx.restore();
}

// With no strong key, water mirrors the bright sky above it; underwater that's the surface
function waterLights (lights: Incidence[], ambient: RGB | undefined): Incidence[] {
  const shown = lights.slice(0, 2);
  const level = ambient ? luma(ambient) : 0;
  const key   = shown[0] ? shown[0].intensity * (1 - 0.4 * shown[0].softness) : 0;

  if (!ambient || level < 0.05 || key >= level * 0.5) return shown;

  const peak = Math.max(ambient[0], ambient[1], ambient[2]);
  const sky: Incidence = {
    rgb:       ambient.map((c) => c / peak) as unknown as RGB,
    intensity: level * 0.6,
    softness:  0.5,
    dirX:      0,
    dirY:      -1,
    facing:    0.8,
    raking:    0.6,
  };

  return [sky, ...shown].slice(0, 2);
}

// Meniscus, transmission, and glint paint at full strength: lightScale and darkScale don't apply to them
function paintWater (ctx: CanvasRenderingContext2D, bounds: Bounds, lights: Incidence[], material: Readonly<MaterialRecord>, extras: SurfaceExtras | undefined): void {
  const cx      = bounds.x + bounds.w / 2;
  const cy      = bounds.y + bounds.h / 2;
  const minSide = Math.min(bounds.w, bounds.h);
  const points  = extras?.points ?? [];
  const fill    = extras?.fill ?? [1, 1, 1];

  lights.forEach((light, index) => {
    const strength = light.intensity * (1 - 0.4 * light.softness) * (index === 0 ? 1 : 0.5);

    if (strength < 1e-3) return;

    const overhead = light.raking < 0.05;
    const lit      = overhead ? null : facingEdge(points, bounds, light.dirX, light.dirY);
    const far      = overhead ? null : facingEdge(points, bounds, -light.dirX, -light.dirY);

    // A band inward from the lit edge; that edge is the shape's extreme toward the light, so nothing lies past it
    if (material.meniscus > 0 && index === 0 && lit) {
      const depth = material.meniscus * 0.4 * (0.4 + 0.6 * light.raking);
      const band  = Math.max(2, minSide * 0.14);
      const edge  = ctx.createLinearGradient(lit.x, lit.y, lit.x - lit.nx * band, lit.y - lit.ny * band);

      edge.addColorStop(0, css([1 - depth, 1 - depth, 1 - depth]));
      edge.addColorStop(1, 'rgba(255, 255, 255, 1)');

      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = edge;
      cover(ctx, bounds);
    }

    ctx.globalCompositeOperation = 'screen';

    if (material.transmission > 0 && far) {
      const amount = Math.min(0.85, material.transmission * strength * (0.3 + 0.7 * light.raking) * 1.6);
      const tint   = light.rgb.map((c, k) => c * (0.45 + 0.55 * fill[k]!) * amount) as unknown as RGB;
      const inset  = minSide * 0.2;

      glow(ctx, far.x - far.nx * inset, far.y - far.ny * inset, Math.atan2(far.nx, -far.ny), minSide * 0.6, minSide * 0.22, tint, 0.4);
    }

    if (material.glint > 0) {
      const peak = Math.min(1, material.glint * (0.35 + 1.4 * strength));
      const hot  = light.rgb.map((c) => c * peak) as unknown as RGB;
      const size = Math.max(3, minSide * (0.55 - 0.35 * material.sharpness)) * (index === 0 ? 1 : 0.6);

      if (lit) {
        const inset  = Math.max(1.5, minSide * (0.08 + 0.3 * (1 - light.raking)));
        const x      = lit.x - lit.nx * inset;
        const y      = lit.y - lit.ny * inset;
        const angle  = Math.atan2(lit.nx, -lit.ny);
        // A flat stretch facing the main light (a track's top) draws its glint out into a streak
        const length = index === 0 ? Math.max(size, lit.spread * 0.8) : size;

        glow(ctx, x, y, angle, length, size * 0.38, hot, 0.3);
        glow(ctx, x, y, angle, length * 0.4, size * 0.16, hot, 0.5);
      } else {
        glow(ctx, cx, cy - minSide * 0.15, 0, size * 0.6, size * 0.6, hot, 0.3);
      }
    }
  });
}

// Caustics: a tileable loop after joltz0r's water caustic, generated lazily and cached per tint

const CAUSTIC_TILE   = 128;
const CAUSTIC_FRAMES = 16;
const CAUSTIC_CELL   = 340;  // viewport px per tile
const CAUSTIC_RATE   = 5;    // loop frames per second
const CAUSTIC_MAX    = 0.6;
const CAUSTIC_RATES  = [-2, -1, 1, 1, 2];  // whole numbers, so the loop closes at 2π
const CAUSTIC_DEPTH  = Math.PI - 250;      // the original's mean offset, constant so the tile repeats exactly

const baseTiles: (HTMLCanvasElement | null | undefined)[] = [];
const tintedTiles = new Map<string, (HTMLCanvasElement | null | undefined)[]>();
const blendedTiles = new Map<string, { stamp: string; canvas: HTMLCanvasElement | null }>();

function causticAt (u: number, v: number, time: number): number {
  const px = u * 2 * Math.PI - 250;
  const py = v * 2 * Math.PI - 250;

  let ix = px;
  let iy = py;
  let c  = 1;

  for (const rate of CAUSTIC_RATES) {
    const t  = time * rate;
    const nx = px + Math.cos(t - ix) + Math.sin(t + iy);
    const ny = py + Math.sin(t - iy) + Math.cos(t + ix);

    ix = nx;
    iy = ny;
    c += 1 / Math.hypot(CAUSTIC_DEPTH / (Math.sin(ix + t) / 0.005), CAUSTIC_DEPTH / (Math.cos(iy + t) / 0.005));
  }

  c = 1.17 - (c / CAUSTIC_RATES.length) ** 1.4;

  return Math.min(1, Math.abs(c) ** 8);
}

function tileCanvas (doc: Document): [HTMLCanvasElement, CanvasRenderingContext2D | null] {
  const canvas = doc.createElement('canvas');

  canvas.width  = CAUSTIC_TILE;
  canvas.height = CAUSTIC_TILE;

  return [canvas, canvas.getContext('2d')];
}

function baseTile (doc: Document, index: number): HTMLCanvasElement | null {
  const cached = baseTiles[index];

  if (cached !== undefined) return cached;

  const [canvas, c] = tileCanvas(doc);

  if (!c) return (baseTiles[index] = null);

  const image = c.createImageData(CAUSTIC_TILE, CAUSTIC_TILE);
  const time  = (index / CAUSTIC_FRAMES) * 2 * Math.PI;

  for (let y = 0; y < CAUSTIC_TILE; y++) {
    for (let x = 0; x < CAUSTIC_TILE; x++) {
      const value = Math.round(255 * causticAt(x / CAUSTIC_TILE, y / CAUSTIC_TILE, time));
      const i     = (y * CAUSTIC_TILE + x) * 4;

      image.data[i]     = value;
      image.data[i + 1] = value;
      image.data[i + 2] = value;
      image.data[i + 3] = 255;
    }
  }

  c.putImageData(image, 0, 0);

  return (baseTiles[index] = canvas);
}

function causticTile (doc: Document, index: number, rgb: RGB): HTMLCanvasElement | null {
  const steps = rgb.map((c) => Math.round(c * 16));
  const key   = steps.join(',');

  let set = tintedTiles.get(key);

  if (!set) {
    if (tintedTiles.size >= 4) tintedTiles.delete(tintedTiles.keys().next().value!);

    set = [];
    tintedTiles.set(key, set);
  }

  const cached = set[index];

  if (cached !== undefined) return cached;

  const base        = baseTile(doc, index);
  const [canvas, c] = tileCanvas(doc);

  if (!base || !c) return (set[index] = null);

  c.drawImage(base, 0, 0);
  c.globalCompositeOperation = 'multiply';
  c.fillStyle = css(steps.map((s) => s / 16) as unknown as RGB);
  c.fillRect(0, 0, CAUSTIC_TILE, CAUSTIC_TILE);

  return (set[index] = canvas);
}

// Two neighboring loop frames mixed in the tile itself, so one screen pass keeps the brightness exact;
// every control in a frame shares the mix
function blendedTile (doc: Document, first: number, second: number, mix: number, rgb: RGB): HTMLCanvasElement | null {
  const tint  = rgb.map((c) => Math.round(c * 16)).join(',');
  const stamp = `${first}:${Math.round(mix * 32)}`;
  const entry = blendedTiles.get(tint);

  if (entry?.stamp === stamp) return entry.canvas;

  const a = causticTile(doc, first, rgb);
  const b = causticTile(doc, second, rgb);
  const canvas = entry?.canvas ?? tileCanvas(doc)[0];
  const c      = canvas.getContext('2d');

  if (!a || !b || !c) return null;

  c.globalAlpha = 1;
  c.drawImage(a, 0, 0);
  c.globalAlpha = Math.round(mix * 32) / 32;
  c.drawImage(b, 0, 0);

  if (blendedTiles.size >= 4 && !entry) blendedTiles.delete(blendedTiles.keys().next().value!);

  blendedTiles.set(tint, { stamp, canvas });

  return canvas;
}

function paintCaustics (ctx: CanvasRenderingContext2D, bounds: Bounds, extras: SurfaceExtras, lightScale: number): void {
  const doc = 'ownerDocument' in ctx.canvas ? ctx.canvas.ownerDocument : null;

  if (!doc || typeof DOMMatrix === 'undefined') return;

  const phase  = extras.time * CAUSTIC_RATE;
  const first  = Math.floor(phase) % CAUSTIC_FRAMES;
  const second = (first + 1) % CAUSTIC_FRAMES;
  const mix    = phase - Math.floor(phase);
  const matrix = extras.toViewport.inverse().translateSelf(extras.time * 6, extras.time * 3.5).scaleSelf(CAUSTIC_CELL / CAUSTIC_TILE);
  const alpha  = ctx.globalAlpha;

  if (![matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f].every(Number.isFinite)) return;

  ctx.globalCompositeOperation = 'screen';

  for (const caustic of extras.caustics) {
    const amount = Math.min(CAUSTIC_MAX, caustic.amount * CAUSTIC_MAX) * lightScale;

    if (amount < 0.01) continue;

    const tile    = blendedTile(doc, first, second, mix, caustic.rgb);
    const pattern = tile ? ctx.createPattern(tile, 'repeat') : null;

    if (!pattern) continue;

    pattern.setTransform(matrix);
    ctx.globalAlpha = alpha * amount;
    ctx.fillStyle   = pattern;
    ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
  }

  ctx.globalAlpha = alpha;
}

// A region's feather as alpha along its finite edges, painted with destination-in
export function maskRegion (ctx: CanvasRenderingContext2D, region: { top: number; right: number; bottom: number; left: number; feather: number }, width: number, height: number): void {
  const f = Math.max(0.5, region.feather);

  ctx.globalCompositeOperation = 'destination-in';

  const edge = (x0: number, y0: number, x1: number, y1: number): void => {
    const gradient = ctx.createLinearGradient(x0, y0, x1, y1);

    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 1)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  };

  if (Number.isFinite(region.top))    edge(0, region.top - f, 0, region.top + f);
  if (Number.isFinite(region.bottom)) edge(0, region.bottom + f, 0, region.bottom - f);
  if (Number.isFinite(region.left))   edge(region.left - f, 0, region.left + f, 0);
  if (Number.isFinite(region.right))  edge(region.right + f, 0, region.right - f, 0);

  ctx.globalCompositeOperation = 'source-over';
}
