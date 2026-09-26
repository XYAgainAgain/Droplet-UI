/*
 * Shared utilities for every Jelly UI component, split by concern into
 * dom / size / keyboard / motion / aria. This barrel re-exports the whole surface,
 * so consumers keep importing from one place.
 *
 *   import { emit }     from '../../utilities/index.js';
 *   import { uniqueId } from '../../utilities/index.js';
 */

export * from './dom.js';
export * from './size.js';
export * from './keyboard.js';
export * from './motion.js';
export * from './aria.js';
