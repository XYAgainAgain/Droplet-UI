// One pure function computes every physics record, so attribute order is
// unobservable and quality is a cap rather than another opinion.

import { DEFAULT_CONFIG } from '../core/index.js';
import type { JellyConfig } from '../core/index.js';
import { CONFIG_KEYS, clampToBounds, isConfigKey } from './bounds.js';
import { getPreset } from '../presets/index.js';
// Built-ins register through the public loading path, so every consumer of the
// resolver sees gel without importing an internal module.
import '../presets/feel.js';

export { SAFETY_BOUNDS, clampToBounds, isConfigKey } from './bounds.js';

export type Quality = 'low' | 'medium' | 'high';
export type Source = 'baseline' | 'profile' | 'feel' | 'raw' | 'quality';

export interface ResolveInputs {
  profile?: Partial<JellyConfig>;
  feel?: string | null;
  raw?: Partial<JellyConfig> | null;
  quality?: Quality;
  document?: Document;
}

export interface Resolved {
  readonly config: Readonly<JellyConfig>;
  readonly provenance: Readonly<Record<keyof JellyConfig, Source>>;
  readonly feel: string;
  readonly quality: Quality;
}

export const DEFAULT_FEEL = 'gel';

const QUALITY_CAPS: Readonly<Record<Quality, Readonly<Partial<Record<keyof JellyConfig, number>>>>> = Object.freeze({
  low: Object.freeze({ samples: 120, normalBlendPasses: 2 }),
  medium: Object.freeze({}),
  high: Object.freeze({}),
});

const QUALITY_ALIASES: Readonly<Record<string, Quality>> = Object.freeze({
  low: 'low', lo: 'low',
  medium: 'medium', med: 'medium', md: 'medium',
  high: 'high', hi: 'high',
});

export function parseQuality (value: string | null | undefined): Quality {
  if (typeof value !== 'string') return 'medium';
  return QUALITY_ALIASES[value.trim().toLowerCase()] ?? 'medium';
}

// Safety bounds bind every layer above the baseline, and a clamped value keeps
// the provenance of the layer that asked for it.
function applyLayer (
  config: JellyConfig,
  provenance: Record<keyof JellyConfig, Source>,
  layer: Partial<JellyConfig> | null | undefined,
  source: Source,
): void {
  if (!layer) return;
  for (const [key, value] of Object.entries(layer)) {
    if (!isConfigKey(key)) continue;
    if (typeof value !== 'number' || !Number.isFinite(value)) continue;
    config[key] = clampToBounds(key, value);
    provenance[key] = source;
  }
}

export function resolveConfig (inputs: ResolveInputs = {}): Resolved {
  const config: JellyConfig = { ...DEFAULT_CONFIG };
  const provenance = {} as Record<keyof JellyConfig, Source>;
  for (const key of CONFIG_KEYS) provenance[key] = 'baseline';

  applyLayer(config, provenance, inputs.profile, 'profile');

  // Names are looked up exactly as written, so mixed case never matches (attribute-matrix.md).
  const requested = typeof inputs.feel === 'string' ? inputs.feel : '';
  const preset = requested === '' ? null : getPreset<Partial<JellyConfig>>('feel', requested, inputs.document);
  // An unknown feel silently becomes gel here; warning is the element's job.
  const feel = preset === null ? DEFAULT_FEEL : requested;
  applyLayer(config, provenance, preset, 'feel');

  applyLayer(config, provenance, inputs.raw, 'raw');

  const quality = parseQuality(inputs.quality);
  for (const [key, cap] of Object.entries(QUALITY_CAPS[quality])) {
    if (typeof cap !== 'number' || !isConfigKey(key)) continue;
    const capped = Math.min(config[key], cap);
    if (capped === config[key]) continue;
    config[key] = capped;
    provenance[key] = 'quality';
  }

  return Object.freeze({
    config: Object.freeze(config),
    provenance: Object.freeze(provenance),
    feel,
    quality,
  });
}
