import { registerPreset } from './index.js';

registerPreset('material', 'matte', { diffuse: 1, specular: 0, sharpness: 0.5, rim: 0, defaultLight: false }, { override: true });
registerPreset('material', 'gloss', { diffuse: 1, specular: 0.8, sharpness: 0.6, rim: 0.45, defaultLight: true }, { override: true });
