import { clamp } from './motion.js';

// +1 toward the inline end, -1 back, 0 for any other key; RTL swaps the arrows
export function horizontalStep (key: string, rtl = false): number {
  if (key === 'ArrowRight') {
    return rtl ? -1 : +1;
  }

  if (key === 'ArrowLeft') {
    return rtl ? +1 : -1;
  }

  return 0;
}

export interface ListNavigateOptions {
  rtl?: boolean;
  wrap?: boolean;
  horizontal?: boolean;
  vertical?: boolean;
}

// -1 when the key doesn't navigate; vertical arrows ignore reading direction
export function listNavigate (
  key: string,
  index: number,
  count: number,
  { rtl = false, wrap = true, horizontal = true, vertical = true }: ListNavigateOptions = {},
): number {
  let delta = 0;

  if (horizontal) delta = horizontalStep(key, rtl);

  if (vertical && delta === 0) {
    if (key === 'ArrowDown') delta = +1;
    if (key === 'ArrowUp')   delta = -1;
  }

  if (key === 'Home') {
    return 0;
  }

  if (key === 'End') {
    return count - 1;
  }

  if (delta === 0 || count === 0) {
    return -1;
  }

  const next = index + delta;

  if (wrap) {
    return (next + count) % count;
  }

  return clamp(next, 0, count - 1);
}
