export function clamp (value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// Returns the new [position, velocity]. Semi-implicit Euler (velocity updates first, then drives
// the position) settles toward the target without the buzzing a plain Euler step gives.
export function integrateSpring (
  position: number,
  velocity: number,
  target: number,
  stiffness: number,
  damping: number,
  dt: number,
): [number, number] {
  const acceleration = (target - position) * stiffness - velocity * damping;
  const nextVelocity = velocity + acceleration * dt;

  return [position + nextVelocity * dt, nextVelocity];
}

// Created once at load and kept live, so reads never re-query
const motionQuery: MediaQueryList | null = typeof matchMedia === 'function'
  ? matchMedia('(prefers-reduced-motion: reduce)')
  : null;

// True when the user asked the OS to reduce motion (checked live), or when a
// page explicitly opts into the same behavior for an in-page preview.
export function prefersReducedMotion (): boolean {
  const root = typeof document !== 'undefined' ? document.documentElement : null;
  const override = root
    ? root.getAttribute('data-droplet-motion') ?? root.getAttribute('data-jelly-motion')
    : null;

  if (override === 'reduce') {
    return true;
  }

  if (override === 'no-preference') {
    return false;
  }

  return motionQuery ? motionQuery.matches : false;
}

// A tiny vibration on devices that support it, so pressing a soft body feels physical
export function triggerHaptic (duration = 8): void {
  if (!('vibrate' in navigator)) {
    return;
  }

  try {
    navigator.vibrate(duration);
  } catch {
    // Some browsers throw when called without a user gesture; feedback is optional
  }
}
