// Scope attributes become inline custom properties so shadow roots and later insertions
// resolve through the cascade instead of closest() or per-element observers.

export type Axis = 'feel' | 'material' | 'palette' | 'quality' | 'substance';

export const AXES: ReadonlyArray<Axis> = ['feel', 'material', 'palette', 'quality', 'substance'];

export const SCOPE_CHANGE_EVENT = 'droplet-scope-change';

const ATTRIBUTES: ReadonlyArray<string> = AXES.map((axis) => `data-droplet-${axis}`);
const SELECTOR = ATTRIBUTES.map((name) => `[${name}]`).join(',');

const installed = new WeakSet<Document>();
const generations = new WeakMap<Document, number>();

const axisOf = (attribute: string): Axis | null => {
  const axis = attribute.slice('data-droplet-'.length) as Axis;
  return AXES.includes(axis) ? axis : null;
};

// Reads the attribute live rather than trusting the record's oldValue, so a
// set-then-remove batch settles on the final state whatever order records arrive in.
function apply (el: Element, axis: Axis): void {
  const style = (el as Partial<ElementCSSInlineStyle>).style;
  if (!style) return;
  const value = el.getAttribute(`data-droplet-${axis}`);
  if (value === null) {
    style.removeProperty(`--droplet-${axis}`);
  } else {
    style.setProperty(`--droplet-${axis}`, value);
  }
}

// Returns whether anything in the subtree (root included) carried a scope attribute
function applyTree (root: Element): boolean {
  let touched = false;
  for (const el of [root, ...root.querySelectorAll(SELECTOR)]) {
    if (!el.matches(SELECTOR)) continue;
    for (const axis of AXES) apply(el, axis);
    touched = true;
  }
  return touched;
}

// The custom property is the authority once the bridge has run; closest() covers
// the first connect, where a scope inserted with its children is still unbridged.
export function readScopedAxis (el: Element, axis: Axis): string | null {
  const view = el.ownerDocument.defaultView;
  const value = view ? view.getComputedStyle(el).getPropertyValue(`--droplet-${axis}`).trim() : '';
  if (value !== '') return value;
  const authored = el.closest(`[data-droplet-${axis}]`)?.getAttribute(`data-droplet-${axis}`)?.trim();
  return authored === undefined || authored === '' ? null : authored;
}

export function installScopeBridge (doc: Document): void {
  if (installed.has(doc)) return;
  installed.add(doc);
  generations.set(doc, 0);

  for (const el of doc.querySelectorAll(SELECTOR)) {
    for (const axis of AXES) apply(el, axis);
  }

  const observer = new MutationObserver((records) => {
    let touched = false;
    for (const record of records) {
      if (record.type === 'childList') {
        for (const node of record.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE && applyTree(node as Element)) touched = true;
        }
        continue;
      }
      const name = record.attributeName;
      if (name === null) continue;
      const axis = axisOf(name);
      if (axis === null) continue;
      apply(record.target as Element, axis);
      touched = true;
    }
    if (!touched) return;
    const generation = (generations.get(doc) ?? 0) + 1;
    generations.set(doc, generation);
    doc.dispatchEvent(new CustomEvent(SCOPE_CHANGE_EVENT, { detail: { generation } }));
  });
  // childList too: attributeFilter records say nothing about elements that arrive
  // already carrying a scope attribute, which the initial scan has long missed.
  observer.observe(doc, { attributes: true, childList: true, subtree: true, attributeFilter: [...ATTRIBUTES] });
}

export function onScopeChange (doc: Document, callback: () => void): () => void {
  const listener = (): void => callback();
  doc.addEventListener(SCOPE_CHANGE_EVENT, listener);
  return () => doc.removeEventListener(SCOPE_CHANGE_EVENT, listener);
}
