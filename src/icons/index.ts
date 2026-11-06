// Fluent UI System Icons (Microsoft, MIT): https://github.com/microsoft/fluentui-system-icons

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

export type IconName = keyof typeof ICONS;

export interface IconOptions {
  size?: number;
  label?: string | null;
}

// Size in px; aria-hidden unless a label is given
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
