// One pure function builds every physics record, so attribute order is unobservable

import { DEFAULT_CONFIG } from '../core/index.js';
import type { DropletConfig } from '../core/index.js';
import { CONFIG_KEYS, clampToBounds, isConfigKey } from './bounds.js';
import { getPreset } from '../presets/index.js';
// Registers the built-in feels, so every resolver consumer sees gel
import '../presets/feel.js';
import { applyKnobs } from './knobs.js';
import type { Knobs } from './knobs.js';

export { SAFETY_BOUNDS, clampToBounds, isConfigKey, sameConfig } from './bounds.js';
export { KNOBS, applyKnobs, readKnob } from './knobs.js';
export type { Knob, Knobs } from './knobs.js';

export type Quality = 'low' | 'medium' | 'high';
export type Source = 'baseline' | 'profile' | 'feel' | 'knob' | 'raw' | 'quality';

export interface ResolveInputs {
  profile?: Partial<DropletConfig>;
  feel?: string | null;
  knobs?: Knobs | null;
  raw?: Partial<DropletConfig> | null;
  quality?: Quality;
  document?: Document;
}

export interface Resolved {
  readonly config: Readonly<DropletConfig>;
  readonly provenance: Readonly<Record<keyof DropletConfig, Source>>;
  readonly feel: string;
  readonly quality: Quality;
}

export const DEFAULT_FEEL = 'gel';

const QUALITY_CAPS: Readonly<Record<Quality, Readonly<Partial<Record<keyof DropletConfig, number>>>>> = Object.freeze({
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

// Bounds bind every layer above the baseline; a clamped value keeps its layer's provenance
function applyLayer (
  config: DropletConfig,
  provenance: Record<keyof DropletConfig, Source>,
  layer: Partial<DropletConfig> | null | undefined,
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
  const config: DropletConfig = { ...DEFAULT_CONFIG };
  const provenance = {} as Record<keyof DropletConfig, Source>;
  for (const key of CONFIG_KEYS) provenance[key] = 'baseline';

  applyLayer(config, provenance, inputs.profile, 'profile');

  // Exact lookup: mixed case never matches
  const requested = typeof inputs.feel === 'string' ? inputs.feel.trim() : '';
  const found = requested === '' ? null : getPreset<Partial<DropletConfig>>('feel', requested, inputs.document);
  // An unknown feel becomes gel, overlay included (a document may override gel); the element warns
  const feel = found === null ? DEFAULT_FEEL : requested;
  const preset = found ?? getPreset<Partial<DropletConfig> & { knobs?: Knobs }>('feel', DEFAULT_FEEL, inputs.document);
  applyLayer(config, provenance, preset, 'feel');

  // A preset's knob bundle first, the element's knobs over it, both relative to the record so far
  const knobs = { ...(preset as { knobs?: Knobs } | null)?.knobs, ...inputs.knobs };
  for (const key of applyKnobs(config, knobs)) {
    config[key] = clampToBounds(key, config[key]);
    provenance[key] = 'knob';
  }

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
