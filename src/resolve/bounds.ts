// Split out of the resolver so the preset registry can validate against the same
// bounds without an import cycle; src/resolve/index.ts re-exports all of it.

import { DEFAULT_CONFIG } from '../core/index.js';
import type { JellyConfig } from '../core/index.js';

// Phase 6 adds entries as the integrator's stable region is measured; a bound
// may narrow later, never widen.
export const SAFETY_BOUNDS: Readonly<Partial<Record<keyof JellyConfig, readonly [min: number, max: number]>>> = Object.freeze({
  samples: Object.freeze([24, 480]) as readonly [number, number],
  normalBlendPasses: Object.freeze([0, 6]) as readonly [number, number],
});

export const CONFIG_KEYS = Object.keys(DEFAULT_CONFIG) as Array<keyof JellyConfig>;

const CONFIG_KEY_SET: ReadonlySet<string> = new Set<string>(CONFIG_KEYS);

export function isConfigKey (key: string): key is keyof JellyConfig {
  return CONFIG_KEY_SET.has(key);
}

export function clampToBounds (key: keyof JellyConfig, value: number): number {
  const bound = SAFETY_BOUNDS[key];
  if (!bound) return value;
  return Math.min(Math.max(value, bound[0]), bound[1]);
}
