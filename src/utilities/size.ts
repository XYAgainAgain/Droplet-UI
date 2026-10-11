export type Size = 'small' | 'medium' | 'large';

// Short aliases accepted for input
const SIZE_ALIASES: Record<string, Size> = {
  sm: 'small',
  md: 'medium',
  lg: 'large',
};

// Lets a container size its items in one place, clearing the copy when the host's size is
// removed. Children that declared their own size are left alone.
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

// Rewrites the sm/md/lg aliases in place, so component CSS only needs the canonical selectors
export function canonicalizeSize (element: Element): void {
  const size = element.getAttribute('size');

  if (size && SIZE_ALIASES[size]) {
    element.setAttribute('size', SIZE_ALIASES[size]);
  }
}

// Resolves sm/md/lg without mutating the element, for components that key geometry off the size.
// Falls back when the attribute is absent or unrecognized.
export function sizeName (element: Element, fallback: Size = 'medium'): Size {
  const raw = (element.getAttribute('size') || '').toLowerCase();

  if (SIZE_ALIASES[raw]) {
    return SIZE_ALIASES[raw];
  }

  return raw === 'small' || raw === 'medium' || raw === 'large' ? raw : fallback;
}
