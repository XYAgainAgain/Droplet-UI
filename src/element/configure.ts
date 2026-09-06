// Shared axis plumbing for elements that read the droplet cascade. Nothing here
// touches the DOM until called with an element (import-purity.md).

import { readScopedAxis }  from '../cascade/index.js';
import { parseQuality }    from '../resolve/index.js';
import type { Quality }    from '../resolve/index.js';

// Only these spellings are rewritten to canonical form; anything else stays as
// the author wrote it so the typo stays visible (attribute-matrix.md).
const QUALITY_SPELLINGS = new Set(['lo', 'low', 'md', 'med', 'medium', 'hi', 'high']);

// One warning per unknown feel name per page, whichever element hits it first;
// keyed by document so an iframe gets its own warning (attribute-matrix.md)
const warnedFeels = new WeakMap<Document, Set<string>>();

// An alias is rewritten to canonical form the way canonicalizeSize() does;
// garbage is left alone so the author can see it (attribute-matrix.md)
export function canonicalizeQualityAttribute (el: Element): void {
  const raw = el.getAttribute('quality');

  if (raw === null) {
    return;
  }

  const spelling = raw.trim().toLowerCase();

  if (!QUALITY_SPELLINGS.has(spelling)) {
    return;
  }

  const canonical = parseQuality(spelling);

  if (raw !== canonical) {
    el.setAttribute('quality', canonical);
  }
}

// The effective rendering budget: the element attribute beats any ancestor scope
export function readQuality (el: Element): Quality {
  return parseQuality(el.getAttribute('quality') ?? readScopedAxis(el, 'quality'));
}

export function writeQuality (el: Element, value: Quality | string | null | undefined): void {
  if (value === null || value === undefined) {
    el.removeAttribute('quality');
    return;
  }

  const canonical = parseQuality(String(value));

  // Rewriting an attribute to the value it already has still re-enters
  // attributeChangedCallback, so skip it (state-and-reflection.md)
  if (el.getAttribute('quality') !== canonical) {
    el.setAttribute('quality', canonical);
  }
}

// A property set before upgrade shadows the accessor, so replay it through the
// setter; markup wins over the captured value (state-and-reflection.md)
export function replayProperties (el: Element, names: readonly string[]): void {
  const own = el as unknown as Record<string, unknown>;

  for (const name of names) {
    if (!Object.hasOwn(el, name)) {
      continue;
    }

    const captured = own[name];

    delete own[name];

    if (!el.hasAttribute(name)) {
      own[name] = captured;
    }
  }
}

export function warnUnknownFeel (name: string, doc: Document): void {
  let seen = warnedFeels.get(doc);

  if (!seen) {
    seen = new Set<string>();
    warnedFeels.set(doc, seen);
  }

  if (seen.has(name)) {
    return;
  }

  seen.add(name);
  console.warn(`[jelly] unknown feel "${name}"; falling back to gel`);
}
