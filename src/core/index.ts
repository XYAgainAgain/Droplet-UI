/*
 * The Droplet UI physics core, split into config (tuning constants), body (the
 * soft-body membrane simulation + DropletBody) and engine (the shared rAF loop).
 * This barrel re-exports the public surface.
 */

export * from './config.js';
export * from './body.js';
export * from './engine.js';
