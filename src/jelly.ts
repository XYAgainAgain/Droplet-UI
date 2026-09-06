/*
 * Jelly UI - barrel module. Import this once to register every component.
 *
 *   import 'jelly-ui';
 *
 * Or import individual components from ./components/ to keep the payload
 * small - every component pulls in exactly what it needs.
 */

// Shared foundations, re-exported for consumers who want to build on them
export * from './core/index.js';
export * from './utilities/index.js';
export * from './anchor/index.js';
export * from './theme/index.js';

export { JellyElement } from './element/index.js';
export { jellyToast }   from './components/toast/index.js';

export { ICONS }        from './icons/index.js';
export { jellyIcon }    from './icons/index.js';
export type { IconName, IconOptions } from './icons/index.js';

// Theming
import './components/theme/index.js';

// Form controls
import './components/button/index.js';
import './components/icon-button/index.js';
import './components/input/index.js';
import './components/textarea/index.js';
import './components/checkbox/index.js';
import './components/radio/index.js';
import './components/radio-group/index.js';
import './components/switch/index.js';
import './components/slider/index.js';
import './components/range/index.js';
import './components/select/index.js';
import './components/option/index.js';
import './components/segmented/index.js';
import './components/segment/index.js';
import './components/otp/index.js';
import './components/label/index.js';

// Feedback & status
import './components/progress/index.js';
import './components/spinner/index.js';
import './components/skeleton/index.js';
import './components/badge/index.js';
import './components/alert/index.js';
import './components/toast/index.js';

// Surfaces & disclosure
import './components/card/index.js';
import './components/chip/index.js';
import './components/kbd/index.js';
import './components/divider/index.js';
import './components/collapsible/index.js';
import './components/accordion/index.js';

// Navigation
import './components/tabs/index.js';
import './components/breadcrumbs/index.js';
import './components/pagination/index.js';
import './components/resizable/index.js';

// Overlays
import './components/tooltip/index.js';
import './components/popover/index.js';
import './components/menu/index.js';
import './components/dialog/index.js';
import './components/drawer/index.js';

// Imported last so the 36 unconverted components keep their existing
// registration order; never breaks a page over a foreign tag, so not strict.
import { defineAll } from './register.js';
export { defineAll };

defineAll({ strict: false });
