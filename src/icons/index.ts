/*
 * Inline icon set - Fluent System Icons (Microsoft, MIT license)
 *
 * A small, dependency-free subset of Microsoft's Fluent UI System Icons
 * (https://github.com/microsoft/fluentui-system-icons). Each glyph lives in
 * its own standalone 24×24 file under ./icons/*.svg and is imported as a raw
 * string, so the SVG data stays out of the TypeScript and nothing is fetched
 * at runtime. The paths carry no colour of their own - they render with
 * `currentColor`, so an icon inherits the text colour of wherever it sits.
 *
 *   import { dropletIcon } from './jelly.js';
 *
 *   button.innerHTML = dropletIcon('heart', { size: 18 });
 *   alertIcon        = dropletIcon('warning', { label: 'Warning' });
 */

import info            from './info.svg?raw';
import checkmarkCircle from './checkmark-circle.svg?raw';
import warning         from './warning.svg?raw';
import errorCircle     from './error-circle.svg?raw';
import dismiss         from './dismiss.svg?raw';
import search          from './search.svg?raw';
import link            from './link.svg?raw';
import settings        from './settings.svg?raw';
import star            from './star.svg?raw';
import heart           from './heart.svg?raw';
import weatherMoon     from './weather-moon.svg?raw';
import weatherSunny    from './weather-sunny.svg?raw';
import themeAuto       from './theme-auto.svg?raw';
import animalRabbitFilled from './animal-rabbit-filled.svg?raw';
import animalRabbitOffFilled from './animal-rabbit-off-filled.svg?raw';
import animalRabbitRegular from './animal-rabbit-regular.svg?raw';

// Every icon, keyed by its kebab-case name. Each value is a complete standalone
// 24×24 SVG string; dropletIcon() injects size and ARIA attributes at render time.
export const ICONS = {
  'info':             info,
  'checkmark-circle': checkmarkCircle,
  'warning':          warning,
  'error-circle':     errorCircle,
  'dismiss':          dismiss,
  'search':           search,
  'link':             link,
  'settings':         settings,
  'star':             star,
  'heart':            heart,
  'weather-moon':     weatherMoon,
  'weather-sunny':    weatherSunny,
  'theme-auto':       themeAuto,
  'animal-rabbit-filled':     animalRabbitFilled,
  'animal-rabbit-off-filled': animalRabbitOffFilled,
  'animal-rabbit-regular':    animalRabbitRegular,
} satisfies Record<string, string>;

// The name of any icon in the set (autocompletes at call sites)
export type IconName = keyof typeof ICONS;

// Options for rendering an icon
export interface IconOptions {
  size?: number;
  label?: string | null;
}

/*
 * Render one icon as an inline SVG string. Decorative by default
 * (aria-hidden); pass a label to make it meaningful to assistive tech. The
 * stored SVG is a full 24×24 glyph - this only stamps the requested pixel
 * size and the ARIA role onto its opening tag.
 */
export function dropletIcon (name: IconName, { size = 20, label = null }: IconOptions = {}): string {
  const svg = ICONS[name];

  if (!svg) {
    return '';
  }

  const aria = label
    ? `role="img" aria-label="${label.replace(/"/g, '&quot;')}"`
    : 'aria-hidden="true"';

  return svg.replace('<svg ', `<svg width="${size}" height="${size}" ${aria} `);
}
