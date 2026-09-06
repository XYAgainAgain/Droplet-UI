// Explicit registration entry: importing it hands over the component classes,
// calling defineAll() is what puts them on tags.

import { defineElements, TAGS } from './registry/index.js';
import type { DefineOptions, DefineResult } from './registry/index.js';
import { JellyButton } from './components/button/index.js';
import { JellyCollapsible } from './components/collapsible/index.js';
import { JellySlider } from './components/slider/index.js';
import { JellyToaster } from './components/toast/index.js';

export { defineElements, RegistrationError, TAG_PREFIX, TAGS } from './registry/index.js';
export type { Collision, DefineEntry, DefineOptions, DefineResult, TagName } from './registry/index.js';
export { JellyButton, JellyCollapsible, JellySlider, JellyToaster };

// One batch so preflight covers the whole pilot set; strict by default because
// this is the explicit helper, unlike the root entry's warn-and-skip import.
export function defineAll (options: DefineOptions = {}): DefineResult {
  return defineElements([
    [TAGS.button, JellyButton],
    [TAGS.collapsible, JellyCollapsible],
    [TAGS.slider, JellySlider],
    [TAGS.toaster, JellyToaster],
  ], { ...options, strict: options.strict ?? true });
}
