import { registerPreset } from './index.js';

// gel is the baseline, so its overlay is empty; override because built-in names are reserved
registerPreset('feel', 'gel', {}, { override: true });

// States of matter as knob bundles to fork from; 0.5 on a dial means "as gel"
registerPreset('feel', 'solid', { knobs: { softness: 0.1, bounce: 0.3, viscosity: 0.7, spread: 0.2, depth: 0.6 } }, { override: true });
registerPreset('feel', 'liquid', { knobs: { softness: 0.7, bounce: 0.7, viscosity: 0.3, spread: 0.75 } }, { override: true });
registerPreset('feel', 'goo', { knobs: { softness: 0.75, bounce: 0.2, viscosity: 0.85, spread: 0.55 } }, { override: true });
registerPreset('feel', 'plasma', { knobs: { softness: 0.8, bounce: 0.85, viscosity: 0.15, spread: 0.85, depth: 0.6 } }, { override: true });
registerPreset('feel', 'gas', { knobs: { softness: 1, bounce: 0.25, viscosity: 0.4, spread: 0.9, depth: 0.85 } }, { override: true });
