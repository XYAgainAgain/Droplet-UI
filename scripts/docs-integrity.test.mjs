import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const load = (path) => import(pathToFileURL(join(ROOT, path)).href);

const manifest = JSON.parse(readFileSync(join(ROOT, 'custom-elements.json'), 'utf8'));
const elements = manifest.modules.flatMap((m) => m.declarations ?? []).filter((d) => d.customElement && d.tagName);
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));

test('the manifest names all 40 canonical tags once, each with its registry legacy alias', async () => {
  const { TAGS, LEGACY_TAGS } = await load('dist/esm/registry/tags.js');
  const legacyOf = new Map(Object.keys(TAGS).map((key) => [TAGS[key], LEGACY_TAGS[key]]));
  const tags = elements.map((d) => d.tagName);
  assert.equal(new Set(tags).size, tags.length);
  assert.deepEqual(new Set(tags), new Set(Object.values(TAGS)));
  for (const element of elements) {
    assert.equal(element.legacyTagName, legacyOf.get(element.tagName), element.tagName);
  }
});

test('the curated content and the generated docs data cover every tag', async () => {
  const { COMPONENTS: curated } = await load('docs/content/content.js');
  const { COMPONENTS: generated } = await load('docs/content/data.js');
  const tags = new Set(elements.map((d) => d.tagName));
  assert.deepEqual(new Set(curated.map((c) => c.tag)), tags);
  assert.deepEqual(new Set(generated.map((c) => c.tag)), tags);
});

test('every tag has a showcase playground unless it only lives inside another one', async () => {
  const { PLAYGROUNDS, NO_PANEL } = await load('docs/showcase/playgrounds.js');
  for (const { tagName } of elements) {
    assert.ok(PLAYGROUNDS[tagName] || NO_PANEL.has(tagName), `${tagName} has no playground`);
  }
});

test('every package entry and component subpath exists in the build', () => {
  const targets = [pkg.main, pkg.module, pkg.types];
  for (const [key, value] of Object.entries(pkg.exports)) {
    if (key.includes('*')) continue;
    targets.push(...(typeof value === 'string' ? [value] : Object.values(value)));
  }
  for (const target of targets) {
    assert.ok(existsSync(join(ROOT, target)), `${target} is missing; run npm run build`);
  }
  const dirs = readdirSync(join(ROOT, 'src', 'components'), { withFileTypes: true }).filter((d) => d.isDirectory());
  assert.ok(dirs.length > 0);
  for (const { name } of dirs) {
    for (const ext of ['js', 'd.ts']) {
      assert.ok(existsSync(join(ROOT, 'dist', 'esm', 'components', name, `index.${ext}`)), `droplet-ui/${name} (${ext})`);
    }
  }
});

// Bundlers would drop the root's registration and the built-in gel preset
test('the package never declares itself free of side effects', () => {
  assert.notEqual(pkg.sideEffects, false);
});

// HTML resolves from its served URL (showcase at /, the others at /<dir>/), a module from its file
test('every dist file the docs pages load exists in the build', () => {
  const sources = [{ file: join(ROOT, 'package.js'), base: ROOT }];
  for (const dir of ['showcase', 'api', 'migration']) {
    for (const name of readdirSync(join(ROOT, 'docs', dir)).filter((f) => /\.(js|html)$/.test(f))) {
      const served = dir === 'showcase' ? ROOT : join(ROOT, dir);
      sources.push({ file: join(ROOT, 'docs', dir, name), base: name.endsWith('.html') ? served : join(ROOT, 'docs', dir) });
    }
  }
  let checked = 0;
  for (const { file: page, base } of sources) {
    for (const [, ref] of readFileSync(page, 'utf8').matchAll(/(?:from\s+|import\s+|href=|src=)['"]([./]*dist\/[^'"]+)['"]/g)) {
      const target = ref.startsWith('/') ? join(ROOT, ref) : resolve(base, ref);
      assert.ok(existsSync(target), `${page} loads ${ref}, which the build does not produce`);
      checked++;
    }
  }
  assert.ok(checked > 0);
});
