export type Size = 'small' | 'medium' | 'large';

const SIZE_ALIASES: Record<string, Size> = {
  sm: 'small',
  md: 'medium',
  lg: 'large',
};

// A child that declared a size keeps it; inherited copies clear when the host's size goes
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

// In place, so component CSS only needs the canonical selectors
export function canonicalizeSize (element: Element): void {
  const size = element.getAttribute('size');

  if (size && SIZE_ALIASES[size]) {
    element.setAttribute('size', SIZE_ALIASES[size]);
  }
}

// Unlike canonicalizeSize, leaves the element untouched
export function sizeName (element: Element, fallback: Size = 'medium'): Size {
  const raw = (element.getAttribute('size') || '').toLowerCase();

  if (SIZE_ALIASES[raw]) {
    return SIZE_ALIASES[raw];
  }

  return raw === 'small' || raw === 'medium' || raw === 'large' ? raw : fallback;
}
