/*
 * The canonical size scale (small / medium / large) plus helpers to
 * normalize, read and propagate it across a component and its children.
 */

// The canonical size scale every sizeable component renders on
export type Size = 'small' | 'medium' | 'large';

// The canonical size scale, plus the short aliases we accept for input
const SIZE_ALIASES: Record<string, Size> = {
  sm: 'small',
  md: 'medium',
  lg: 'large',
};

/*
 * Copy the host's size attribute onto matching children (and clear it again
 * when the host's size is removed), so container components like the radio
 * group and the accordion can size their items in one place. Children that
 * declared their own size are left alone.
 */
export function propagateSize (host: Element, selector: string): void {
  const size = host.getAttribute('size');

  for (const child of host.querySelectorAll(selector)) {
    const inherited = child.hasAttribute('data-droplet-inherited-size');

    if (size) {
      if (!child.hasAttribute('size') || inherited) {
        child.setAttribute('size', size);
        child.setAttribute('data-droplet-inherited-size', '');
      }
    } else if (inherited) {
      child.removeAttribute('size');
      child.removeAttribute('data-droplet-inherited-size');
    }
  }
}

/*
 * Normalize the host's size attribute onto the documented scale
 * (small / medium / large), rewriting the sm / md / lg aliases in place
 * so component CSS only ever needs the canonical selectors.
 */
export function canonicalizeSize (element: Element): void {
  const size = element.getAttribute('size');

  if (size && SIZE_ALIASES[size]) {
    element.setAttribute('size', SIZE_ALIASES[size]);
  }
}

// The canonical size name for an element, resolving sm / md / lg aliases,
// without mutating it (for components that key geometry off the size). Falls
// back to the given default when the attribute is absent or unrecognized.
export function sizeName (element: Element, fallback: Size = 'medium'): Size {
  const raw = (element.getAttribute('size') || '').toLowerCase();

  if (SIZE_ALIASES[raw]) {
    return SIZE_ALIASES[raw];
  }

  return raw === 'small' || raw === 'medium' || raw === 'large' ? raw : fallback;
}
