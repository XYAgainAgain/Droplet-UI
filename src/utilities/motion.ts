export function clamp (value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// Returns [position, velocity]; semi-implicit Euler, since a plain Euler step buzzes at the target
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

const motionQuery: MediaQueryList | null = typeof matchMedia === 'function'
  ? matchMedia('(prefers-reduced-motion: reduce)')
  : null;

// The root's data-droplet-motion overrides the OS setting
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

export function triggerHaptic (duration = 8): void {
  if (!('vibrate' in navigator)) {
    return;
  }

  try {
    navigator.vibrate(duration);
  } catch {
    // Throws without a gesture
  }
}
