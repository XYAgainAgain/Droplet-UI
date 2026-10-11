/*
 * A loading placeholder that gently breathes: a soft-body wobble instead of a
 * shimmer, since the library is gradient-free
 */

import { DropletElement } from '../../element/index.js';
import type { Shape }   from '../../element/index.js';
import { defineStrict, TAGS } from '../../registry/index.js';
import type { DefineOptions, DefineResult } from '../../registry/index.js';

import skeletonStyles    from './skeleton.css?inline';

/**
 * A soft loading placeholder that gently breathes.
 *
 * @element droplet-skeleton
 *
 * @attr {"line"|"rect"|"square"|"circle"} shape - Placeholder silhouette preset.
 * @attr {string} feel - Registered feel preset driving the physics; inherits from a `data-droplet-feel` scope.
 * @attr {"low"|"medium"|"high"} quality - Caps physics cost (med/lo/hi aliases accepted); inherits from a `data-droplet-quality` scope.
 *
 * @cssprop [--droplet-fill] - Placeholder fill color.
 */
export class DropletSkeleton extends DropletElement {

  static define (options?: DefineOptions): DefineResult {
    return defineSkeleton(options);
  }

  static override usesResolver = true;

  // Randomized per instance so a page full of skeletons never pulses in lock-step
  phase = Math.random() * 1.5;
  timeAccumulator = Math.random() * 0.08;
  breath = Math.random() * 1.2;
  sweepSpeed = 0.7 + Math.random() * 0.35;
  breathEvery = 1.0 + Math.random() * 0.7;

  static get observedAttributes (): string[] {
    return ['shape', ...DropletElement.AXIS_ATTRIBUTES];
  }

  override styles (): string {
    return skeletonStyles;
  }

  override content (): string {
    return '';
  }

  // Lines and rects get gently rounded corners; circles go fully round
  override shape (width: number, height: number): Shape {
    const circle = this.getAttribute('shape') === 'circle';

    return {
      width,
      height,
      radius: circle ? Math.min(width, height) / 2 : Math.min(height / 2, 7),
    };
  }

  // A shape swap usually resizes the host and the ResizeObserver rebuilds; reshape
  // here for same-size swaps (inline width/height), or a radius-only change is lost
  attributeChangedCallback (name: string): void {
    if (this.axisAttributeChanged(name)) {
      return;
    }

    if (this.built) {
      this.reshapeMembrane();
    }
  }

  override onBuilt (): void {
    this.setAttribute('role', 'status');
    this.setAttribute('aria-busy', 'true');

    if (!this.hasAttribute('aria-label')) {
      this.setAttribute('aria-label', 'Loading');
    }
  }

  override frame (dt: number): boolean {
    const body = this.body;

    if (!body) {
      return false;
    }

    if (this.reducedMotion) {
      this.clearCanvas();
      this.paintBody(body, { fill: this.fill() });
      return false;
    }

    const w = body.width;
    const h = body.height;

    // A ripple sweeps across in place of a shimmer, then rests before the next sweep
    this.phase           = (this.phase + dt * this.sweepSpeed) % 1.5;
    this.timeAccumulator += dt;

    if (this.timeAccumulator > 0.08 && this.phase <= 1) {
      this.timeAccumulator = 0;

      const x = -w / 2 + this.phase * w;

      body.pulseAt(x, -h / 2, 0.16);
      body.pulseAt(x, h / 2, 0.1);
    }

    // A slow breath keeps the parts between sweeps soft, never frozen
    this.breath += dt;

    if (this.breath > this.breathEvery) {
      this.breath      = 0;
      this.breathEvery = 1.0 + Math.random() * 0.7;

      body.centerPop(0.16);
    }

    body.update(dt);
    this.clearCanvas();
    this.paintBody(body, { fill: this.fill(), alpha: 0.82 });

    return true;
  }

}

export function defineSkeleton (options: DefineOptions = {}): DefineResult {
  return defineStrict([[TAGS.skeleton, DropletSkeleton]], options);
}

declare global {
  interface HTMLElementTagNameMap {
    'droplet-skeleton': DropletSkeleton;
  }
}
