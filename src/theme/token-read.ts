// Legacy name first, in the stylesheets' var() order; the library links it to the canonical one
export function readToken (styles: CSSStyleDeclaration, name: string): string {
  return styles.getPropertyValue(`--jelly-${name}`).trim() || styles.getPropertyValue(`--droplet-${name}`).trim();
}
