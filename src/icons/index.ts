/*
 * Inline icon set: Fluent System Icons (Microsoft, MIT license)
 *
 * A small, dependency-free subset of Microsoft's Fluent UI System Icons
 * (https://github.com/microsoft/fluentui-system-icons). Each glyph is a standalone
 * 24×24 SVG beside this file, imported as a raw string so nothing is fetched at
 * runtime. The paths render with `currentColor`, so an icon inherits the text color.
 *
 *   import { dropletIcon } from 'droplet-ui';
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

export interface IconOptions {
  size?: number;
  label?: string | null;
}

/*
 * Render one icon as an inline SVG string, decorative (aria-hidden) unless a label is
 * given. Only the size and ARIA attributes are stamped onto the stored glyph's opening tag.
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
