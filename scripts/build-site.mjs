// Builds _site/ for Pages: each page is authored for its final URL depth, so files copy unrewritten

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

run('npm run build');
run('npm run docs');

rmSync(site, { recursive: true, force: true });
mkdirSync(site, { recursive: true });

// The single-file bundle and the hosted entry only; the module tree is for packages
mkdirSync(join(site, 'dist'), { recursive: true });
for (const file of ['droplet.js', 'droplet.js.map', 'jelly.js']) {
  copyFileSync(join(root, 'dist', file), join(site, 'dist', file));
}
copyFileSync(join(root, 'package.js'), join(site, 'package.js'));

// The three pages copy to their public URLs below
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

copyFileSync(join(root, 'docs', 'showcase', 'index.html'), join(site, 'index.html'));
mkdirSync(join(site, 'api'), { recursive: true });
copyFileSync(join(root, 'docs', 'api', 'index.html'), join(site, 'api', 'index.html'));
mkdirSync(join(site, 'migration'), { recursive: true });
copyFileSync(join(root, 'docs', 'migration', 'index.html'), join(site, 'migration', 'index.html'));

// From the lottie-web dependency, never vendored
copyFileSync(
  join(root, 'node_modules', 'lottie-web', 'build', 'player', 'lottie_light.min.js'),
  join(site, 'docs', 'lottie', 'lottie_light.min.js'),
);

// Pages keeps a custom domain only while CNAME ships
if (existsSync(join(root, 'CNAME'))) {
  copyFileSync(join(root, 'CNAME'), join(site, 'CNAME'));
}

console.log('✓ Built _site/ — index.html, api/, migration/, dist/, package.js, docs/, lottie player');
