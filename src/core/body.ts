/*
 * The Jelly UI soft-body membrane simulation: geometry + math helpers, the
 * rounded-rectangle membrane builder, and the JellyBody class that wobbles a
 * shape in pure local coordinates. The DOM layer (element) feeds it pointer
 * input and reads back the deformed surface to paint.
 */

import { clamp }            from '../utilities/index.js';
import { integrateSpring }  from '../utilities/index.js';
import { DEFAULT_CONFIG }   from './config.js';
import type { JellyConfig } from './config.js';

// A 2D point; membrane points, surface points and projected points all have x/y
export interface Point {
  x: number;
  y: number;
}

// A unit outward normal
interface Normal {
  nx: number;
  ny: number;
}

// One membrane sample: rest position, normal, radial (d) and depth (z) offsets
export interface MembranePoint {
  x: number;
  y: number;
  nx: number;
  ny: number;
  d: number;   // outward displacement along the normal
  v: number;   // displacement velocity
  z: number;   // depth displacement (toward / away from the viewer)
  zv: number;  // depth velocity
}

// A deformed, pre-projection surface point
export interface SurfacePoint {
  x: number;
  y: number;
  z: number;
}

// The whole-body spring state (press depth, tilt, rotation, pointer tracking)
interface JellyState {
  clickDepth: number;
  clickDepthV: number;
  targetClickDepth: number;

  insidePress: number;
  insidePressV: number;
  targetInsidePress: number;

  press: number;
  pressV: number;
  targetPress: number;

  insideCurveHold: number;
  insideCurveHoldV: number;
  targetInsideCurveHold: number;

  rotateZ: number;
  rotateZV: number;

  tiltX: number;
  tiltXV: number;
  tiltY: number;
  tiltYV: number;
  targetTiltX: number;
  targetTiltY: number;

  pointerActive: boolean;
  pointerInsideWeight: number;
  pointerIndex: number;
  pointerLocalX: number;
  pointerLocalY: number;
}

// Options for constructing a JellyBody
export interface JellyBodyOptions {
  width: number;
  height: number;
  radius?: number;
  config?: Partial<JellyConfig>;
}

/*
 * The membrane couples neighboring points, which makes explicit Euler
 * integration stiff: one big frame delta (a background tab waking up, a
 * long GC pause, a 30Hz mobile display) could inject energy instead of
 * settling. Integrating in substeps no longer than this keeps the
 * simulation stable and identical in feel at any frame rate. The cap sits
 * just above the 60Hz frame delta the physics was tuned at, so a 60fps
 * frame still integrates in a single step (no added cost) while slower
 * frames are subdivided back to the tuned regime.
 */
const MAX_STEP = 1 / 58;

/* ------------------------------------------------------------------ *
 * Math helpers
 * ------------------------------------------------------------------ */

// Hermite smoothstep: 0 below edge0, 1 above edge1, eased in between
function smoothstep (edge0: number, edge1: number, value: number): number {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);

  return t * t * (3 - 2 * t);
}

// Wrap an index onto the ring
function wrap (index: number, length: number): number {
  return (index + length) % length;
}

// Shortest distance between two ring indices
function ringDistance (a: number, b: number, length: number): number {
  const distance = Math.abs(a - b);

  return Math.min(distance, length - distance);
}

// Bell falloff used to spread an impulse across neighboring points
function gaussian (distance: number, width: number): number {
  return Math.exp(-(distance * distance) / (2 * width * width));
}

/*
 * Signed distance for a rounded rectangle (capsule / circle fall out of
 * this for free). Positive outside, negative inside.
 */
function roundedRectSDF (x: number, y: number, halfW: number, halfH: number, radius: number): number {
  const r  = Math.min(radius, halfW, halfH);
  const qx = Math.abs(x) - (halfW - r);
  const qy = Math.abs(y) - (halfH - r);

  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  const inside  = Math.min(Math.max(qx, qy), 0);

  return outside + inside - r;
}

