/*
 * ARIA forwarding from a roleless host onto the native control inside its
 * shadow root. IDREF attributes cannot resolve light-DOM ids from inside the
 * shadow tree, so they cross as element references instead: a shadow element
 * may reference elements in its ancestor scopes, never the other way round.
 * Setting ariaControlsElements and friends writes an empty content attribute
 * (aria-controls="") on the inner element; that is the platform's design.
 */

// IDREF attributes and the element-reflection property each one crosses as
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

// Global states and properties a host may carry for its inner control. aria-hidden and
// aria-live/atomic/relevant stay on the host: as the control's ancestor they already apply natively.
export const FORWARDED_ARIA: readonly string[] = [
  'aria-activedescendant', 'aria-autocomplete', 'aria-busy', 'aria-controls',
  'aria-current', 'aria-describedby', 'aria-description', 'aria-details',
  'aria-disabled', 'aria-errormessage', 'aria-expanded', 'aria-flowto',
  'aria-haspopup', 'aria-invalid', 'aria-keyshortcuts', 'aria-label',
  'aria-labelledby', 'aria-owns', 'aria-pressed', 'aria-required',
  'aria-roledescription',
];

// Resolve a space-separated id list in the host's own tree scope
export function resolveIdRefs (host: Element, value: string): Element[] {
  const root = host.getRootNode() as Document | ShadowRoot;
  const find = typeof root.getElementById === 'function'
    ? (id: string) => root.getElementById(id)
    : (id: string) => host.ownerDocument.getElementById(id);

  return value.split(/\s+/).filter(Boolean)
    .map(find)
    .filter((el): el is HTMLElement => el !== null);
}

// Mirror one host aria-* attribute onto the inner control; IDREFs go by reference
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

  // The host's own reflection resolves an IDREF attribute and explicitly set elements alike, live
  // in its tree scope; parsing the attribute would read the "" that explicit elements leave behind
  if (prop in host) {
    reflect[prop] = (host as unknown as Record<string, Element | readonly Element[] | null>)[prop] ?? null;
    return;
  }

  const refs = value === null ? null : resolveIdRefs(host, value);

  reflect[prop] = prop.endsWith('Elements') ? refs : (refs?.[0] ?? null);
}

// Forward every aria-* attribute the host currently carries
export function forwardAllAria (host: Element, target: Element, names: readonly string[] = FORWARDED_ARIA): void {
  for (const name of names) {
    if (host.hasAttribute(name)) {
      forwardAria(host, target, name);
    }
  }
}

// Forward on connect, once more when parsing reaches later ids, and on focusin so a target inserted
// since links before assistive technology reads the control. Only the host's own tree scope, like native.
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

  // Drops both listeners, so a detached host is never retained by its document
  disconnect (): void {
    this.controller?.abort();
    this.controller = null;
  }

}
