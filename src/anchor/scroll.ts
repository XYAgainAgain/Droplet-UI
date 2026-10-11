/*
 * Background scroll lock for modal overlays, ref-counted so stacked modals
 * share one lock, with scrollbar-gap compensation so the page never jumps.
 */

let scrollLocks        = 0;
let savedScrollPadding = '';

// Freeze background scroll, compensating for the vanished scrollbar so the
// page doesn't jump (padding-inline-end lands on the scrollbar side in RTL too)
export function lockScroll (): void {
  if (scrollLocks++ > 0) {
    return;
  }

  const barWidth = window.innerWidth - document.documentElement.clientWidth;

  savedScrollPadding           = document.body.style.paddingInlineEnd;
  document.body.style.overflow = 'hidden';

  if (barWidth > 0) {
    document.body.style.paddingInlineEnd = `${barWidth}px`;
  }
}

export function unlockScroll (): void {
  if (scrollLocks === 0) {
    return;
  }

  if (--scrollLocks > 0) {
    return;
  }

  document.body.style.overflow         = '';
  document.body.style.paddingInlineEnd = savedScrollPadding;
}
