// Records each Jelly UI tag as metadata, so tools see one component with an alias, not two
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
