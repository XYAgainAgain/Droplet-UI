/*
 * A small jelly badge / tag / status pill. Static by default; it does a
 * tiny pop whenever its text changes (nice for live counts). Attributes:
 *   - `variant` / `size` : the fill hue and the pill scale
 *   - `outline`          : a hollow pill (variant-colored rim, neutral label)
 *   - `instant`          : skip the fill crossfade on a variant swap
 *   - `live`             : announce count changes to assistive technology
 *   - `shape="square"`   : a smaller rounded-rectangle radius instead of the
 *                          full pill (same 0.32-of-height ratio as icon-button)
 */

import { DropletElement } from '../../element/index.js';
import type { Shape }   from '../../element/index.js';
import type { Border }  from '../../element/index.js';
import { defineStrict, TAGS } from '../../registry/index.js';
import type { DefineOptions, DefineResult } from '../../registry/index.js';
import { readToken } from '../../theme/token-read.js';

import badgeStyles      from './badge.css?inline';
import variantStyles    from '../../styles/variants.css?inline';

/**
 * A small status pill / tag / count badge.
 *
 * @element droplet-badge
 *
 * @slot - The badge content (text or a count).
 *
 * @attr {"white"|"rose"|"amber"|"azure"|"mint"|"platinum"|"graphite"} variant - Fill hue.
 * @attr {"small"|"medium"|"large"} size - Badge scale.
 * @attr {boolean} outline - Render a hollow pill with a colored rim.
 * @attr {boolean} instant - Skip the fill crossfade on a variant swap.
 * @attr {boolean} live - Announce content changes to assistive technology.
 * @attr {"pill"|"square"} shape - Full pill (default) or rounded-square.
 * @attr {string} feel - Registered feel preset driving the physics; inherits from a `data-droplet-feel` scope.
 * @attr {"low"|"medium"|"high"} quality - Caps physics cost (med/lo/hi aliases accepted); inherits from a `data-droplet-quality` scope.
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

  // Tells the browser to trigger attributeChangedCallback when these attributes change
  static get observedAttributes (): string[] {
    return ['live', 'shape', ...DropletElement.AXIS_ATTRIBUTES];
  }

  // Component styles layered over the shared jelly base styles
  override styles (): string {
    return variantStyles + badgeStyles;
  }

  // The interactive markup that sits above the canvas
  override content (): string {
    return `<span class="badge" part="badge"><slot></slot></span>`;
  }

  // The pill (or, with shape="square", rounded-rectangle) the physics body takes
  override shape (width: number, height: number): Shape {
    const h      = height - 2;
    const square = this.getAttribute('shape') === 'square';

    // A plain-px --droplet-badge-radius override reaches the painted pill; the
    // pill (999px) and square (8px-ish) defaults fall through to the ratios
    const declared = parseFloat(readToken(getComputedStyle(this), 'badge-radius'));
    const radius   = Number.isFinite(declared) && declared < 900 ? Math.min(declared, h / 2) : (square ? h * 0.32 : h / 2);

    return { width: width - 2, height: h, radius };
  }

  /*
   * One animation step. A filled badge uses the base solid paint (crossfading
   * toward a new fill unless `instant` skips the ease - handy for badges that
   * swap variant on every scroll tick, where a lagging crossfade reads as
   * messy); an `outline` badge paints a hollow pill instead - a transparent
   * fill with the variant colour drawn as the rim (see surfaceBorder). The
   * transparent fill always skips easing too, which would otherwise round it
   * to opaque black.
   */
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

  // The rim for an outline badge: the full variant fill colour, resolved to a
  // concrete colour (canvas strokeStyle can't read var()).
  override surfaceBorder (): Border | null {
    if (!this.hasAttribute('outline')) {
      return null;
    }

    return {
      width: 2,
      color: this.resolveColor('var(--jelly-fill, var(--droplet-fill))'),
    };
  }

  // Called once after the shadow DOM and canvas exist. Wire events here.
  override onBuilt (): void {
    this.sync();

    // Pop when the label content changes
    this.mutationObserver = new MutationObserver(() => this.centerPop(0.7));
    this.mutationObserver.observe(this, { childList: true, characterData: true, subtree: true });
  }

  // Lifecycle method: Called automatically when the element is appended to the
  // DOM. Re-arm the content observer - disconnectedCallback dropped it and a
  // badge that is detached and re-appended should keep popping on new counts.
  override connectedCallback (): void {
    super.connectedCallback();
    this.mutationObserver?.observe(this, { childList: true, characterData: true, subtree: true });
  }

  // Lifecycle method: Fires when observed HTML attributes change dynamically
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

  // With `live`, content changes are announced politely by screen readers
  sync (): void {
    if (this.hasAttribute('live')) {
      this.setAttribute('role', 'status');
      this.setAttribute('aria-live', 'polite');
    } else {
      this.removeAttribute('role');
      this.removeAttribute('aria-live');
    }
  }

  // Lifecycle method: Called automatically when the element leaves the DOM
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
