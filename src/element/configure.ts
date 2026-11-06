import { readScopedAxis }  from '../cascade/index.js';
import { parseQuality }    from '../resolve/index.js';
import type { Quality }    from '../resolve/index.js';
import { LOG_PREFIX }      from '../registry/tags.js';

// Only these spellings canonicalize; anything else stays as written so a typo shows
const QUALITY_SPELLINGS = new Set(['lo', 'low', 'md', 'med', 'medium', 'hi', 'high']);

// One warning per unknown feel per document, so an iframe warns separately
const warnedFeels = new WeakMap<Document, Set<string>>();

// Mirrors canonicalizeSize()
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

// The element attribute beats any ancestor scope
export function readQuality (el: Element): Quality {
  return parseQuality(el.getAttribute('quality') ?? readScopedAxis(el, 'quality'));
}

export function writeQuality (el: Element, value: Quality | string | null | undefined): void {
  if (value === null || value === undefined) {
    el.removeAttribute('quality');
    return;
  }

  const canonical = parseQuality(String(value));

  // A same-value write still re-enters attributeChangedCallback
  if (el.getAttribute('quality') !== canonical) {
    el.setAttribute('quality', canonical);
  }
}

export type NamedAxis = 'palette' | 'material';

// A blank attribute counts as absent
export function readNamedAxis (el: Element, axis: NamedAxis): string | null {
  const own = el.getAttribute(axis)?.trim();

  return own ? own : readScopedAxis(el, axis);
}

// Verbatim, like feel: names are looked up as written
export function writeNamedAxis (el: Element, axis: NamedAxis, value: string | null | undefined): void {
  if (value === null || value === undefined) {
    el.removeAttribute(axis);
    return;
  }

  if (el.getAttribute(axis) !== String(value)) {
    el.setAttribute(axis, String(value));
  }
}

// A pre-upgrade property shadows the accessor, so replay it through the setter; markup wins
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
  console.warn(`${LOG_PREFIX} unknown feel "${name}"; falling back to gel`);
}
