/*
 * Modal DOM plumbing: inert everything behind an open overlay so focus and
 * screen readers stay trapped, and portal an element to <body> so no ancestor
 * overflow / transform / z-index can clip or trap it.
 */

/*
 * Make everything except `el` and its ancestors inert - pulled out of the
 * tab order and the accessibility tree - so a modal truly traps focus and
 * screen readers can't wander behind it. Returns a restore function.
 */
export function inertOutside (el: HTMLElement): () => void {
  const changed: HTMLElement[] = [];

  let node: HTMLElement | null = el;

  while (node && node.parentElement && node !== document.body) {
    for (const sibling of node.parentElement.children) {
      if (sibling === node || (sibling as HTMLElement).inert) continue;
      if (sibling.tagName === 'SCRIPT' || sibling.tagName === 'STYLE') continue;

      (sibling as HTMLElement).inert = true;
      changed.push(sibling as HTMLElement);
    }

    node = node.parentElement;
  }

  return () => {
    for (const sibling of changed) {
      sibling.inert = false;
    }
  };
}

/*
 * Move an element to document.body while it is open, so no ancestor
 * overflow / transform / z-index can clip or trap it. Returns a restore
 * function that puts it back exactly where it came from.
 */
export function portalToBody (el: HTMLElement): () => void {
  if (el.parentNode === document.body) {
    return () => {};
  }

  const parent = el.parentNode;

  if (!parent) {
    return () => {};
  }

  const marker = document.createComment('droplet-portal');

  parent.insertBefore(marker, el);
  document.body.appendChild(el);

  return () => {
    if (marker.parentNode) {
      marker.parentNode.insertBefore(el, marker);
    }

    marker.remove();
  };
}
