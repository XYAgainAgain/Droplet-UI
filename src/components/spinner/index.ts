/*
 * Loading indicators with a jelly soul. Two types:
 *
 *   <jelly-spinner></jelly-spinner>              a gooey blob gliding between 3 dots
 *   <jelly-spinner type="blob"></jelly-spinner>  a living blob that morphs + spins
 *
 * Size with the size attribute (or width/height on the host). Honors
 * prefers-reduced-motion by settling into something calm and static.
 */

import { DropletElement } from '../../element/index.js';
import type { Shape }   from '../../element/index.js';

import { uniqueId }     from '../../utilities/index.js';
import { defineStrict, TAGS } from '../../registry/index.js';
import type { DefineOptions, DefineResult } from '../../registry/index.js';

import spinnerStyles    from './spinner.css?inline';
import variantStyles    from '../../styles/variants.css?inline';

/**
 * A loading spinner: gooey travelling dots (default) or a morphing blob.
 *
 * @element jelly-spinner
 *
 * @attr {"dots"|"blob"} type - Spinner flavor.
 * @attr {"small"|"medium"|"large"} size - Spinner size.
 * @attr {string} label - Accessible loading label (defaults to "Loading").
 * @attr {"white"|"rose"|"amber"|"azure"|"mint"|"platinum"|"graphite"} variant - Fill hue.
 * @attr {string} feel - Registered feel preset driving the physics; inherits from a `data-droplet-feel` scope.
 * @attr {"low"|"medium"|"high"} quality - Caps physics cost (med/lo/hi aliases accepted); inherits from a `data-droplet-quality` scope.
 *
 * @cssprop [--jelly-fill] - Dot / blob color.
 */
export class DropletSpinner extends DropletElement {

  static define (options?: DefineOptions): DefineResult {
    return defineSpinner(options);
  }

  static override usesResolver = true;

  timeAccumulator = 0;
  idx = 0;
  angle = 0;
  instanceId = uniqueId('droplet-spinner-goo');

  // Tells the browser to trigger attributeChangedCallback when these attributes change
  static get observedAttributes (): string[] {
    return ['type', 'variant', 'size', 'label', ...DropletElement.AXIS_ATTRIBUTES];
  }

  // Lifecycle method: Fires when observed HTML attributes change dynamically
  attributeChangedCallback (name: string): void {
    if (this.axisAttributeChanged(name)) {
      return;
    }

    if (!this.built) {
      return;
    }

    switch (name) {
      case 'type':
        // blob and dots are different markup + geometry; re-render the content
        // and clear the old surface. The host's CSS size flip drives the body
        // reshape through the ResizeObserver.
        this.shadowRoot!.querySelector('.jelly-content')!.innerHTML = this.content();
        this.clearCanvas();
        break;

      case 'size':
        this.applyShape();
        break;

      case 'label':
        this.setAttribute('aria-label', this.getAttribute('label') || 'Loading');
        break;
    }

    this.requestFrame();
  }

  // The spinner flavor: gooey dots (default) or a morphing blob
  get type (): string {
    return this.getAttribute('type') || 'dots';
  }

  // Component styles layered over the shared jelly base styles
  override styles (): string {
    return variantStyles + spinnerStyles;
  }

  // Dots render as gooey SVG; the blob is pure canvas
  override content (): string {
    if (this.type === 'dots') {
      return `
        <svg class="dots" viewBox="0 0 42 18" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          <defs>
            <filter id="${this.instanceId}">
              <feGaussianBlur in="SourceGraphic" stdDeviation="2.6" result="b" />
              <feColorMatrix in="b" mode="matrix"
                values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 24 -12" />
            </filter>
          </defs>
          <g filter="url(#${this.instanceId})">
            <circle cx="9" cy="9" r="4.2" />
            <circle cx="21" cy="9" r="4.2" />
            <circle cx="33" cy="9" r="4.2" />
            <circle class="rover" cx="9" cy="9" r="5.4" />
          </g>
        </svg>`;
    }

    return '';
  }

  // The blob is a circle; the dots body is unused (SVG draws instead)
  override shape (width: number, height: number): Shape {
    if (this.type === 'dots') {
      return { width, height, radius: height / 2 };
    }

    const size = Math.min(width, height);

    return { width: size, height: size, radius: size / 2 };
  }

  // Called once after the shadow DOM and canvas exist. Wire ARIA here.
  override onBuilt (): void {
    this.setAttribute('role', 'status');

    if (!this.hasAttribute('aria-label')) {
      this.setAttribute('aria-label', this.getAttribute('label') || 'Loading');
    }
  }

  // One animation step: keep the blob alive, spinning and breathing
  override frame (dt: number): boolean {
    // The dots loader is CSS/SVG-driven; no canvas animation loop needed
    if (this.type === 'dots') {
      return false;
    }

    const body = this.body;

    if (!body) {
      return false;
    }

    if (this.reducedMotion) {
      this.clearCanvas();
      this.paintBody(body, { fill: this.fill() });
      return false; // calm static blob
    }

    // Keep it alive: jump around the rim dropping gentle impulses so the
    // blob never settles into a circle
    this.timeAccumulator += dt;

    if (this.timeAccumulator > 0.13) {
      this.timeAccumulator = 0;

      const n = body.membrane.length;

      this.idx = (this.idx + Math.round(n * 0.37)) % n;

      body.addMembraneImpulse(
        this.idx,
        body.config.insideLocalBulgeImpulse * 0.24,
        body.config.rippleWidth * 2.4,
      );
    }

    body.update(dt);

    // A slow spin plus a gentle breathing squash (volume-preserving) turn the
    // morphing blob into something that reads as a living organism, not a
    // wobbling circle sitting still
    this.angle += dt * 1.5;

    const breathe = 1 + Math.sin(this.angle * 1.7) * 0.05;
    const cx      = this.cssW / 2;
    const cy      = this.cssH / 2;
    const ctx     = this.ctx;

    this.clearCanvas();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.angle);
    ctx.scale(breathe, 2 - breathe);
    ctx.translate(-cx, -cy);
    this.paintBody(body, { fill: this.fill() });
    ctx.restore();

    return true;
  }

}

export function defineSpinner (options: DefineOptions = {}): DefineResult {
  return defineStrict([[TAGS.spinner, DropletSpinner]], options);
}

declare global {
  interface HTMLElementTagNameMap {
    'droplet-spinner': DropletSpinner;
  }
}
