/*
 * Loading indicators: a gooey blob gliding between three dots (default), or a
 * blob that morphs and spins (type="blob"). Reduced motion holds both still.
 */

import { DropletElement } from '../../element/index.js';
import type { Shape }   from '../../element/index.js';

import { uniqueId }     from '../../utilities/index.js';
import { defineStrict, TAGS } from '../../registry/index.js';
import type { DefineOptions, DefineResult } from '../../registry/index.js';

import spinnerStyles    from './spinner.css?inline';
import variantStyles    from '../../styles/variants.css?inline';

/**
 * A loading spinner: gooey traveling dots (default) or a morphing blob.
 *
 * @element droplet-spinner
 *
 * @attr {"dots"|"blob"} type - Spinner flavor.
 * @attr {"small"|"medium"|"large"} size - Spinner size.
 * @attr {string} label - Accessible loading label (defaults to "Loading").
 * @attr {"white"|"rose"|"amber"|"azure"|"mint"|"platinum"|"graphite"} variant - Fill hue.
 * @attr {string} feel - Registered feel preset driving the physics; inherits from a `data-droplet-feel` scope.
 * @attr {"low"|"medium"|"high"} quality - Caps physics cost (med/lo/hi aliases accepted); inherits from a `data-droplet-quality` scope.
 *
 * @cssprop [--droplet-fill] - Dot/blob color.
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

  static get observedAttributes (): string[] {
    return ['type', 'variant', 'size', 'label', ...DropletElement.AXIS_ATTRIBUTES];
  }

  attributeChangedCallback (name: string): void {
    if (this.axisAttributeChanged(name)) {
      return;
    }

    if (!this.built) {
      return;
    }

    switch (name) {
      case 'type':
        // Blob and dots differ in markup and geometry; the host's CSS size flip
        // reshapes the body through the ResizeObserver
        this.shadowRoot!.querySelector('.droplet-content')!.innerHTML = this.content();
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

  get type (): string {
    return this.getAttribute('type') || 'dots';
  }

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

  override onBuilt (): void {
    this.setAttribute('role', 'status');

    if (!this.hasAttribute('aria-label')) {
      this.setAttribute('aria-label', this.getAttribute('label') || 'Loading');
    }
  }

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
      return false;
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

    // A slow spin plus a volume-preserving breathing squash keep the blob from
    // reading as a wobbling circle sitting still
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