/* ------------------------------------------------------------------ *
 * Membrane construction
 * ------------------------------------------------------------------ */

/*
 * Build a uniformly-sampled ring of membrane points around a rounded
 * rectangle. radius == min(w, h) / 2 gives a capsule; a square with that
 * radius gives a circle.
 */
function createRoundedRectMembrane (width: number, height: number, radius: number, targetSamples: number, blendPasses: number): MembranePoint[] {
  const halfW = width / 2;
  const halfH = height / 2;
  const r     = Math.min(radius, halfW, halfH);

  const dense: Point[] = [];
  const push = (x: number, y: number): void => { dense.push({ x, y }); };

  const edgeSteps = 48;
  const arcSteps  = 48;

  function line (ax: number, ay: number, bx: number, by: number, includeStart: boolean): void {
    for (let i = includeStart ? 0 : 1; i <= edgeSteps; i++) {
      const t = i / edgeSteps;
      push(ax + (bx - ax) * t, ay + (by - ay) * t);
    }
  }

  function arc (cx: number, cy: number, a0: number, a1: number): void {
    for (let i = 1; i <= arcSteps; i++) {
      const a = a0 + (a1 - a0) * (i / arcSteps);
      push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
  }

  // Trace the outline clockwise from the top edge
  line(-halfW + r, -halfH, halfW - r, -halfH, true);
  arc(halfW - r, -halfH + r, -Math.PI / 2, 0);
  line(halfW, -halfH + r, halfW, halfH - r, false);
  arc(halfW - r, halfH - r, 0, Math.PI / 2);
  line(halfW - r, halfH, -halfW + r, halfH, false);
  arc(-halfW + r, halfH - r, Math.PI / 2, Math.PI);
  line(-halfW, halfH - r, -halfW, -halfH + r, false);
  arc(-halfW + r, -halfH + r, Math.PI, Math.PI * 1.5);

  // Cumulative arc length so we can resample at even spacing
  const cumulative: number[] = [0];
  let   perimeter = 0;

  for (let i = 0; i < dense.length; i++) {
    const a = dense[i]!;
    const b = dense[wrap(i + 1, dense.length)]!;

    perimeter += Math.hypot(b.x - a.x, b.y - a.y);
    cumulative.push(perimeter);
  }

  const points: MembranePoint[] = [];
  const sampleCount = Number.isFinite(targetSamples)
    ? Math.max(4, Math.ceil(targetSamples))
    : DEFAULT_CONFIG.samples;

  for (let s = 0; s < sampleCount; s++) {
    const targetDistance = (s / sampleCount) * perimeter;

    let segmentIndex = 0;
    while (segmentIndex < dense.length - 1 && cumulative[segmentIndex + 1]! < targetDistance) {
      segmentIndex += 1;
    }

    const a = dense[segmentIndex]!;
    const b = dense[(segmentIndex + 1) % dense.length]!;

    const segmentStart  = cumulative[segmentIndex]!;
    const segmentEnd    = cumulative[segmentIndex + 1]!;
    const segmentLength = Math.max(segmentEnd - segmentStart, 0.0001);
    const t             = (targetDistance - segmentStart) / segmentLength;

    points.push({
      x:  a.x + (b.x - a.x) * t,
      y:  a.y + (b.y - a.y) * t,
      nx: 0,
      ny: 0,
      d:  0,
      v:  0,
      z:  0,
      zv: 0,
    });
  }

  softenNormals(points, blendPasses);

  return points;
}

// Outward normal estimated from a point's ring neighbors
function outwardNormalFromNeighbors (points: MembranePoint[], index: number): Normal {
  const length   = points.length;
  const previous = points[wrap(index - 1, length)]!;
  const next     = points[wrap(index + 1, length)]!;

  const tx           = next.x - previous.x;
  const ty           = next.y - previous.y;
  const normalLength = Math.hypot(ty, -tx) || 1;

  return { nx: ty / normalLength, ny: -tx / normalLength };
}

// Safety bound from the resolver contract: 0–6 whole passes, non-finite falls back
function clampBlendPasses (passes: number): number {
  return Number.isFinite(passes)
    ? Math.round(clamp(passes, 0, 6))
    : DEFAULT_CONFIG.normalBlendPasses;
}

// Blend each normal with its neighbors so corners deform smoothly
function softenNormals (points: MembranePoint[], passes: number): void {
  const length = points.length;

  let normals: Normal[] = points.map((_, index) => outwardNormalFromNeighbors(points, index));

  for (let pass = 0; pass < passes; pass++) {
    normals = normals.map((normal, index) => {
      const previous = normals[wrap(index - 1, length)]!;
      const next     = normals[wrap(index + 1, length)]!;

      const nx           = previous.nx * 0.22 + normal.nx * 0.56 + next.nx * 0.22;
      const ny           = previous.ny * 0.22 + normal.ny * 0.56 + next.ny * 0.22;
      const normalLength = Math.hypot(nx, ny) || 1;

      return { nx: nx / normalLength, ny: ny / normalLength };
    });
  }

  for (let i = 0; i < length; i++) {
    points[i]!.nx = normals[i]!.nx;
    points[i]!.ny = normals[i]!.ny;
  }
}

// Shoelace area of the ring, used for the volume-preserving pressure term
function polygonArea (points: readonly Point[]): number {
  let area = 0;

  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[wrap(i + 1, points.length)]!;

    area += a.x * b.y - b.x * a.y;
  }

  return Math.abs(area) * 0.5;
}

