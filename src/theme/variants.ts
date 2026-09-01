/*
 * Variant -> fill/label token mapping. One table (VARIANT_TOKENS) drives both
 * the whole-surface fill map (VARIANT_CSS) and the accent-only map
 * (variantColors), so a variant can never appear in one and drop out of the other.
 */

import { PALETTE } from './tokens.js';

// One fill/label token pair per named variant
interface VariantToken {
  fill: string;
  on: string;
}

/*
 * Variant -> { fill token, on-fill token }. One table drives both the
 * whole-surface fill map (VARIANT_CSS) and the accent-only map
 * (variantColors), so a variant can never appear in one and silently drop out
 * of the other.
 */
const VARIANT_TOKENS: Record<string, VariantToken> = {
  white:    { fill: 'background-white',            on: 'foreground-on-white' },
  rose:     { fill: 'background-rose',             on: 'foreground-on-emphasis' },
  amber:    { fill: 'background-amber',            on: 'foreground-on-emphasis' },
  azure:    { fill: 'background-azure',            on: 'foreground-on-emphasis' },
  mint:     { fill: 'background-mint',             on: 'foreground-on-emphasis' },
  platinum: { fill: 'background-neutral',          on: 'foreground-on-neutral' },
  graphite: { fill: 'background-neutral-emphasis', on: 'foreground-on-emphasis' },
};

/*
 * Variant -> fill/label mapping shared by every fillable component. A variant
 * resolves through the theme tokens, so the same markup adapts when the theme
 * flips to dark. The default (no variant) fills with the accent.
 */
export const VARIANT_CSS = `
  :host {
    --jelly-fill:  var(--jelly-color-background-accent,    ${PALETTE['background-accent']});
    --jelly-label: var(--jelly-color-foreground-on-accent, ${PALETTE['foreground-on-accent']});
  }
${Object.entries(VARIANT_TOKENS).map(([name, { fill, on }]) =>
  `  :host([variant="${name}"]) { --jelly-fill: var(--jelly-color-${fill}, ${PALETTE[fill]}); --jelly-label: var(--jelly-color-${on}, ${PALETTE[on]}); }`
).join('\n')}
`;

// Which local custom properties a component wants the variant hues written to
export interface VariantColorProps {
  color?: string;
  on?: string | null;
  ring?: string | null;
}

/*
 * Variant -> custom-property mapping for the components that don't fill their
 * whole surface (checkbox, radio, switch, slider, range, select, otp,
 * progress, chip). They colour an accent instead of --jelly-fill and each uses
 * its own property names, so this generates the full table for whichever
 * properties a component passes:
 *   - `color` : the property that takes the variant fill hue (required)
 *   - `on`    : optional property that takes the on-fill contrast colour
 *   - `ring`  : optional second property that also takes the variant hue
 */
export function variantColors ({ color, on = null, ring = null }: VariantColorProps = {}): string {
  const names = Object.keys(VARIANT_TOKENS) as (keyof typeof VARIANT_TOKENS)[];
  const decls = (name: keyof typeof VARIANT_TOKENS): string => {
    const token = VARIANT_TOKENS[name]!;

    return [
      color ? `${color}: var(--jelly-color-${token.fill}, ${PALETTE[token.fill]});` : '',
      ring  ? `${ring}: var(--jelly-color-${token.fill}, ${PALETTE[token.fill]});`   : '',
      on    ? `${on}: var(--jelly-color-${token.on}, ${PALETTE[token.on]});`         : '',
    ].filter(Boolean).join(' ');
  };

  return names
    .map((name) => `  :host([variant="${name}"]) { ${decls(name)} }`)
    .join('\n');
}
