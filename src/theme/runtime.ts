import type { ThemeMode }  from './tokens.js';
import type { TokenMap }   from './tokens.js';
import { FONT_STACK }      from './tokens.js';
import { BODY_FONT_STACK } from './tokens.js';
import { MONO_FONT_STACK } from './tokens.js';
import { FOCUS_RING }      from './tokens.js';
import { LIGHT_TOKENS }    from './tokens.js';
import { DARK_TOKENS }     from './tokens.js';

function tokenDeclarations (tokens: TokenMap): string {
  return Object.entries(tokens)
    .map(([name, value]) => `  --droplet-color-${name}: ${value};`)
    .join('\n');
}

// Linked once on :root, so var(--jelly-*) reads the live theme and a --jelly-* override still wins
function legacyLinks (): string {
  const names = [
    'font-display', 'font-text', 'font-mono', 'ring-width', 'ring-gap', 'ring-color', 'shadow-raised', 'shadow-overlay',
    ...new Set([...Object.keys(LIGHT_TOKENS), ...Object.keys(DARK_TOKENS)].map((name) => `color-${name}`)),
  ];

  return names.map((name) => `    --jelly-${name}: var(--droplet-${name});`).join('\n');
}

// @layer droplet lets any un-layered consumer rule win. --droplet-motion mirrors the motion
// attribute for shadow styles' @container style(), since :host-context() is Chromium-only.
export function themeTokenCSS (): string {
  return `
@layer droplet {
  :root {
    color-scheme: light dark;
    --droplet-font-display:   ${FONT_STACK};
    --droplet-font-text:      ${BODY_FONT_STACK};
    --droplet-font-mono:      ${MONO_FONT_STACK};
    --droplet-ring-width:     ${FOCUS_RING.width}px;
    --droplet-ring-gap:       ${FOCUS_RING.gap}px;
    --droplet-ring-color:     color-mix(in srgb, var(--jelly-ring, var(--droplet-ring, var(--jelly-color-border-focus, var(--droplet-color-border-focus)))) ${FOCUS_RING.alpha * 100}%, transparent);
    --droplet-shadow-raised:  0 16px 42px -20px rgba(var(--jelly-color-shadow, var(--droplet-color-shadow)), 0.34);
    --droplet-shadow-overlay: 0 14px 34px -16px rgba(var(--jelly-color-shadow, var(--droplet-color-shadow)), 0.42), 0 4px 12px -8px rgba(var(--jelly-color-shadow, var(--droplet-color-shadow)), 0.28);
${tokenDeclarations(LIGHT_TOKENS)}
${legacyLinks()}
  }

  :root:is([data-droplet-mode="light"], [data-jelly-mode="light"]:not([data-droplet-mode])) {
    color-scheme: light;
  }

  :root:is([data-droplet-mode="dark"], [data-jelly-mode="dark"]:not([data-droplet-mode])) {
    color-scheme: dark;
${tokenDeclarations(DARK_TOKENS)}
  }

  @media (prefers-color-scheme: dark) {
    :root:not([data-droplet-mode="light"], [data-jelly-mode="light"]:not([data-droplet-mode])) {
      color-scheme: dark;
${tokenDeclarations(DARK_TOKENS)}
    }
  }

  :root:is([data-droplet-motion="reduce"], [data-jelly-motion="reduce"]:not([data-droplet-motion]))               { --droplet-motion: reduce; }
  :root:is([data-droplet-motion="no-preference"], [data-jelly-motion="no-preference"]:not([data-droplet-motion])) { --droplet-motion: no-preference; }
}
`;
}

const themedDocuments = new WeakSet<Document>();

// Writing either spelling moves both, so page CSS and the library agree
const ATTRIBUTE_PAIRS: ReadonlyArray<readonly [canonical: string, legacy: string]> = [
  ['data-droplet-mode', 'data-jelly-mode'],
  ['data-droplet-motion', 'data-jelly-motion'],
];

// The name written last in a batch wins; with no batch (install), the canonical one
function syncRootAttributes (root: Element, changed: ReadonlyArray<string | null> | null): void {
  for (const pair of ATTRIBUTE_PAIRS) {
    const [canonical, legacy] = pair;
    const last = changed ? changed.filter((name) => name === canonical || name === legacy).at(-1) : undefined;
    const source = last ?? (root.hasAttribute(canonical) ? canonical : legacy);

    if (changed && last === undefined) {
      continue;
    }

    const partner = source === canonical ? legacy : canonical;
    const value = root.getAttribute(source);

    if (root.getAttribute(partner) === value) {
      continue;
    }

    if (value === null) {
      root.removeAttribute(partner);
    } else {
      root.setAttribute(partner, value);
    }
  }
}

