// Built-in feels go through the public door with no document, so registration is
// import-pure and lands in the module-level registry every document can see.

import { registerPreset } from './index.js';

// gel is the engine baseline itself, so its overlay is empty; override is
// required because the registry reserves built-in names before they load.
registerPreset('feel', 'gel', {}, { override: true });
