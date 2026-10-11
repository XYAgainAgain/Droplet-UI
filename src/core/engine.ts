/*
 * The shared animation engine: one requestAnimationFrame loop drives every
 * live component (anything with frame(dt) -> boolean), parking itself when they
 * all report done and waking on demand.
 */

import { clamp } from '../utilities/index.js';
import { LOG_PREFIX } from '../registry/tags.js';

// The surface the engine drives - DropletElement satisfies this structurally
export interface DropletComponent {
  frame(dt: number): boolean;
  frameDt?: number;
  colorEasing?: boolean;
}

class DropletEngine {

  private active = new Set<DropletComponent>();
  private running = false;
  private lastTime = 0;

  constructor () {
    this.loop = this.loop.bind(this);
  }

  // Add a component to the loop and start it if it was parked
  wake (component: DropletComponent): void {
    this.active.add(component);

    if (!this.running) {
      this.running  = true;
      this.lastTime = performance.now();
      requestAnimationFrame(this.loop);
    }
  }

  // Remove a component from the loop (used on disconnect)
  drop (component: DropletComponent): void {
    this.active.delete(component);
  }

  // One shared animation frame: step every live component, park when idle.
  // The delta is capped so a background-tab pause never becomes one giant step.
  loop (now: number): void {
    const dt = clamp((now - this.lastTime) / 1000, 0, 0.033);

    this.lastTime = now;

    for (const component of this.active) {
      let keep = false;

      // Expose the frame delta to paintBody's colour easing and reset the
      // per-frame "still easing" flag the base class raises while a fill is
      // crossfading - so a component stays awake until its colours settle.
      component.frameDt     = dt;
      component.colorEasing = false;

      try {
        keep = component.frame(dt);
      } catch (error) {
        console.error(`${LOG_PREFIX} frame error`, error);
      }

      if (!keep && !component.colorEasing) {
        this.active.delete(component);
      }
    }

    if (this.active.size > 0) {
      requestAnimationFrame(this.loop);
    } else {
      this.running = false;
    }
  }

}

export const engine = new DropletEngine();
