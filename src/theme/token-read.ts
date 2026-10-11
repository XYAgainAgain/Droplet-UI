// Computed-style reads in the stylesheets' order: the legacy --jelly-* name first,
// which the library points at the canonical value wherever it declares a token.
export function readToken (styles: CSSStyleDeclaration, name: string): string {
  return styles.getPropertyValue(`--jelly-${name}`).trim() || styles.getPropertyValue(`--droplet-${name}`).trim();
}