/*
 * Trace a closed Catmull-Rom spline (as cubic beziers) through the points.
 * The caller controls fill / stroke.
 */
export function traceSmoothPath (ctx: CanvasRenderingContext2D, points: readonly Point[], tension = DEFAULT_CONFIG.curveTension): void {
  const length = points.length;

  ctx.beginPath();

  if (!length) {
    return;
  }

  ctx.moveTo(points[0]!.x, points[0]!.y);

  for (let i = 0; i < length; i++) {
    const p0 = points[wrap(i - 1, length)]!;
    const p1 = points[i]!;
    const p2 = points[wrap(i + 1, length)]!;
    const p3 = points[wrap(i + 2, length)]!;

    const cp1x = p1.x + ((p2.x - p0.x) * tension) / 6;
    const cp1y = p1.y + ((p2.y - p0.y) * tension) / 6;
    const cp2x = p2.x - ((p3.x - p1.x) * tension) / 6;
    const cp2y = p2.y - ((p3.y - p1.y) * tension) / 6;

    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
  }

  ctx.closePath();
}

/* ------------------------------------------------------------------ *
 * JellyBody - one soft-body blob. Pure physics in local coordinates.
 * ------------------------------------------------------------------ */
export class JellyBody {

  width: number;
  height: number;
  radius: number;
  config: JellyConfig;
  lean: number;
  leanAmount: number;
  membrane: MembranePoint[];
  state: JellyState;
  baseArea: number;

