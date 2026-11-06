// Scene light and lit materials: may change in a minor release until they graduate to the root

export {
  canvasPointToViewport,
  getLights,
  LIGHT_CHANGE_EVENT,
  MAX_LIGHTS_PER_CONTROL,
  MAX_LIGHTS_PER_SCOPE,
  setLights,
} from './light/index.js';

export type {
  DropletLight,
  Light,
  LightColor,
  LightKind,
  LightOptions,
  LightRegion,
} from './light/index.js';

export { sampleBackdrop, watchBackdrop } from './light/backdrop.js';
export type { BackdropOptions, BackdropWatch, PageLights, WatchBackdropOptions } from './light/backdrop.js';

export { materialRecord } from './material/index.js';
export type { MaterialRecord } from './material/index.js';
