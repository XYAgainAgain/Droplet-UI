import { isRTL } from '../utilities/index.js';

export type Placement = 'top' | 'bottom' | 'left' | 'right' | 'start' | 'end';

export type PhysicalPlacement = 'top' | 'bottom' | 'left' | 'right';

const VIEWPORT_MARGIN = 8;

export function resolvePlacement (placement: Placement, anchorEl: HTMLElement): PhysicalPlacement {
  if (placement !== 'start' && placement !== 'end') {
    return placement;
  }

  const rtl = isRTL(anchorEl);

  if (placement === 'start') {
    return rtl ? 'right' : 'left';
  }

  return rtl ? 'left' : 'right';
}

// Places a `position: fixed` float, flipping sides when the preferred one clips, then clamps to the viewport
export function placeAnchored (
  anchorEl: HTMLElement,
  floatEl: HTMLElement,
  placement: Placement = 'bottom',
  gap = 8,
): PhysicalPlacement {
  const side = resolvePlacement(placement, anchorEl);

  const a  = anchorEl.getBoundingClientRect();
  const f  = floatEl.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let resolved: PhysicalPlacement = side;

  if (side === 'top' && a.top - f.height - gap < VIEWPORT_MARGIN && a.bottom + f.height + gap < vh) {
    resolved = 'bottom';
  } else if (side === 'bottom' && a.bottom + f.height + gap > vh - VIEWPORT_MARGIN && a.top - f.height - gap > 0) {
    resolved = 'top';
  } else if (side === 'left' && a.left - f.width - gap < VIEWPORT_MARGIN && a.right + f.width + gap < vw) {
    resolved = 'right';
  } else if (side === 'right' && a.right + f.width + gap > vw - VIEWPORT_MARGIN && a.left - f.width - gap > 0) {
    resolved = 'left';
  }

  let top: number;
  let left: number;

  if (resolved === 'top')         top = a.top - f.height - gap;
  else if (resolved === 'bottom') top = a.bottom + gap;
  else                            top = a.top + (a.height - f.height) / 2;

  if (resolved === 'left')        left = a.left - f.width - gap;
  else if (resolved === 'right')  left = a.right + gap;
  else                            left = a.left + (a.width - f.width) / 2;

  left = Math.max(VIEWPORT_MARGIN, Math.min(vw - f.width - VIEWPORT_MARGIN, left));
  top  = Math.max(VIEWPORT_MARGIN, Math.min(vh - f.height - VIEWPORT_MARGIN, top));

  floatEl.style.left = `${Math.round(left)}px`;
  floatEl.style.top  = `${Math.round(top)}px`;

  // A transformed, filtered, or will-change ancestor contains position:fixed; correct by the landing offset
  const landed = floatEl.getBoundingClientRect();
  const dx     = left - landed.left;
  const dy     = top - landed.top;

  if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
    floatEl.style.left = `${Math.round(left + dx)}px`;
    floatEl.style.top  = `${Math.round(top + dy)}px`;
  }

  return resolved;
}

// Repins on scroll and resize; returns a cleanup. `onHidden` fires while the anchor is
// out of view, where returning focus to the trigger would scroll it back
export function trackAnchor (
  anchorEl: HTMLElement,
  floatEl: HTMLElement,
  placement: Placement = 'bottom',
  gap = 8,
  onHidden: (() => void) | null = null,
): () => void {
  const reposition = (): void => {
    placeAnchored(anchorEl, floatEl, placement, gap);

    if (onHidden) {
      const r = anchorEl.getBoundingClientRect();

      if (r.bottom <= 0 || r.top >= window.innerHeight
        || r.right <= 0 || r.left >= window.innerWidth) {
        onHidden();
      }
    }
  };

  window.addEventListener('scroll', reposition, true); // capture → catches nested scrollers
  window.addEventListener('resize', reposition);

  return () => {
    window.removeEventListener('scroll', reposition, true);
    window.removeEventListener('resize', reposition);
  };
}
