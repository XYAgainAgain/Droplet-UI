import { isRTL }                from '../utilities/index.js';
import { prefersReducedMotion } from '../utilities/index.js';

export function springIn (el: HTMLElement, origin = 'center'): void {
  el.style.transformOrigin = origin;

  if (prefersReducedMotion() || !el.animate) {
    return;
  }

  el.animate(
    [
      { opacity: 0, transform: 'scale(0.92, 0.96)' },
      { opacity: 1, transform: 'scale(1.014, 0.997)', offset: 0.55 },
      { transform: 'scale(0.998, 1.002)', offset: 0.8 },
      { transform: 'scale(1)' },
    ],
    { duration: 420, easing: 'cubic-bezier(.16,.82,.28,1)' },
  );
}

// `done` always runs: after the exit, on cancel, or at once under reduced motion
export function springOut (el: HTMLElement, done: () => void): void {
  if (prefersReducedMotion() || !el.animate) {
    done();
    return;
  }

  const animation = el.animate(
    [
      { opacity: 1, transform: 'scale(1)' },
      { opacity: 0, transform: 'scale(0.92)' },
    ],
    { duration: 150, easing: 'ease-in' },
  );

  animation.onfinish = done;
  animation.oncancel = done;
}

export function toastIn (el: HTMLElement): void {
  const rtl  = isRTL(el);
  const from = rtl ? '-35%' : '35%';
  const past = rtl ? '1.5%' : '-1.5%';

  el.style.transformOrigin = rtl ? 'left center' : 'right center';

  if (prefersReducedMotion() || !el.animate) {
    return;
  }

  el.animate(
    [
      { opacity: 0, transform: `translateX(${from}) scale(0.9)` },
      { opacity: 1, transform: `translateX(${past}) scale(1.015)`, offset: 0.62 },
      { transform: 'translateX(0) scale(1)' },
    ],
    { duration: 480, easing: 'cubic-bezier(.16,.82,.28,1)' },
  );
}

export function toastOut (el: HTMLElement, done: () => void): void {
  const rtl = isRTL(el);
  const to  = rtl ? '-30%' : '30%';

  el.style.transformOrigin = rtl ? 'left center' : 'right center';

  if (prefersReducedMotion() || !el.animate) {
    done();
    return;
  }

  const animation = el.animate(
    [
      { opacity: 1, transform: 'translateX(0) scale(1)' },
      { opacity: 0, transform: `translateX(${to}) scale(0.92)` },
    ],
    { duration: 320, easing: 'cubic-bezier(.4,0,.5,1)' },
  );

  animation.onfinish = done;
  animation.oncancel = done;
}
