/*
 * Build docs/content/data.js from the hand-authored docs/content/content.js, reconciled
 * against custom-elements.json (the Custom Elements Manifest emitted by
 * `cem analyze` from the component TypeScript + JSDoc).
 *
 * The manifest is the source of truth for which attributes, events, slots,
 * CSS parts and CSS custom properties a component actually exposes, plus their
 * types. The content file supplies the curated prose. This script merges them:
 *
 *   - Types for attributes come from the manifest (falling back to any type
 *     the content already specifies) so they can't drift from the source.
 *   - Descriptions, defaults, examples, keyboard maps, methods and properties
 *     come from the content file.
 *   - Every manifest member that isn't documented in content, and every
 *     documented member the manifest no longer has, is reported as a warning
 *     so the docs stay honest. `internal` ARIA-forwarding attributes
 *     (aria-*) are ignored - they are implementation detail, not public API.
 *
 * Run via `npm run docs` (which runs `cem analyze` first) or directly with
 * `node scripts/build-docs-data.mjs`.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { GROUP_ORDER, COMPONENTS } from '../docs/content/content.js';
import { documentationWarningsFailBuild } from './docs-drift.mjs';

const root         = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = resolve(root, 'custom-elements.json');
const outputPath   = resolve(root, 'docs/content/data.js');

// ---- Load the manifest, indexed by tag name --------------------------------

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

const elements = new Map();

for (const module of manifest.modules ?? []) {
  for (const declaration of module.declarations ?? []) {
    if (declaration.customElement && declaration.tagName) {
      elements.set(declaration.tagName, declaration);
    }
  }
}

// ---- Reconcile one list against the manifest -------------------------------

const warnings = [];

// Attributes whose names begin with a reserved prefix are host-forwarding
// implementation detail, never part of the documented public surface.
const isInternalAttribute = (name) => name.startsWith('aria-') || name === 'role';

// CSS parts provided by the JellyElement base class (defined once in
// element.ts, not re-declared per component), so a canvas component may
// legitimately document them even though its own JSDoc doesn't repeat them.
const BASE_PARTS = new Set(['jelly']);

// The manifest names the default slot ""; the docs label it "(default)".
const normalizeSlot = (name) => (name === '' ? '(default)' : name);

/*
 * Merge a curated list with the manifest's view of the same surface. `manItems`
 * is the manifest array; `contentItems` the curated array; both key on `name`.
 * The manifest defines membership and order; content supplies the prose. Types
 * are taken from the manifest when present. Drift is collected as warnings.
 */
function reconcile (tag, kind, manItems, contentItems, { includeType = false } = {}) {
  const key     = kind === 'slot' ? normalizeSlot : (name) => name;
  const content = new Map((contentItems ?? []).map((item) => [key(item.name), item]));
  const seen    = new Set();
  const merged  = [];

  for (const manItem of manItems ?? []) {
    if (kind === 'attribute' && isInternalAttribute(manItem.name)) {
      continue;
    }

    const name = key(manItem.name);
    seen.add(name);

    const curated = content.get(name);

    if (!curated) {
      warnings.push(`${tag}: ${kind} "${name}" is in the source but not documented in content.js`);
    }

    const entry = { name };

    if (includeType) {
      // Prefer the source's type; fall back to any prose type the content set
      entry.type = manItem.type?.text ?? curated?.type;
      if (entry.type === undefined) delete entry.type;
    }

    if (curated?.default !== undefined) {
      entry.default = curated.default;
    }

    entry.description = curated?.description ?? manItem.description ?? '';

    merged.push(entry);
  }

  // Anything documented that the manifest no longer exposes is stale - unless
  // it is a base-class part every canvas component inherits.
  for (const item of contentItems ?? []) {
    const name = key(item.name);

    if (seen.has(name)) {
      continue;
    }

    if (kind === 'part' && BASE_PARTS.has(name)) {
      merged.push(item);
      continue;
    }

    if (kind === 'attribute' && isInternalAttribute(name)) {
      continue;
    }

    warnings.push(`${tag}: ${kind} "${name}" is documented in content.js but not found in the source`);
    merged.push(item); // keep it so the docs page still renders; the warning flags it
  }

  return merged;
}

