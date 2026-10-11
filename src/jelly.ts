/*
 * Jelly UI - barrel module. Import this once to register every component.
 *
 *   import 'jelly-ui';
 *
 * Or import ./register and call the define helpers for just the elements you
 * use; importing a component module never registers anything by itself.
 */

import { defineAll } from './register.js';

// Shared foundations, re-exported for consumers who want to build on them
export * from './core/index.js';
export * from './utilities/index.js';
export * from './anchor/index.js';
export * from './theme/index.js';

export { JellyElement } from './element/index.js';
export type { PainterFrame } from './element/index.js';
export { jellyToast }   from './components/toast/index.js';

// Phase 1's authoring surface: presets, the resolver, and the scope cascade
export { registerPreset, getPreset, listPresets, PresetError } from './presets/index.js';
export { resolveConfig, parseQuality, SAFETY_BOUNDS } from './resolve/index.js';
export type { Quality, Resolved, Source, ResolveInputs } from './resolve/index.js';
export { installScopeBridge, readScopedAxis, onScopeChange, AXES } from './cascade/index.js';
export type { Axis } from './cascade/index.js';

export { ICONS }        from './icons/index.js';
export { jellyIcon }    from './icons/index.js';
export type { IconName, IconOptions } from './icons/index.js';

export { defineAll };

// The root must never break a page over a foreign tag, so it warns and skips
// instead of throwing
defineAll({ strict: false });