  constructor ({ width, height, radius, config }: JellyBodyOptions) {
    this.width  = width;
    this.height = height;
    this.radius = radius ?? Math.min(width, height) / 2;
    this.config = { ...DEFAULT_CONFIG, ...(config ?? {}) };
    this.config.normalBlendPasses = clampBlendPasses(this.config.normalBlendPasses);

    // Sustained sideways bias: lean in [-1, 1] shifts the body's "mass" to
    // one end (that side bulges out, the other tucks in). leanAmount is the
    // pixel depth; 0 means no lean (the resting default). Used by the sliding
    // controls - switch thumb, segmented pill, slider / range thumbs, progress.
    this.lean       = 0;
    this.leanAmount = 0;

    this.membrane = createRoundedRectMembrane(width, height, this.radius, this.config.samples, this.config.normalBlendPasses);

    this.state = {
      clickDepth:            0,
      clickDepthV:           0,
      targetClickDepth:      0,

      insidePress:           0,
      insidePressV:          0,
      targetInsidePress:     0,

      press:                 0,
      pressV:                0,
      targetPress:           0,

      insideCurveHold:       0,
      insideCurveHoldV:      0,
      targetInsideCurveHold: 0,

      rotateZ:               0,
      rotateZV:              0,

      tiltX:                 0,
      tiltXV:                0,
      tiltY:                 0,
      tiltYV:                0,
      targetTiltX:           0,
      targetTiltY:           0,

      pointerActive:         false,
      pointerInsideWeight:   0,
      pointerIndex:          0,
      pointerLocalX:         0,
      pointerLocalY:         0,
    };

    this.baseArea = polygonArea(this.getSurfacePoints());
  }

  // Rebuild the ring for a new size, preserving no motion (used on resize)
  resize (width: number, height: number, radius?: number): void {
    this.width  = width;
    this.height = height;
    this.radius = radius ?? Math.min(width, height) / 2;

    // config is publicly mutable, so re-bound the pass count instead of trusting it
    this.config.normalBlendPasses = clampBlendPasses(this.config.normalBlendPasses);

    this.membrane = createRoundedRectMembrane(width, height, this.radius, this.config.samples, this.config.normalBlendPasses);
    this.baseArea = polygonArea(this.getSurfacePoints());
  }

  // Signed distance from a local point to the resting surface
  sdf (x: number, y: number): number {
    return roundedRectSDF(x, y, this.width / 2, this.height / 2, this.radius);
  }

  // Index of the membrane point closest to a local coordinate
  nearestMembraneIndex (x: number, y: number): number {
    let nearest         = 0;
    let nearestDistance = Infinity;

    for (let i = 0; i < this.membrane.length; i++) {
      const p        = this.membrane[i]!;
      const dx       = x - p.x;
      const dy       = y - p.y;
      const distance = dx * dx + dy * dy;

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest         = i;
      }
    }