/*
 * CSS custom properties are content-authoritative: the tokens live in the
 * component's .css file (their default values with them), and the curated
 * theming API + prose live here - so we don't force a redundant `@cssprop`
 * for each. We still surface any `@cssprop` the source DOES declare that the
 * content forgot, so a newly-documented token can't slip through undocumented.
 */
function reconcileCssProperties (tag, manProps, contentProps) {
  const documented = new Set((contentProps ?? []).map((prop) => prop.name));

  for (const manProp of manProps ?? []) {
    if (!documented.has(manProp.name)) {
      warnings.push(`${tag}: CSS property "${manProp.name}" is declared with @cssprop but not documented in content.js`);
    }
  }

  return contentProps ?? [];
}

// Events carry an optional detail payload shape alongside their description
function reconcileEvents (tag, manEvents, contentEvents) {
  const content = new Map((contentEvents ?? []).map((event) => [event.name, event]));
  const seen    = new Set();
  const merged  = [];

  for (const manEvent of manEvents ?? []) {
    seen.add(manEvent.name);

    const curated = content.get(manEvent.name);

    if (!curated) {
      warnings.push(`${tag}: event "${manEvent.name}" is in the source but not documented in content.js`);
    }

    const entry = { name: manEvent.name, description: curated?.description ?? manEvent.description ?? '' };

    if (curated?.detail !== undefined) {
      entry.detail = curated.detail;
    }

    merged.push(entry);
  }

  for (const event of contentEvents ?? []) {
    if (!seen.has(event.name)) {
      warnings.push(`${tag}: event "${event.name}" is documented in content.js but not emitted by the source`);
      merged.push(event);
    }
  }

  return merged;
}

// ---- Build each component descriptor ---------------------------------------

const built = COMPONENTS.map((component) => {
  const element = elements.get(component.tag);

  if (!element) {
    warnings.push(`${component.tag}: documented in content.js but has no custom element in the manifest`);
    return component;
  }

  return {
    tag:           component.tag,
    group:         component.group,
    summary:       component.summary,
    description:   component.description,
    attributes:    reconcile(component.tag, 'attribute', element.attributes, component.attributes, { includeType: true }),
    events:        reconcileEvents(component.tag, element.events, component.events),
    properties:    component.properties ?? [],
    methods:       component.methods ?? [],
    slots:         reconcile(component.tag, 'slot', element.slots, component.slots),
    parts:         reconcile(component.tag, 'part', element.cssParts, component.parts),
    cssProperties: reconcileCssProperties(component.tag, element.cssProperties, component.cssProperties),
    keyboard:      component.keyboard ?? [],
    examples:      component.examples ?? [],
  };
});

// Every manifest element should be documented somewhere
for (const tag of elements.keys()) {
  if (!COMPONENTS.some((component) => component.tag === tag)) {
    warnings.push(`${tag}: exists in the source but is not documented in content.js`);
  }
}

// ---- Emit docs/content/data.js -----------------------------------------------------

const header = `/*
 * GENERATED FILE — do not edit by hand.
 *
 * Built by scripts/build-docs-data.mjs from docs/content/content.js, reconciled
 * against custom-elements.json. Edit docs/content/content.js and run \`npm run docs\`.
 */

// The order component groups appear in the sidebar and on the page
export const GROUP_ORDER = ${JSON.stringify(GROUP_ORDER)};

export const COMPONENTS = ${JSON.stringify(built, null, 2)};
`;

writeFileSync(outputPath, header);

// ---- Report ----------------------------------------------------------------

if (warnings.length) {
  console.warn(`\n⚠ ${warnings.length} documentation drift warning(s):`);
  for (const warning of warnings) {
    console.warn(`  - ${warning}`);
  }
  console.warn('');
}

if (documentationWarningsFailBuild(warnings.length)) {
  console.error('✗ Documentation build failed because four or more API drift warnings require correction.');
  process.exitCode = 1;
}

console.log(`✓ Wrote docs/content/data.js — ${built.length} components from the manifest.`);
