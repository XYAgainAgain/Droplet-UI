// Inerts everything outside `el` and its ancestors; returns a restore function
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

// Moves `el` to body so no ancestor overflow, transform, or z-index clips it; returns an undo
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
