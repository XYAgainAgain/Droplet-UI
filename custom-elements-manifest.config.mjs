/*
 * Custom Elements Manifest analyzer config: reads the component sources and their
 * JSDoc and emits custom-elements.json, which the docs data build reconciles against.
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
