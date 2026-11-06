// IDREFs can't reach light-DOM ids from the shadow tree, so they cross as element references.
// The aria-controls="" that leaves on the inner element is platform behavior.
const ELEMENT_REFS: Record<string, string> = {
  'aria-activedescendant': 'ariaActiveDescendantElement',
  'aria-controls':         'ariaControlsElements',
  'aria-describedby':      'ariaDescribedByElements',
  'aria-details':          'ariaDetailsElements',
  'aria-errormessage':     'ariaErrorMessageElements',
  'aria-flowto':           'ariaFlowToElements',
  'aria-labelledby':       'ariaLabelledByElements',
  'aria-owns':             'ariaOwnsElements',
};

// aria-hidden and aria-live/atomic/relevant stay on the host, where they apply as an ancestor
export const FORWARDED_ARIA: readonly string[] = [
  'aria-activedescendant', 'aria-autocomplete', 'aria-busy', 'aria-controls',
  'aria-current', 'aria-describedby', 'aria-description', 'aria-details',
  'aria-disabled', 'aria-errormessage', 'aria-expanded', 'aria-flowto',
  'aria-haspopup', 'aria-invalid', 'aria-keyshortcuts', 'aria-label',
  'aria-labelledby', 'aria-owns', 'aria-pressed', 'aria-required',
  'aria-roledescription',
];

export function resolveIdRefs (host: Element, value: string): Element[] {
  const root = host.getRootNode() as Document | ShadowRoot;
  const find = typeof root.getElementById === 'function'
    ? (id: string) => root.getElementById(id)
    : (id: string) => host.ownerDocument.getElementById(id);

  return value.split(/\s+/).filter(Boolean)
    .map(find)
    .filter((el): el is HTMLElement => el !== null);
}

export function forwardAria (host: Element, target: Element, name: string): void {
  const value = host.getAttribute(name);
  const prop  = ELEMENT_REFS[name];

  if (!prop) {
    if (value === null) {
      target.removeAttribute(name);
    } else if (target.getAttribute(name) !== value) {
      target.setAttribute(name, value);
    }
    return;
  }

  // An engine without ARIA element reflection gets nothing rather than a dead IDREF
  if (!(prop in target)) {
    return;
  }

  const reflect = target as unknown as Record<string, Element | readonly Element[] | null>;

  // Read the host's reflection: explicitly set elements leave "" for an attribute parse
  if (prop in host) {
    reflect[prop] = (host as unknown as Record<string, Element | readonly Element[] | null>)[prop] ?? null;
    return;
  }

  const refs = value === null ? null : resolveIdRefs(host, value);

  reflect[prop] = prop.endsWith('Elements') ? refs : (refs?.[0] ?? null);
}

export function forwardAllAria (host: Element, target: Element, names: readonly string[] = FORWARDED_ARIA): void {
  for (const name of names) {
    if (host.hasAttribute(name)) {
      forwardAria(host, target, name);
    }
  }
}

// Re-forwards on focusin, and at DOMContentLoaded while parsing, to link targets inserted later
export class AriaLink {

  host: HTMLElement;
  forward: () => void;
  controller: AbortController | null = null;

  constructor (host: HTMLElement, forward: () => void) {
    this.host    = host;
    this.forward = forward;
  }

  connect (): void {
    this.disconnect();

    const controller = this.controller = new AbortController();
    const doc        = this.host.ownerDocument;

    this.forward();

    if (doc.readyState === 'loading') {
      doc.addEventListener('DOMContentLoaded', () => this.forward(), { once: true, signal: controller.signal });
    }

    this.host.addEventListener('focusin', () => this.forward(), { signal: controller.signal });
  }

  // So the document never retains a detached host
  disconnect (): void {
    this.controller?.abort();
    this.controller = null;
  }

}
