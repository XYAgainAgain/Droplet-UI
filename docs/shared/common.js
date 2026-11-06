import { dropletIcon }    from '../../package.js';
import { dropletToast }   from '../../package.js';
import { setThemeMode } from '../../package.js';
import { getThemeMode } from '../../package.js';
import { escapeHTML }   from '../../package.js';

export { escapeHTML };

// Escape first, so the data file can't inject HTML
export function formatInlineCode (text) {
  return escapeHTML(text).replace(/`([^`]+)`/g, '<code>$1</code>');
}

const ORDER   = ['auto', 'light', 'dark'];
const ICON    = { auto: 'theme-auto', light: 'weather-sunny', dark: 'weather-moon' };
const NAME    = { auto: 'system', light: 'light', dark: 'dark' };
const TOOLTIP = { auto: 'System Settings', light: 'Light Mode', dark: 'Dark Mode' };

// Each page's pre-paint <head> script reads the same storage keys
export function wireThemeToggle (button) {
  if (!button) {
    return;
  }

  const sync = () => {
    const mode = getThemeMode();

    button.innerHTML = dropletIcon(ICON[mode], { size: 17 });
    button.setAttribute('label', `Theme: ${NAME[mode]}. Click to change.`);
    button.closest('droplet-tooltip')?.setAttribute('text', TOOLTIP[mode]);
  };

  button.addEventListener('click', () => {
    const next = ORDER[(ORDER.indexOf(getThemeMode()) + 1) % ORDER.length];

    setThemeMode(next);

    localStorage.removeItem('jelly-docs-theme');

    if (next === 'auto') {
      localStorage.removeItem('droplet-docs-theme');
    } else {
      localStorage.setItem('droplet-docs-theme', next);
    }

    sync();
  });

  // The OS can flip the resolved mode while in auto; keep the icon in step
  window.addEventListener('droplet-theme-change', sync);

  sync();
}

const MOTION_ATTRIBUTE      = 'data-droplet-motion';
const MOTION_STORAGE        = 'droplet-docs-reduced-motion';
const MOTION_NOTICE_STORAGE = 'droplet-docs-reduced-motion-notice-shown';
const MOTION_ORDER          = ['system', 'no-preference', 'reduce'];

const MOTION_ICON = {
  'system':        'animal-rabbit-regular',
  'no-preference': 'animal-rabbit-filled',
  'reduce':        'animal-rabbit-off-filled',
};

const MOTION_LABEL = {
  'system':        'Motion follows the system setting. Click to force animation on.',
  'no-preference': 'Animation is on. Click to turn animation off.',
  'reduce':        'Animation is off. Click to follow the system setting.',
};
const MOTION_TOOLTIP = {

  'system':        'System Settings',
  'no-preference': 'Motion',
  'reduce':        'Reduced Motion',
};

function getMotionMode () {
  const mode = document.documentElement.getAttribute(MOTION_ATTRIBUTE);

  return mode === 'no-preference' || mode === 'reduce' ? mode : 'system';
}

// Previews reduced motion via the root attribute, which the motion helper and CSS both read
export function wireMotionToggle (button) {
  if (!button) {
    return;
  }

  const systemMotionQuery = matchMedia('(prefers-reduced-motion: reduce)');

  const sync = () => {
    const mode = getMotionMode();

    button.innerHTML = dropletIcon(MOTION_ICON[mode], { size: 17 });
    button.setAttribute('label', MOTION_LABEL[mode]);
    button.closest('droplet-tooltip')?.setAttribute('text', MOTION_TOOLTIP[mode]);
  };

  // Once per session, so reloads don't keep raising a persistent toast
  const announceSystemReducedMotion = () => {
    if (!systemMotionQuery.matches || sessionStorage.getItem(MOTION_NOTICE_STORAGE)) {
      return;
    }

    dropletToast('Reduced motion is enabled', { tone: 'info', duration: 0 });
    sessionStorage.setItem(MOTION_NOTICE_STORAGE, 'true');
  };

  button.addEventListener('click', () => {
    const current = getMotionMode();
    const mode    = MOTION_ORDER[(MOTION_ORDER.indexOf(current) + 1) % MOTION_ORDER.length];

    localStorage.removeItem('jelly-docs-reduced-motion');

    if (mode === 'system') {
      document.documentElement.removeAttribute(MOTION_ATTRIBUTE);
      localStorage.removeItem(MOTION_STORAGE);
    } else {
      document.documentElement.setAttribute(MOTION_ATTRIBUTE, mode);
      localStorage.setItem(MOTION_STORAGE, mode);
    }

    window.dispatchEvent(new CustomEvent('droplet-motion-change'));
    sync();
  });

  systemMotionQuery.addEventListener?.('change', () => {
    sync();
    announceSystemReducedMotion();
  });

  sync();
  announceSystemReducedMotion();
}
