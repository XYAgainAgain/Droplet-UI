/*
 * Build docs/content/data.js from the hand-authored docs/content/content.js, reconciled
 * against custom-elements.json (the manifest `cem analyze` emits). The manifest decides which
 * members exist and their types; content.js supplies the prose, defaults, and examples. Drift
 * either way becomes a warning. Run via `npm run docs`, which runs `cem analyze` first.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { GROUP_ORDER, COMPONENTS } from '../docs/content/content.js';
import { documentationWarningsFailBuild } from './docs-drift.mjs';

const root         = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = resolve(root, 'custom-elements.json');
const outputPath   = resolve(root, 'docs/content/data.js');

// Load the manifest, indexed by tag name

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

const elements = new Map();

for (const module of manifest.modules ?? []) {
  for (const declaration of module.declarations ?? []) {
    if (declaration.customElement && declaration.tagName) {
      elements.set(declaration.tagName, declaration);
    }
  }
}

// Reconcile one list against the manifest

const warnings = [];

// aria-* and role are host-forwarding implementation detail, not public API
const isInternalAttribute = (name) => name.startsWith('aria-') || name === 'role';

// CSS parts provided by the DropletElement base class, so a canvas component may
// document them without repeating the JSDoc.
const BASE_PARTS = new Set(['droplet']);

// The canvas also answers to ::part(jelly), a legacy alias documented only on /migration/
const LEGACY_PARTS = new Set(['jelly']);

// The manifest names the default slot ""; the docs label it "(default)".
const normalizeSlot = (name) => (name === '' ? '(default)' : name);

function reconcile (tag, kind, manItems, contentItems, { includeType = false } = {}) {
  const key     = kind === 'slot' ? normalizeSlot : (name) => name;
  const content = new Map((contentItems ?? []).map((item) => [key(item.name), item]));
  const seen    = new Set();
  const merged  = [];

  for (const manItem of manItems ?? []) {
    if (kind === 'attribute' && isInternalAttribute(manItem.name)) {
      continue;
    }

    if (kind === 'part' && LEGACY_PARTS.has(manItem.name)) {
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
      entry.type = manItem.type?.text ?? curated?.type;
      if (entry.type === undefined) delete entry.type;
    }

    if (curated?.default !== undefined) {
      entry.default = curated.default;
    }

    entry.description = curated?.description ?? manItem.description ?? '';

    merged.push(entry);
  }

  // Documented but missing from the manifest means stale, except the base-class
  // parts every canvas component inherits
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
 * CSS custom properties are content-authoritative (tokens and defaults live in the
 * component .css), so no `@cssprop` is required. Any `@cssprop` the source does
 * declare that content.js forgot is still reported.
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

// Build each component descriptor

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

// Emit docs/content/data.js

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

// Report

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
