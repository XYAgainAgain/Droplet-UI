/*
 * A callout / alert banner on a jelly surface. Four tones and an optional
 * dismiss button, plus an imperative shake() to grab attention on demand.
 */

import { DropletElement } from '../../element/index.js';
import type { Shape }   from '../../element/index.js';

import { dropletIcon }     from '../../icons/index.js';
import type { IconName } from '../../icons/index.js';

import { emit }          from '../../utilities/index.js';

import { PALETTE }       from '../../theme/index.js';
import { defineStrict, TAGS } from '../../registry/index.js';
import type { DefineOptions, DefineResult } from '../../registry/index.js';
import { readToken } from '../../theme/token-read.js';

import alertStyles       from './alert.css?inline';

// The Fluent icon for each tone
const TONE_ICONS: Record<string, IconName> = {
  info:    'info',
  success: 'checkmark-circle',
  warning: 'warning',
  danger:  'error-circle',
};

/**
 * A callout banner with four tones and an optional dismiss button.
 *
 * @element droplet-alert
 *
 * @slot - The alert message.
 *
 * @attr {"info"|"success"|"warning"|"danger"} tone - The alert tone / color.
 * @attr {boolean} dismissible - Show a dismiss button.
 * @attr {"small"|"medium"|"large"} size - Banner size.
 * @attr {string} feel - Registered feel preset driving the physics; inherits from a `data-droplet-feel` scope.
 * @attr {"low"|"medium"|"high"} quality - Caps physics cost (med/lo/hi aliases accepted); inherits from a `data-droplet-quality` scope.
 *
 * @fires dismiss - When the alert is dismissed.
 *
 * @csspart box - The banner surface.
 * @csspart close - The dismiss button.
 *
 * @cssprop [--tone] - The tone color driving the fill wash and edge.
 */
export class DropletAlert extends DropletElement {

  static define (options?: DefineOptions): DefineResult {
    return defineAlert(options);
  }

  static override usesResolver = true;

  shakeT = 0;
  shaking = 0;
  shakeDir = -1;

  // Tells the browser to trigger attributeChangedCallback when these attributes change
  static get observedAttributes (): string[] {
    return ['tone', 'size', 'dismissible', ...DropletElement.AXIS_ATTRIBUTES];
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
      case 'tone':
        // Tone drives the icon glyph (markup) as well as its color (CSS var),
        // so re-render the box, re-wire its dismiss button and repaint
        this.shadowRoot!.querySelector('.droplet-content')!.innerHTML = this.content();
        this.wireClose();
        this.requestFrame();
        break;

      case 'size':
        this.applyShape();
        break;

      case 'dismissible':
        this.wireClose();
        break;
    }
  }

  // Component styles layered over the shared jelly base styles
  override styles (): string {
    return alertStyles;
  }

  // The interactive markup that sits above the canvas
  override content (): string {
    const tone = this.getAttribute('tone') || 'info';

    return `
      <div class="box" part="box" role="alert">
        <span class="icon" aria-hidden="true">${dropletIcon(TONE_ICONS[tone] ?? TONE_ICONS.info!)}</span>
        <div class="body"><slot></slot></div>
        <button class="close" part="close" aria-label="Dismiss">${dropletIcon('dismiss', { size: 14 })}</button>
      </div>`;
  }

  // The banner the physics body takes (radius follows the size token)
  override shape (width: number, height: number): Shape {
    const radius = parseFloat(readToken(getComputedStyle(this), 'alert-radius')) || 16;

    return { width, height, radius: Math.min(radius, height / 2) };
  }

  // The surface fill resolves through the theme so dark mode recolors it
  override fill (): string {
    return this.resolveColor(`var(--jelly-fill, var(--droplet-fill, var(--jelly-color-background-surface, var(--droplet-color-background-surface, ${PALETTE['background-surface']}))))`);
  }

  // Called once after the shadow DOM and canvas exist. Wire events here.
  override onBuilt (): void {
    this.wireClose();

    if (!this.reducedMotion) {
      requestAnimationFrame(() => this.centerPop(0.7));
    }
  }

  // Hook up the dismiss button (re-run after tone re-renders the box)
  wireClose (): void {
    const close = this.shadowRoot!.querySelector('.close') as (HTMLElement & { wired?: boolean }) | null;

    if (!close) {
      return;
    }

    if (this.hasAttribute('dismissible')) {
      this.useHostFocusTarget(close);
    }

    if (close.wired) {
      return;
    }

    close.wired = true;
    close.addEventListener('click', () => this.dismiss());
  }

  // A quick left-right jelly shake
  shake (): void {
    if (this.reducedMotion || !this.body) {
      return;
    }

    this.shaking = 0.5; // seconds of shaking
    this.shakeT  = 0;

    this.requestFrame();
  }

  // Announce the dismissal, then fade out and remove the element
  dismiss (): void {
    emit(this, 'dismiss');

    this.style.transition = 'opacity .18s ease, transform .18s ease';
    this.style.opacity    = '0';
    this.style.transform  = 'scale(0.96)';

    setTimeout(() => this.remove(), 180);
  }

  // One animation step: alternate horizontal flings while shaking
  override frame (dt: number): boolean {
    const body = this.body;

    if (!body) {
      return false;
    }

    if (this.shaking > 0) {
      this.shaking -= dt;
      this.shakeT  += dt;

      if (this.shakeT >= 0.08) {
        this.shakeT   = 0;
        this.shakeDir = -this.shakeDir;

        body.stretchAlong(this.shakeDir, 0, 0.8);
      }
    }

    body.update(dt);
    this.clearCanvas();
    this.paintBody(body, {
      fill:   this.fill(),
      border: { color: this.resolveColor(`var(--jelly-alert-border, var(--droplet-alert-border, var(--jelly-color-border-default, var(--droplet-color-border-default, ${PALETTE['border-default']}))))`), width: 1 },
    });

    return this.shaking > 0 || !body.isResting();
  }

}

export function defineAlert (options: DefineOptions = {}): DefineResult {
  return defineStrict([[TAGS.alert, DropletAlert]], options);
}

declare global {
  interface HTMLElementTagNameMap {
    'droplet-alert': DropletAlert;
  }
}
