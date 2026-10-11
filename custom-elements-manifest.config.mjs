/*
 * Custom Elements Manifest analyzer config. Reads the component TypeScript
 * sources + their JSDoc and emits custom-elements.json (attributes, properties,
 * methods, events, slots, CSS parts and CSS custom properties). That manifest
 * is the single source of truth the docs site is generated from.
 */

// Each canonical element records its permanent Jelly UI tag as metadata, so tools
// see one component with an alias rather than two primary components
const legacyAliases = {
  name: 'droplet-legacy-aliases',
  packageLinkPhase ({ customElementsManifest }) {
    for (const module of customElementsManifest.modules) {
      for (const declaration of module.declarations ?? []) {
        if (declaration.customElement && declaration.tagName?.startsWith('droplet-')) {
          declaration.legacyTagName = declaration.tagName.replace(/^droplet-/, 'jelly-');
        }
      }
    }
  },
};

export default {
  globs: ['src/components/**/*.ts'],
  exclude: ['src/**/*.test.ts'],
  outdir: '.',
  litelement: false,
  dev: false,
  plugins: [legacyAliases],
};