const EVENT_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['droplet-theme-change', 'jelly-theme-change'],
  ['droplet-motion-change', 'jelly-motion-change'],
];

const bridgedViews = new WeakSet<Window>();
let relaying = false;

// Whoever dispatches one name, listeners of the other hear it exactly once
function ensureEventBridge (view: Window): void {
  if (bridgedViews.has(view)) {
    return;
  }

  bridgedViews.add(view);

  const relay = (name: string): void => {
    if (relaying) {
      return;
    }

    relaying = true;

    try {
      view.dispatchEvent(new CustomEvent(name));
    } finally {
      relaying = false;
    }
  };

  for (const [canonical, legacy] of EVENT_PAIRS) {
    view.addEventListener(canonical, () => relay(legacy));
    view.addEventListener(legacy, () => relay(canonical));
  }
}

// The OS scheme and dir change computed tokens without a resize
function installThemeWatchers (doc: Document): void {
  const view = doc.defaultView;

  if (!view) {
    return;
  }

  ensureEventBridge(view);

  if (typeof view.matchMedia === 'function') {
    view.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => notifyThemeChange());
  }

  if (typeof view.MutationObserver === 'function') {
    syncRootAttributes(doc.documentElement, null);
    new view.MutationObserver((records) => {
      syncRootAttributes(doc.documentElement, records.map((record) => record.attributeName));
    }).observe(doc.documentElement, { attributes: true, attributeFilter: ATTRIBUTE_PAIRS.flat() });

    const directionObserver = new view.MutationObserver(() => notifyThemeChange());

    directionObserver.observe(doc.documentElement, { attributes: true, attributeFilter: ['dir'] });

    let observed: HTMLElement | null = null;
    const observeBody = (): void => {
      if (doc.body && doc.body !== observed) {
        observed = doc.body;
        directionObserver.observe(doc.body, { attributes: true, attributeFilter: ['dir'] });
      }
    };

    observeBody();

    // The body may be missing at install or replaced later, so re-attach on child changes
    new view.MutationObserver(observeBody).observe(doc.documentElement, { childList: true });
  }
}

// Called from connectedCallback with ownerDocument, so imports stay pure and adopted elements get themed
export function ensureThemeTokens (doc: Document = globalThis.document): void {
  // A headless document stays unmarked so a later call still installs
  if (!doc?.head || themedDocuments.has(doc)) {
    return;
  }

  if (!doc.querySelector('style[data-droplet-tokens]')) {
    const sheet = doc.createElement('style');

    sheet.setAttribute('data-droplet-tokens', '');
    sheet.textContent = themeTokenCSS();

    doc.head.appendChild(sheet);
  }

  installThemeWatchers(doc);

  themedDocuments.add(doc);
}

function forcedMode (): string | null {
  const root = document.documentElement;

  return root.getAttribute('data-droplet-mode') ?? root.getAttribute('data-jelly-mode');
}

// Fires droplet-theme-change
export function setThemeMode (mode: ThemeMode = 'auto'): void {
  ensureThemeTokens();

  for (const name of ['data-droplet-mode', 'data-jelly-mode']) {
    if (mode === 'light' || mode === 'dark') {
      document.documentElement.setAttribute(name, mode);
    } else {
      document.documentElement.removeAttribute(name);
    }
  }

  notifyThemeChange();
}

export function getThemeMode (): ThemeMode {
  const mode = forcedMode();

  return mode === 'light' || mode === 'dark' ? mode : 'auto';
}

export function isDarkMode (): boolean {
  const forced = forcedMode();

  if (forced === 'dark') {
    return true;
  }

  if (forced === 'light') {
    return false;
  }

  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
}

export function notifyThemeChange (): void {
  ensureEventBridge(window);
  window.dispatchEvent(new CustomEvent('droplet-theme-change'));
}

export function onThemeChange (callback: () => void): () => void {
  window.addEventListener('droplet-theme-change', callback);

  return () => window.removeEventListener('droplet-theme-change', callback);
}
