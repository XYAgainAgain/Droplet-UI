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
 * @attr {"info"|"success"|"warning"|"danger"} tone - The alert tone, which sets its color.
 * @attr {boolean} dismissible - Show a dismiss button.
 * @attr {"small"|"medium"|"large"} size - Banner size.
 * @attr {string} feel - Registered feel preset driving the physics; inherits from a `data-droplet-feel` scope.
 * @attr {"low"|"medium"|"high"} quality - Caps physics cost (med/lo/hi aliases accepted); inherits from a `data-droplet-quality` scope.
 * @attr {string} material - Registered material preset: "matte" (the default) or "gloss" (Experimental); inherits from a `data-droplet-material` scope.
 * @attr {number} gloss - Sheen sharpness 0–1 for a lit material (Experimental); defaults to the material's sharpness.
 * @attr {number} softness - Feel knob 0–1: how far the surface gives under a press; unset keeps the feel preset's setting, and 0.5 is neutral.
 * @attr {number} bounce - Feel knob 0–1: how long it keeps wobbling before it settles; unset keeps the feel preset's setting, and 0.5 is neutral.
 * @attr {number} viscosity - Feel knob 0–1: how thick and slow it moves; unset keeps the feel preset's setting, and 0.5 is neutral.
 * @attr {number} spread - Feel knob 0–1: how far a dent travels around the edge; unset keeps the feel preset's setting, and 0.5 is neutral.
 * @attr {number} depth - Feel knob 0–1: how far it presses in and tilts; unset keeps the feel preset's setting, and 0.5 is neutral.
 * @attr {number} intensity - Feel knob 0–1: master gain on every push the surface takes; unset keeps the feel preset's setting, and 0.5 is neutral.
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

  static get observedAttributes (): string[] {
    return ['tone', 'size', 'dismissible', ...DropletElement.AXIS_ATTRIBUTES];
  }

  attributeChangedCallback (name: string): void {
    if (this.axisAttributeChanged(name)) {
      return;
    }

    if (!this.built) {
      return;
    }

    switch (name) {
      case 'tone':
        // Tone picks the icon markup too, so the box re-renders
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

  override styles (): string {
    return alertStyles;
  }

  override content (): string {
    const tone = this.getAttribute('tone') || 'info';

    return `
      <div class="box" part="box" role="alert">
        <span class="icon" aria-hidden="true">${dropletIcon(TONE_ICONS[tone] ?? TONE_ICONS.info!)}</span>
        <div class="body"><slot></slot></div>
        <button class="close" part="close" aria-label="Dismiss">${dropletIcon('dismiss', { size: 14 })}</button>
      </div>`;
  }

  override shape (width: number, height: number): Shape {
    const radius = parseFloat(readToken(getComputedStyle(this), 'alert-radius')) || 16;

    return { width, height, radius: Math.min(radius, height / 2) };
  }

  override fill (): string {
    return this.resolveColor(`var(--jelly-fill, var(--droplet-fill, var(--jelly-color-background-surface, var(--droplet-color-background-surface, ${PALETTE['background-surface']}))))`);
  }

  override onBuilt (): void {
    this.wireClose();

    if (!this.reducedMotion) {
      requestAnimationFrame(() => this.centerPop(0.7));
    }
  }

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

  shake (): void {
    if (this.reducedMotion || !this.body) {
      return;
    }

    this.shaking = 0.5; // s
    this.shakeT  = 0;

    this.requestFrame();
  }

  dismiss (): void {
    emit(this, 'dismiss');

    this.style.transition = 'opacity .18s ease, transform .18s ease';
    this.style.opacity    = '0';
    this.style.transform  = 'scale(0.96)';

    setTimeout(() => this.remove(), 180);
  }

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
