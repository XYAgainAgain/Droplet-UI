import { PALETTE } from './tokens.js';

interface VariantToken {
  fill: string;
  on: string;
}

// One table drives both VARIANT_CSS (whole-surface fill) and variantColors (accent-only),
// so a variant can never appear in one and silently drop out of the other
const VARIANT_TOKENS: Record<string, VariantToken> = {
  white:    { fill: 'background-white',            on: 'foreground-on-white' },
  rose:     { fill: 'background-rose',             on: 'foreground-on-emphasis' },
  amber:    { fill: 'background-amber',            on: 'foreground-on-emphasis' },
  azure:    { fill: 'background-azure',            on: 'foreground-on-emphasis' },
  mint:     { fill: 'background-mint',             on: 'foreground-on-emphasis' },
  platinum: { fill: 'background-neutral',          on: 'foreground-on-neutral' },
  graphite: { fill: 'background-neutral-emphasis', on: 'foreground-on-emphasis' },
};

// A theme color: a legacy --jelly-* override in scope wins, then the canonical token, then the light palette
function themeColor (token: string): string {
  return `var(--jelly-color-${token}, var(--droplet-color-${token}, ${PALETTE[token]}))`;
}

// Legacy-named output: consumer components built on VARIANT_CSS read --jelly-fill
export const VARIANT_CSS = `
  :host {
    --jelly-fill:  ${themeColor('background-accent')};
    --jelly-label: ${themeColor('foreground-on-accent')};
  }
${Object.entries(VARIANT_TOKENS).map(([name, { fill, on }]) =>
  `  :host([variant="${name}"]) { --jelly-fill: ${themeColor(fill)}; --jelly-label: ${themeColor(on)}; }`
).join('\n')}
`;

// Which local custom properties a component wants the variant hues written to
export interface VariantColorProps {
  color?: string;
  on?: string | null;
  ring?: string | null;
}

// A library property also points its legacy name at itself, as every component
// token does; a consumer's own property is written as given
function declare (property: string, value: string): string {
  return property.startsWith('--droplet-')
    ? `${property}: ${value}; --jelly-${property.slice('--droplet-'.length)}: var(${property});`
    : `${property}: ${value};`;
}

// Accent-only variant map for components that color an accent instead of filling their
// surface; each passes its own property names
export function variantColors ({ color, on = null, ring = null }: VariantColorProps = {}): string {
  const names = Object.keys(VARIANT_TOKENS) as (keyof typeof VARIANT_TOKENS)[];
  const decls = (name: keyof typeof VARIANT_TOKENS): string => {
    const token = VARIANT_TOKENS[name]!;

    return [
      color ? declare(color, themeColor(token.fill)) : '',
      ring  ? declare(ring, themeColor(token.fill))  : '',
      on    ? declare(on, themeColor(token.on))      : '',
    ].filter(Boolean).join(' ');
  };

  return names
    .map((name) => `  :host([variant="${name}"]) { ${decls(name)} }`)
    .join('\n');
}
