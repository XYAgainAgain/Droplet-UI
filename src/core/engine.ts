import { clamp } from '../utilities/index.js';
import { LOG_PREFIX } from '../registry/tags.js';

export interface DropletComponent {
  frame(dt: number): boolean;
  frameDt?: number;
  colorEasing?: boolean;
  lightMoving?: boolean;
}

class DropletEngine {

  private active = new Set<DropletComponent>();
  private running = false;
  private lastTime = 0;

  constructor () {
    this.loop = this.loop.bind(this);
  }

  wake (component: DropletComponent): void {
    this.active.add(component);

    if (!this.running) {
      this.running  = true;
      this.lastTime = performance.now();
      requestAnimationFrame(this.loop);
    }
  }

  drop (component: DropletComponent): void {
    this.active.delete(component);
  }

  // dt is capped so a background-tab pause never becomes one giant step
  loop (now: number): void {
    const dt = clamp((now - this.lastTime) / 1000, 0, 0.033);

    this.lastTime = now;

    for (const component of this.active) {
      let keep = false;

      // paintBody reads frameDt and re-raises colorEasing while a fill crossfades, lightMoving while caustics play
      component.frameDt     = dt;
      component.colorEasing = false;
      component.lightMoving = false;

      try {
        keep = component.frame(dt);
      } catch (error) {
        console.error(`${LOG_PREFIX} frame error`, error);
      }

      if (!keep && !component.colorEasing && !component.lightMoving) {
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
