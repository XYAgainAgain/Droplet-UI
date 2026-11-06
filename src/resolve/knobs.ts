// Six 0–1 dials, each scaling one family of the physics record; 0.5 leaves it as set.
// Damping re-solves from the ratio when stiffness moves, so viscosity never changes bounce.

import type { DropletConfig } from '../core/index.js';

export type Knob = 'softness' | 'bounce' | 'viscosity' | 'spread' | 'depth' | 'intensity';

export const KNOBS: readonly Knob[] = ['softness', 'bounce', 'viscosity', 'spread', 'depth', 'intensity'];

export type Knobs = Partial<Record<Knob, number>>;

type Key = keyof DropletConfig;

const AMPLITUDE: readonly Key[] = [
  'insideLocalBulgeImpulse', 'insideLocalHoldBulgeForce', 'insideHeldBulgeAmount', 'insideHeldHaloAmount',
  'outsideHeldDentAmount', 'outsideHeldSideBulgeAmount', 'outsideDentImpulse', 'outsideSideBulgeImpulse',
  'outsideOppositeBulgeImpulse', 'outsideHoldForce', 'maxDent', 'maxBulge',
];

const SPRINGS: ReadonlyArray<readonly [spring: Key, damping: Key]> = [
  ['membraneSpring', 'membraneDamping'],
  ['pressSpring', 'pressDamping'],
  ['insidePressSpring', 'insidePressDamping'],
  ['clickDepthSpring', 'clickDepthDamping'],
  ['heldCurveSpring', 'heldCurveDamping'],
  ['axisSpring', 'axisDamping'],
  ['depthSpring', 'depthDamping'],
  ['zRotateSpring', 'zRotateDamping'],
];

const SPREAD: readonly Key[] = ['waveCoupling'];
const SPREAD_WIDTHS: readonly Key[] = ['rippleWidth', 'insidePointInfluenceWidth', 'insidePointHaloWidth'];

const DEPTH: readonly Key[] = [
  'axisDepth', 'depthImpulse', 'depthBulgeImpulse', 'maxDepthIn', 'maxDepthOut', 'holdPressAmount',
  'insideHeldDepthAmount', 'outsideHeldDepthAmount', 'outsideHoldDepthForce', 'zRotateImpulse',
];

// Below this damping ratio the integrator rings for seconds; above it, motion goes dead
const MIN_RATIO = 0.18;
const MAX_RATIO = 1.6;

// Where a 1/30 s frame still integrates stably (measured by the sweep tests)
const MAX_SPRING = 420;
const MIN_SPRING = 12;
const MAX_COUPLING = 420;

// 0.5 → ×1, 0 → ÷range, 1 → ×range, on a log scale so the middle of the dial feels even
const gain = (value: number, range: number): number => range ** ((value - 0.5) * 2);

export function readKnob (value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;

  const number = typeof value === 'number' ? value : parseFloat(value);

  return Number.isFinite(number) ? Math.min(1, Math.max(0, number)) : null;
}

// Scales in place, relative to the record, so a knob reads alike on every component; returns changed keys
export function applyKnobs (config: DropletConfig, knobs: Knobs): Key[] {
  const touched: Key[] = [];
  const scale = (keys: readonly Key[], factor: number): void => {
    if (factor === 1) return;

    for (const key of keys) {
      config[key] = config[key] * factor;
      touched.push(key);
    }
  };

  const intensity = knobs.intensity ?? 0.5;
  const softness  = knobs.softness ?? 0.5;
  const depth     = knobs.depth ?? 0.5;

  scale(AMPLITUDE, gain(softness, 2) * gain(intensity, 2));
  scale(DEPTH, gain(depth, 2) * gain(intensity, 2));

  if (knobs.spread !== undefined && knobs.spread !== 0.5) {
    scale(SPREAD, gain(knobs.spread, 2));
    scale(SPREAD_WIDTHS, gain(knobs.spread, 1.6));
    config.waveCoupling = Math.min(MAX_COUPLING, config.waveCoupling);
  }

  const stiffness = gain(knobs.viscosity ?? 0.5, 0.5);
  const looseness = gain(knobs.bounce ?? 0.5, 2.2);

  if (stiffness !== 1 || looseness !== 1) {
    for (const [spring, damping] of SPRINGS) {
      const before = config[spring];

      // A disabled spring has no ratio to keep
      if (before <= 0) continue;

      const ratio  = config[damping] / (2 * Math.sqrt(before));
      // A dial at its middle leaves its half alone, so a profile outside the clamps survives it
      const after  = stiffness === 1 ? before : Math.min(MAX_SPRING, Math.max(MIN_SPRING, before * stiffness));
      const target = looseness === 1 ? ratio : Math.min(MAX_RATIO, Math.max(MIN_RATIO, ratio / looseness));

      config[spring]  = after;
      config[damping] = 2 * target * Math.sqrt(after);
      touched.push(spring, damping);
    }
  }

  return touched;
}
