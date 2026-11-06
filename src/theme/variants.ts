import { PALETTE } from './tokens.js';

interface VariantToken {
  fill: string;
  on: string;
}

// Drives both VARIANT_CSS and variantColors, so neither can drop a variant
const VARIANT_TOKENS: Record<string, VariantToken> = {
  white:    { fill: 'background-white',            on: 'foreground-on-white' },
  rose:     { fill: 'background-rose',             on: 'foreground-on-emphasis' },
  amber:    { fill: 'background-amber',            on: 'foreground-on-emphasis' },
  azure:    { fill: 'background-azure',            on: 'foreground-on-emphasis' },
  mint:     { fill: 'background-mint',             on: 'foreground-on-emphasis' },
  platinum: { fill: 'background-neutral',          on: 'foreground-on-neutral' },
  graphite: { fill: 'background-neutral-emphasis', on: 'foreground-on-emphasis' },
};

const INTENT_TOKENS: Record<string, VariantToken> = {
  accent:    { fill: 'background-accent',    on: 'foreground-on-accent' },
  neutral:   { fill: 'background-neutral',   on: 'foreground-on-neutral' },
  info:      { fill: 'background-azure',     on: 'foreground-on-emphasis' },
  success:   { fill: 'background-mint',      on: 'foreground-on-emphasis' },
  warning:   { fill: 'background-amber',     on: 'foreground-on-emphasis' },
  danger:    { fill: 'background-rose',      on: 'foreground-on-emphasis' },
  highlight: { fill: 'background-highlight', on: 'foreground-on-highlight' },
};

const LITERALS: Record<string, string> = {
  'background-highlight':    'oklch(0.9 0.18 100)',
  'foreground-on-highlight': 'oklch(0.2 0 0)',
};

function themeColor (token: string): string {
  return `var(--jelly-color-${token}, var(--droplet-color-${token}, ${PALETTE[token] ?? LITERALS[token]}))`;
}

// Written by syncColorPick in pick.ts
const PICK    = 'var(--droplet-pick)';
const PICK_ON = 'var(--droplet-pick-on)';

// Legacy names: components built on VARIANT_CSS read --jelly-fill
export const VARIANT_CSS = `
  :host {
    --jelly-fill:  ${themeColor('background-accent')};
    --jelly-label: ${themeColor('foreground-on-accent')};
  }
${Object.entries(VARIANT_TOKENS).map(([name, { fill, on }]) =>
  `  :host([variant="${name}"]) { --jelly-fill: ${themeColor(fill)}; --jelly-label: ${themeColor(on)}; }`
).join('\n')}
${Object.entries(INTENT_TOKENS).map(([name, { fill, on }]) =>
  `  :host([intent="${name}"]) { --jelly-fill: ${themeColor(fill)}; --jelly-label: ${themeColor(on)}; }`
).join('\n')}
  :host([data-droplet-pick]) { --jelly-fill: ${PICK}; --jelly-label: ${PICK_ON}; }
`;

export interface VariantColorProps {
  color?: string;
  on?: string | null;
  ring?: string | null;
}

function declare (property: string, value: string): string {
  return property.startsWith('--droplet-')
    ? `${property}: ${value}; --jelly-${property.slice('--droplet-'.length)}: var(${property});`
    : `${property}: ${value};`;
}

// For components that color an accent instead of filling their surface
export function variantColors ({ color, on = null, ring = null }: VariantColorProps = {}): string {
  const decls = (fill: string, label: string): string => [
    color ? declare(color, fill) : '',
    ring  ? declare(ring, fill)  : '',
    on    ? declare(on, label)   : '',
  ].filter(Boolean).join(' ');

  // Later rules win at equal specificity, so color beats intent and intent beats variant
  return [
    ...Object.entries(VARIANT_TOKENS).map(([name, token]) => `  :host([variant="${name}"]) { ${decls(themeColor(token.fill), themeColor(token.on))} }`),
    ...Object.entries(INTENT_TOKENS).map(([name, token]) => `  :host([intent="${name}"]) { ${decls(themeColor(token.fill), themeColor(token.on))} }`),
    `  :host([data-droplet-pick]) { ${decls(PICK, PICK_ON)} }`,
  ].join('\n');
}
