// Apart from the resolver so presets can validate against it without an import cycle

import { DEFAULT_CONFIG } from '../core/index.js';
import type { DropletConfig } from '../core/index.js';

// A bound may narrow as the integrator's stable region is measured, never widen
export const SAFETY_BOUNDS: Readonly<Partial<Record<keyof DropletConfig, readonly [min: number, max: number]>>> = Object.freeze({
  samples: Object.freeze([24, 480]) as readonly [number, number],
  normalBlendPasses: Object.freeze([0, 6]) as readonly [number, number],
});

export const CONFIG_KEYS = Object.keys(DEFAULT_CONFIG) as Array<keyof DropletConfig>;

const CONFIG_KEY_SET: ReadonlySet<string> = new Set<string>(CONFIG_KEYS);

export function isConfigKey (key: string): key is keyof DropletConfig {
  return CONFIG_KEY_SET.has(key);
}

// The body rounds these, so the record must too or it never matches body.config
export const INTEGER_KEYS: ReadonlySet<string> = new Set<string>(['normalBlendPasses', 'samples']);

// Non-finite values fall back to the baseline
export function clampToBounds (key: keyof DropletConfig, value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_CONFIG[key];
  const rounded = INTEGER_KEYS.has(key) ? Math.round(value) : value;
  const bound = SAFETY_BOUNDS[key];
  if (!bound) return rounded;
  return Math.min(Math.max(rounded, bound[0]), bound[1]);
}

// Field-by-field, because a record is rebuilt from scratch on every input change
export function sameConfig (a: Readonly<DropletConfig>, b: Readonly<DropletConfig>): boolean {
  return CONFIG_KEYS.every((key) => Object.is(a[key], b[key]));
}
