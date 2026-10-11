/*
 * Barrel module: importing it registers every component under its droplet-* tag and its
 * permanent Jelly UI alias. For only some elements, import ./register and call the define
 * helpers; component modules never register anything on their own.
 */

import { defineAll } from './register.js';
import { defineCompat } from './compat/index.js';

// Shared foundations, re-exported for consumers who want to build on them
export * from './core/index.js';
export * from './utilities/index.js';
export * from './anchor/index.js';
export * from './theme/index.js';

export { DropletElement } from './element/index.js';
export type { PainterFrame } from './element/index.js';
export { dropletToast } from './components/toast/index.js';

// Authoring surface: presets, the resolver, and the scope cascade
export { registerPreset, getPreset, listPresets, PresetError } from './presets/index.js';
export { resolveConfig, parseQuality, SAFETY_BOUNDS } from './resolve/index.js';
export type { Quality, Resolved, Source, ResolveInputs } from './resolve/index.js';
export { installScopeBridge, readScopedAxis, onScopeChange, AXES } from './cascade/index.js';
export type { Axis } from './cascade/index.js';

export { ICONS }        from './icons/index.js';
export { dropletIcon }  from './icons/index.js';
export type { IconName, IconOptions } from './icons/index.js';

// Permanent Jelly UI names, so a package swap breaks no existing import
export { DropletBody as JellyBody } from './core/index.js';
export { DropletElement as JellyElement } from './element/index.js';
export type { DropletBodyOptions as JellyBodyOptions, DropletComponent as JellyComponent, DropletConfig as JellyConfig } from './core/index.js';
export { dropletToast as jellyToast } from './components/toast/index.js';
export { dropletIcon as jellyIcon } from './icons/index.js';

// Every element class and define helper, canonical and legacy, from one import
export * from './register.js';
export * from './compat/index.js';

// The root must never break a page over a foreign tag, so it warns and skips
// instead of throwing; legacy tags register after the canonical ones
defineAll({ strict: false });
defineCompat();