    return nearest;
  }

  // Kick the membrane outward around a ring index with a gaussian falloff
  addMembraneImpulse (index: number, amount: number, width: number): void {
    const length = this.membrane.length;

    for (let i = 0; i < length; i++) {
      const distance = ringDistance(i, index, length);
      this.membrane[i]!.v += amount * gaussian(distance, width);
    }
  }

  // Kick the membrane's depth (z) around a ring index with a gaussian falloff
  addDepthImpulse (index: number, amount: number, width: number): void {
    const length = this.membrane.length;

    for (let i = 0; i < length; i++) {
      const distance = ringDistance(i, index, length);
      this.membrane[i]!.zv += amount * gaussian(distance, width);
    }
  }

  // Bulge the membrane around the pointer with a softer counter-halo
  addInsidePointImpulse (amount: number): void {
    for (let i = 0; i < this.membrane.length; i++) {
      const influence = this.insidePointInfluence(i);
      this.membrane[i]!.v += amount * (influence.local - influence.halo * 0.18);
    }
  }

  // Five-tap smoothing of one membrane channel around an index
  smoothedMembraneValue (index: number, key: 'd' | 'z'): number {
    const length = this.membrane.length;

    const p0 = this.membrane[wrap(index - 2, length)]![key];
    const p1 = this.membrane[wrap(index - 1, length)]![key];
    const p2 = this.membrane[index]![key];
    const p3 = this.membrane[wrap(index + 1, length)]![key];
    const p4 = this.membrane[wrap(index + 2, length)]![key];

    return p0 * 0.06 + p1 * 0.2 + p2 * 0.48 + p3 * 0.2 + p4 * 0.06;
  }

  // How strongly the pointer's held position affects one membrane point
  insidePointInfluence (index: number): { local: number; halo: number } {
    const point = this.membrane[index]!;

    const dx                = point.x - this.state.pointerLocalX;
    const dy                = point.y - this.state.pointerLocalY;
    const distanceFromClick = Math.hypot(dx, dy);

    const local = gaussian(distanceFromClick, this.config.insidePointInfluenceWidth);
    const halo  = gaussian(distanceFromClick, this.config.insidePointHaloWidth);

    const pointerRadius = clamp(
      Math.hypot(
        this.state.pointerLocalX / (this.width / 2),
        this.state.pointerLocalY / (this.height / 2),
      ),
      0,
      1,
    );

    const edgeBoost = 1 + smoothstep(0.12, 0.82, pointerRadius) * this.config.insidePointEdgeBoost;

    return {
      local: local * edgeBoost,
      halo:  Math.max(halo - local * 0.34, 0),
    };
  }

  // Sustained bulge / depth offsets while the pointer is held inside
  heldMembraneOffsets (index: number): { d: number; z: number } {
    const insidePoint = this.insidePointInfluence(index);

    return {
      d: this.state.insideCurveHold *
         (this.config.insideHeldBulgeAmount * insidePoint.local -
          this.config.insideHeldHaloAmount * insidePoint.halo),
      z: -this.state.insideCurveHold *
         this.config.insideHeldDepthAmount *
         insidePoint.local,
    };
  }

  // Five-tap smoothing over a plain array of ring values
  smoothArrayValue (values: number[], index: number): number {
    const length = values.length;

    return (
      values[wrap(index - 2, length)]! * 0.06 +
      values[wrap(index - 1, length)]! * 0.2 +
      values[index]! * 0.48 +
      values[wrap(index + 1, length)]! * 0.2 +
      values[wrap(index + 2, length)]! * 0.06
    );
  }

  /*
   * The current deformed surface. `offset` pushes every point outward along
   * its normal - used to trace a focus ring that follows the same jiggle.
   */
  getSurfacePoints (offset = 0): SurfacePoint[] {
    const points: SurfacePoint[] = [];
    const length = this.membrane.length;
    const totalD: number[] = new Array(length);
    const totalZ: number[] = new Array(length);

    for (let i = 0; i < length; i++) {
      const held = this.heldMembraneOffsets(i);

      totalD[i] = this.smoothedMembraneValue(i, 'd') + held.d;
      totalZ[i] = this.smoothedMembraneValue(i, 'z') + held.z;
    }

    for (let i = 0; i < length; i++) {
      const p = this.membrane[i]!;

      const smoothedD = this.smoothArrayValue(totalD, i);
      const smoothedZ = this.smoothArrayValue(totalZ, i);

      const prevD    = this.smoothArrayValue(totalD, wrap(i - 1, length));
      const nextD    = this.smoothArrayValue(totalD, wrap(i + 1, length));
      const gradient = nextD - prevD;

      const tx           = -p.ny;
      const ty           = p.nx;
      const tangentSlide = gradient * 0.05;

      // Lean bias: push the leading end out and tuck the trailing end in,
      // antisymmetric in x so the area stays roughly constant
      const leanBias = this.leanAmount === 0
        ? 0
        : this.lean * clamp(p.x / (this.width / 2), -1, 1) * this.leanAmount;

      const x = p.x + p.nx * (smoothedD + offset + leanBias) + tx * tangentSlide;
      const y = p.y + p.ny * (smoothedD + offset + leanBias) + ty * tangentSlide;

      const xNorm = clamp(x / (this.width / 2), -1, 1);
      const yNorm = clamp(y / (this.height / 2), -1, 1);

      const planeDepth = -(xNorm * this.state.tiltY + yNorm * this.state.tiltX) * this.config.axisDepth;

      points.push({ x, y, z: planeDepth + smoothedZ });
    }

    return points;
  }

  // Apply the perspective projection to one surface point
  projectPoint (point: SurfacePoint): SurfacePoint {
    const perspective = this.config.perspective / (this.config.perspective - point.z);

    return { x: point.x * perspective, y: point.y * perspective, z: point.z };
  }

  // Aim the held-press springs at the pointer's current position
  updatePressTargets (localX: number, localY: number, influence = 1): { insideWeight: number } {
    this.state.pointerLocalX = localX;
    this.state.pointerLocalY = localY;

    const signedDistance = this.sdf(localX, localY);
    const insideWeight   = (1 - smoothstep(-2, 5, signedDistance)) * influence;

    this.state.pointerInsideWeight   = insideWeight;
    this.state.targetClickDepth      = insideWeight;
    this.state.targetInsidePress     = insideWeight;
    this.state.targetPress           = insideWeight * this.config.holdPressAmount;
    this.state.targetInsideCurveHold = insideWeight;

    return { insideWeight };
  }

  // Press at a point already in local (shape-centered) coordinates
  pressAtLocal (localX: number, localY: number, strength = 1, influence = 1): void {
    const index = this.nearestMembraneIndex(localX, localY);

    this.state.pointerIndex  = index;
    this.state.pointerActive = true;

    const { insideWeight } = this.updatePressTargets(localX, localY, influence);
    const force            = strength * 1.15 * influence;

    if (insideWeight > 0.01) {
      this.addInsidePointImpulse(this.config.insideLocalBulgeImpulse * insideWeight * force);
      this.state.pressV += 1.9 * insideWeight * force;
    }
  }

  // Follow the pointer while it is held down
  moveToLocal (localX: number, localY: number, influence = 1): void {
    this.state.pointerIndex = this.nearestMembraneIndex(localX, localY);
    this.updatePressTargets(localX, localY, influence);
  }

  // A press whose energy comes from the shape center (keyboard activation)
  centerPulse (strength = 1): void {
    // Use the same radial inside-press calculation as a pointer at the exact
    // center. Picking one "nearest" membrane sample is ambiguous for a
    // symmetric shape and makes keyboard presses bulge toward that one side.
    this.pressAtLocal(0, 0, strength);
  }

  /*
   * A one-shot squish from the center that settles on its own - for feedback
   * that isn't a sustained press (focus, toggle, grab). Unlike centerPulse it
   * sets no held target, so the body returns to rest and can sleep.
   */
  centerPop (strength = 1): void {
    this.state.pointerLocalX = 0;
    this.state.pointerLocalY = 0;

    // A radial inside impulse stays balanced across both axes. A localized
    // impulse at the membrane sample nearest (0, 0) arbitrarily favors one
    // edge of a symmetric shape, just like the old keyboard press did.
    this.addInsidePointImpulse(this.config.insideLocalBulgeImpulse * 0.5 * strength);

    this.state.pressV += 0.9 * strength;
  }

  /*
   * A one-shot directional jiggle along an axis: the leading edge (normals
   * aligned with the direction) bulges out and the trailing edge tucks in, so
   * the blob stretches the way it's thrown. Used by the sliding controls and
   * jelly-alert's shake.
   */
  stretchAlong (dirX: number, dirY: number, strength = 1): void {
    const length = Math.hypot(dirX, dirY) || 1;
    const dx     = dirX / length;
    const dy     = dirY / length;
    const amount = this.config.insideLocalBulgeImpulse * 0.42 * strength;

    for (const p of this.membrane) {
      const align = p.nx * dx + p.ny * dy;
      p.v += amount * align;
    }
  }

  // A one-shot ripple with no hold (typing feedback, toggles, etc.)
  pulseAt (localX: number, localY: number, strength = 1): void {
    const index = this.nearestMembraneIndex(localX, localY);

    this.state.pointerLocalX = localX;
    this.state.pointerLocalY = localY;

    this.addMembraneImpulse(
      index,
      this.config.insideLocalBulgeImpulse * 0.5 * strength,
      this.config.rippleWidth * 1.6,
    );
  }

  // Let go: clear every held target and give a small parting kick
  release (): void {
    this.state.pointerActive         = false;
    this.state.targetClickDepth      = 0;
    this.state.targetInsidePress     = 0;
    this.state.targetPress           = 0;
    this.state.targetInsideCurveHold = 0;
    this.state.targetTiltX           = 0;
    this.state.targetTiltY           = 0;
    this.state.pointerInsideWeight   = 0;

    this.state.pressV -= 0.55;
  }

  // Advance the whole-body springs (press depth, tilt, rotation) one step
  updateGlobal (dt: number): void {
    const s = this.state;
    const c = this.config;

    [s.clickDepth, s.clickDepthV] = integrateSpring(
      s.clickDepth, s.clickDepthV, s.targetClickDepth,
      c.clickDepthSpring, c.clickDepthDamping, dt);

    [s.insidePress, s.insidePressV] = integrateSpring(
      s.insidePress, s.insidePressV, s.targetInsidePress,
      c.insidePressSpring, c.insidePressDamping, dt);

    [s.press, s.pressV] = integrateSpring(
      s.press, s.pressV, s.targetPress,
      c.pressSpring, c.pressDamping, dt);

    [s.insideCurveHold, s.insideCurveHoldV] = integrateSpring(
      s.insideCurveHold, s.insideCurveHoldV, s.targetInsideCurveHold,
      c.heldCurveSpring, c.heldCurveDamping, dt);

    // rotateZ springs back toward zero (no target of its own)
    [s.rotateZ, s.rotateZV] = integrateSpring(
      s.rotateZ, s.rotateZV, 0, c.zRotateSpring, c.zRotateDamping, dt);

    [s.tiltX, s.tiltXV] = integrateSpring(
      s.tiltX, s.tiltXV, s.targetTiltX, c.axisSpring, c.axisDamping, dt);
    [s.tiltY, s.tiltYV] = integrateSpring(
      s.tiltY, s.tiltYV, s.targetTiltY, c.axisSpring, c.axisDamping, dt);

    s.clickDepth      = clamp(s.clickDepth, 0, 1);
    s.insidePress     = clamp(s.insidePress, 0, 1);
    s.press           = clamp(s.press, -0.025, 0.085);
    s.insideCurveHold = clamp(s.insideCurveHold, 0, 1);
    s.rotateZ         = clamp(s.rotateZ, -0.018, 0.018);
    s.tiltX           = clamp(s.tiltX, -1, 1);
    s.tiltY           = clamp(s.tiltY, -1, 1);
  }

  // Advance the membrane wave equation one step
  updateMembrane (dt: number): void {
    const length = this.membrane.length;
    const c      = this.config;

    const points    = this.getSurfacePoints();
    const area      = polygonArea(points);
    const areaError = clamp((this.baseArea - area) / this.baseArea, -0.08, 0.08);

    const membraneAccel: number[] = new Array(length);
    const depthAccel: number[]    = new Array(length);

    for (let i = 0; i < length; i++) {
      const p    = this.membrane[i]!;
      const prev = this.membrane[wrap(i - 1, length)]!;
      const next = this.membrane[wrap(i + 1, length)]!;

      const membraneLap = prev.d + next.d - 2 * p.d;
      const depthLap    = prev.z + next.z - 2 * p.z;

      membraneAccel[i] =
        -p.d * c.membraneSpring +
        membraneLap * c.waveCoupling -
        p.v * c.membraneDamping +
        areaError * c.pressure;

      depthAccel[i] =
        -p.z * c.depthSpring +
        depthLap * c.depthCoupling -
        p.zv * c.depthDamping;
    }

    if (this.state.pointerActive && this.state.pointerInsideWeight > 0.02) {
      for (let i = 0; i < length; i++) {
        const influence = this.insidePointInfluence(i);

        membraneAccel[i]! += c.insideLocalHoldBulgeForce * influence.local * this.state.pointerInsideWeight;
        membraneAccel[i]! -= c.insideLocalHoldBulgeForce * 0.18 * influence.halo * this.state.pointerInsideWeight;
      }
    }

    for (let i = 0; i < length; i++) {
      const p = this.membrane[i]!;

      p.v  += membraneAccel[i]! * dt;
      p.d  += p.v * dt;
      p.zv += depthAccel[i]! * dt;
      p.z  += p.zv * dt;

      p.d  = clamp(p.d, -c.maxDent, c.maxBulge);
      p.v  = clamp(p.v, -410, 410);
      p.z  = clamp(p.z, c.maxDepthIn, c.maxDepthOut);
      p.zv = clamp(p.zv, -600, 600);
    }

    // Volume correction: bleed off any net inflation so the blob keeps its size
    let average = 0;
    for (const p of this.membrane) {
      average += p.d;
    }
    average /= length;
    for (const p of this.membrane) {
      p.d -= average * c.volumeCorrection;
    }
  }

  /*
   * Advance the simulation by a frame delta. The delta is split into
   * substeps no longer than MAX_STEP so the integration stays stable on
   * slow frames, low-Hz displays and after background-tab pauses.
   */
  update (dt: number): void {
    const steps = Math.max(1, Math.ceil(dt / MAX_STEP));
    const h     = dt / steps;

    for (let i = 0; i < steps; i++) {
      this.updateGlobal(h);
      this.updateMembrane(h);
    }

    this.recoverIfUnstable();
  }

  /*
   * Defensive backstop: if anything ever produced a non-finite number
   * (a zero-sized rebuild, an extreme external mutation), reset all motion
   * instead of painting garbage forever. The clamps make this near
   * impossible, but a physics toy should never be able to wedge the UI.
   */
  recoverIfUnstable (): void {
    const s = this.state;

    let healthy = Number.isFinite(s.press) && Number.isFinite(s.clickDepth) && Number.isFinite(s.rotateZ);

    if (healthy) {
      for (const p of this.membrane) {
        if (!Number.isFinite(p.d) || !Number.isFinite(p.v) || !Number.isFinite(p.z) || !Number.isFinite(p.zv)) {
          healthy = false;
          break;
        }
      }
    }

    if (healthy) {
      return;
    }

    for (const p of this.membrane) {
      p.d  = 0;
      p.v  = 0;
      p.z  = 0;
      p.zv = 0;
    }

    s.clickDepth      = 0; s.clickDepthV      = 0;
    s.insidePress     = 0; s.insidePressV     = 0;
    s.press           = 0; s.pressV           = 0;
    s.insideCurveHold = 0; s.insideCurveHoldV = 0;
    s.rotateZ         = 0; s.rotateZV         = 0;
    s.tiltX           = 0; s.tiltXV           = 0;
    s.tiltY           = 0; s.tiltYV           = 0;
  }

  // True when the body has essentially stopped moving and nothing is held
  isResting (): boolean {
    const s = this.state;

    if (s.pointerActive) {
      return false;
    }

    if (
      Math.abs(s.clickDepth) > 1e-3 ||
      Math.abs(s.insidePress) > 1e-3 ||
      Math.abs(s.insideCurveHold) > 1e-3 ||
      Math.abs(s.rotateZ) > 1e-4 ||
      Math.abs(s.tiltX) > 1e-3 ||
      Math.abs(s.tiltY) > 1e-3
    ) {
      return false;
    }

    for (const p of this.membrane) {
      if (Math.abs(p.d) > 0.03 || Math.abs(p.v) > 0.05 || Math.abs(p.z) > 0.03 || Math.abs(p.zv) > 0.05) {
        return false;
      }
    }

    return true;
  }

}
