import { DropletElement } from '../../element/index.js';
import type { Shape }   from '../../element/index.js';
import type { Border }  from '../../element/index.js';
import { defineStrict, TAGS } from '../../registry/index.js';
import type { DefineOptions, DefineResult } from '../../registry/index.js';
import { readToken } from '../../theme/token-read.js';

import badgeStyles      from './badge.css?inline';
import variantStyles    from '../../styles/variants.css?inline';

/**
 * A small status pill, tag, or count badge.
 *
 * @element droplet-badge
 *
 * @slot - The badge content (text or a count).
 *
 * @attr {"white"|"rose"|"amber"|"azure"|"mint"|"platinum"|"graphite"} variant - Fill hue.
 * @attr {string} color - Any CSS color for the fill or accent (beats intent and variant); text or a mark on it turns white or near-black, whichever reads better.
 * @attr {"accent"|"neutral"|"info"|"success"|"warning"|"danger"|"highlight"} intent - Semantic color role (never an ARIA role); beats variant.
 * @attr {"small"|"medium"|"large"} size - Badge scale.
 * @attr {boolean} outline - Render a hollow pill with a colored rim.
 * @attr {boolean} instant - Skip the fill crossfade on a variant swap.
 * @attr {boolean} live - Announce content changes to assistive technology.
 * @attr {"pill"|"square"} shape - Full pill (default) or rounded-square.
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
 * @csspart badge - The inner pill.
 *
 * @cssprop [--droplet-badge-radius=999px] - Corner radius of the painted pill.
 */
export class DropletBadge extends DropletElement {

  static define (options?: DefineOptions): DefineResult {
    return defineBadge(options);
  }

  static override usesResolver = true;

  mutationObserver: MutationObserver | null = null;

  static get observedAttributes (): string[] {
    return ['live', 'shape', ...DropletElement.AXIS_ATTRIBUTES];
  }

  override styles (): string {
    return variantStyles + badgeStyles;
  }

  override content (): string {
    return `<span class="badge" part="badge"><slot></slot></span>`;
  }

  override shape (width: number, height: number): Shape {
    const h      = height - 2;
    const square = this.getAttribute('shape') === 'square';

    // Under 900px paints as declared; the 999px pill default falls through to the height ratios
    const declared = parseFloat(readToken(getComputedStyle(this), 'badge-radius'));
    const radius   = Number.isFinite(declared) && declared < 900 ? Math.min(declared, h / 2) : (square ? h * 0.32 : h / 2);

    return { width: width - 2, height: h, radius };
  }

  // Outline never eases: easing a transparent fill rounds it to opaque black
  override frame (dt: number): boolean {
    const body = this.body;

    if (!body) {
      return false;
    }

    body.update(dt);
    this.clearCanvas();

    if (this.hasAttribute('outline')) {
      this.paintBody(body, {
        fill:   'transparent',
        ease:   false,
        ring:   this.focusRing(),
        border: this.surfaceBorder(),
      });
    } else {
      this.paintBody(body, {
        ease:   !this.hasAttribute('instant'),
        ring:   this.focusRing(),
        border: this.surfaceBorder(),
      });
    }

    return !body.isResting();
  }

  override surfaceBorder (): Border | null {
    if (!this.hasAttribute('outline')) {
      return null;
    }

    return {
      width: 2,
      color: this.resolveColor('var(--jelly-fill, var(--droplet-fill))'),
    };
  }

  override onBuilt (): void {
    this.sync();

    this.mutationObserver = new MutationObserver(() => this.centerPop(0.7));
    this.mutationObserver.observe(this, { childList: true, characterData: true, subtree: true });
  }

  // Re-arms the observer disconnectedCallback dropped
  override connectedCallback (): void {
    super.connectedCallback();
    this.mutationObserver?.observe(this, { childList: true, characterData: true, subtree: true });
  }

  attributeChangedCallback (name: string): void {
    if (this.axisAttributeChanged(name)) {
      return;
    }

    if (!this.built) {
      return;
    }

    if (name === 'shape') {
      this.reshapeMembrane();
      return;
    }

    this.sync();
  }

  sync (): void {
    if (this.hasAttribute('live')) {
      this.setAttribute('role', 'status');
      this.setAttribute('aria-live', 'polite');
    } else {
      this.removeAttribute('role');
      this.removeAttribute('aria-live');
    }
  }

  override disconnectedCallback (): void {
    super.disconnectedCallback();
    this.mutationObserver?.disconnect();
  }

}

export function defineBadge (options: DefineOptions = {}): DefineResult {
  return defineStrict([[TAGS.badge, DropletBadge]], options);
}

declare global {
  interface HTMLElementTagNameMap {
    'droplet-badge': DropletBadge;
  }
}
