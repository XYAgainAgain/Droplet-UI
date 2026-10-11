/*
 * Assemble the GitHub Pages site into _site/.
 *
 * The docs are buildless (raw ES modules), so this does not bundle them - it
 * builds the library, regenerates the docs data from the sources, then copies
 * exactly the files the site needs into a clean _site/. That keeps the deploy
 * from uploading the whole repository (src, tests, node_modules-adjacent files)
 * and lets Pages serve the API page at /api instead of /api.html.
 *
 * Layout produced:
 *   _site/index.html                      (from docs/showcase/index.html)
 *   _site/api/index.html                  (from docs/api/index.html)  -> /api
 *   _site/migration/index.html            (from docs/migration/index.html)  -> /migration
 *   _site/dist/droplet.js                 (the library bundle; jelly.js re-exports it)
 *   _site/package.js                      (the hosted public entry)
 *   _site/docs/**                         (runtime docs assets)
 *   _site/docs/lottie/lottie_light.min.js (copied from the lottie-web dep)
 *
 * The three HTML pages are authored for their final URL depth (showcase at /,
 * api at /api/, migration at /migration/), so copying is enough - no path rewriting.
 *
 *   node scripts/build-site.mjs      (or: npm run build:site)
 */

import { execSync }  from 'node:child_process';
import { rmSync }    from 'node:fs';
import { mkdirSync } from 'node:fs';
import { cpSync }    from 'node:fs';
import { copyFileSync } from 'node:fs';
import { existsSync } from 'node:fs';

import { fileURLToPath } from 'node:url';
import { dirname }       from 'node:path';
import { resolve }       from 'node:path';
import { join }          from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const site = join(root, '_site');

const run = (command) => execSync(command, { cwd: root, stdio: 'inherit' });

// 1. Build the library bundle (dist/droplet.js) and regenerate the docs data
//    (custom-elements.json + docs/content/data.js) from the component sources.
run('npm run build');
run('npm run docs');

// 2. Start from a clean output directory
rmSync(site, { recursive: true, force: true });
mkdirSync(site, { recursive: true });

// 3. The library bundle + the hosted public entry point
cpSync(join(root, 'dist'), join(site, 'dist'), { recursive: true });
copyFileSync(join(root, 'package.js'), join(site, 'package.js'));

// 4. The runtime docs assets. Skip the build-time-only content source and the
//    two page sources (they are placed at their public URLs in step 5).
const skip = new Set([
  join(root, 'docs', 'README.md'),
  join(root, 'docs', 'content', 'content.js'),
  join(root, 'docs', 'showcase', 'index.html'),
  join(root, 'docs', 'api', 'index.html'),
  join(root, 'docs', 'migration', 'index.html'),
]);

cpSync(join(root, 'docs'), join(site, 'docs'), {
  recursive: true,
  filter: (src) => !skip.has(src),
});

// 5. The pages at their public URLs: showcase → /, api → /api/, migration → /migration/
copyFileSync(join(root, 'docs', 'showcase', 'index.html'), join(site, 'index.html'));
mkdirSync(join(site, 'api'), { recursive: true });
copyFileSync(join(root, 'docs', 'api', 'index.html'), join(site, 'api', 'index.html'));
mkdirSync(join(site, 'migration'), { recursive: true });
copyFileSync(join(root, 'docs', 'migration', 'index.html'), join(site, 'migration', 'index.html'));

// 6. The Lottie player, sourced from the lottie-web dependency (never vendored)
copyFileSync(
  join(root, 'node_modules', 'lottie-web', 'build', 'player', 'lottie_light.min.js'),
  join(site, 'docs', 'lottie', 'lottie_light.min.js'),
);

// 7. The custom-domain marker (jelly-ui.com), if present, so GitHub Pages keeps
//    serving the site on the custom domain across deploys.
if (existsSync(join(root, 'CNAME'))) {
  copyFileSync(join(root, 'CNAME'), join(site, 'CNAME'));
}

console.log('✓ Built _site/ — index.html, api/, dist/, package.js, docs/, lottie player');
