/*
 * A capsule-shaped jelly button. A real <button> lives in the shadow DOM
 * for keyboard and assistive-technology support while the soft body is
 * painted on the canvas behind it; click events bubble out composed, so
 * consumers use it like any native button and type="submit" / "reset"
 * drive the closest light-DOM <form>. shape="square" swaps the full pill
 * for a smaller, rounded-rectangle radius (same 0.32-of-height ratio as
 * jelly-icon-button's default square).
 */

import { JellyElement }   from '../../element/index.js';
import type { Shape }      from '../../element/index.js';

import { canonicalizeQualityAttribute } from '../../element/configure.js';

import { defineElements }      from '../../registry/index.js';
import { TAGS }                from '../../registry/index.js';
import type { DefineOptions }  from '../../registry/index.js';
import type { DefineResult }   from '../../registry/index.js';

import buttonStyles        from './button.css?inline';
import variantStyles       from '../../styles/variants.css?inline';

/**
 * A capsule-shaped jelly button with soft-body physics.
 *
 * @element jelly-button
 *
 * @slot - The button's label content (text, icons).
 *
 * @attr {boolean} disabled - Disables the button and removes it from the tab order.
 * @attr {string} label - Accessible name used when the button has no text label.
 * @attr {"button"|"submit"|"reset"} type - Native button behavior; submit / reset drive the closest form.
 * @attr {"pill"|"square"} shape - Full pill (default) or rounded-square silhouette.
 * @attr {boolean} block - Stretch the button to the full width of its container.
 * @attr {"small"|"medium"|"large"} size - Control size (sm / md / lg aliases accepted).
 * @attr {"white"|"rose"|"amber"|"azure"|"mint"|"platinum"|"graphite"} variant - Fill / label color pair.
 * @attr {string} feel - Registered feel preset driving the physics; inherits from a `data-droplet-feel` scope.
 * @attr {"low"|"medium"|"high"} quality - Caps physics cost (med/lo/hi aliases accepted); inherits from a `data-droplet-quality` scope.
 *
 * @fires click - When the button is activated (native event, bubbles composed).
 *
 * @csspart button - The inner native <button>.
 * @csspart jelly - The canvas the soft body is painted on.
 *
 * @cssprop [--jelly-button-height=62px] - Control height.
 * @cssprop [--jelly-button-radius=999px] - Corner radius of the painted surface.
 * @cssprop [--jelly-fill] - Surface fill color (usually set by `variant`).
 * @cssprop [--jelly-label] - Label color.
 */
export class JellyButton extends JellyElement {

  // Opt in to the base class's feel / quality / resolver half
  static override usesResolver = true;

  // Populated in onBuilt()
  button!: HTMLButtonElement;
  activationPointerId: number | null = null;
  cancelPointerClick = false;

  internals: ElementInternals;

  statePointerId: number | null = null;

  constructor () {
    super();

    // Once, in the constructor: attachInternals() throws on a second call
    this.internals = this.attachInternals();
  }

  static define (options?: DefineOptions): DefineResult {
    return defineButton(options);
  }

  // Tells the browser to trigger attributeChangedCallback when these attributes change
  static get observedAttributes (): string[] {
    return [
      'disabled', 'label', 'type', 'shape', 'feel', 'quality',
      // Global ARIA state forwarded to the inner focusable button, so the
      // roled/focusable element - not the roleless host - carries the state
      'aria-current', 'aria-expanded', 'aria-haspopup', 'aria-controls', 'aria-pressed',
    ];
  }

  // Lifecycle

  override disconnectedCallback (): void {
    super.disconnectedCallback();

    this.clearPressed();
  }

  // Component styles layered over the shared jelly base styles
  override styles (): string {
    return variantStyles + buttonStyles;
  }

  // The interactive markup that sits above the canvas
  override content (): string {
    return `<button part="button"><slot></slot></button>`;
  }

  // The capsule (or, with shape="square", rounded-rectangle) the physics body
  // takes, inset so the wobble stays inside the host
  override shape (width: number, height: number): Shape {
    const w      = width - 8;
    const h      = height - 8;
    const square = this.getAttribute('shape') === 'square';

    // Honor a plain-px --jelly-button-radius override on the painted surface;
    // the pill (999px) and square (calc) defaults fall through to the ratios
    const declared = parseFloat(getComputedStyle(this).getPropertyValue('--jelly-button-radius'));
    const radius   = Number.isFinite(declared) ? Math.min(declared, h / 2) : (square ? h * 0.32 : h / 2);

    return { width: w, height: h, radius };
  }

  // Called once after the shadow DOM and canvas exist. Wire events here.
  override onBuilt (): void {
    this.button = this.shadowRoot!.querySelector('button')!;

    this.sync('type');
    this.sync('disabled');
    this.sync('label');

    // Forward any ARIA state already present at build time
    for (const attr of this.getAttributeNames()) {
      if (attr.startsWith('aria-')) {
        this.sync(attr);
      }
    }

    this.useHostFocusTarget(this.button);
    this.trackFocus(this.button);
    this.preventReleaseOutsideActivation();
    this.trackPressedState();
    this.wirePress(this.button);

    // Drive the closest light-DOM form for submit / reset buttons
    this.button.addEventListener('click', () => this.driveForm());
  }

  // Pointer capture keeps a drag routed to the button after the pointer leaves
  // it. Only let the resulting native click through when it is released back
  // inside the button; keyboard activation stays unchanged.
  preventReleaseOutsideActivation (): void {
    this.button.addEventListener('pointerdown', (event) => {
      this.activationPointerId = event.pointerId;
      this.cancelPointerClick = false;
    });

    this.button.addEventListener('pointerup', (event) => {
      if (event.pointerId !== this.activationPointerId) {
        return;
      }

      const rect = this.button.getBoundingClientRect();

      this.cancelPointerClick =
        event.clientX < rect.left || event.clientX > rect.right
        || event.clientY < rect.top || event.clientY > rect.bottom;
      this.activationPointerId = null;
    });

    this.button.addEventListener('pointercancel', () => {
      this.activationPointerId = null;
      this.cancelPointerClick = false;
    });

    const cancelOutsideRelease = (event: Event): void => {
      if (!this.cancelPointerClick) {
        return;
      }

      this.cancelPointerClick = false;
      event.preventDefault();
      event.stopImmediatePropagation();
    };

    this.button.addEventListener('click', cancelOutsideRelease);
    this.addEventListener('click', cancelOutsideRelease, { capture: true });
  }

  // Tracked on the host because pointer capture retargets the rest of the press
  // lifecycle to whatever element captured it (state-and-reflection.md)
  trackPressedState (): void {
    this.addEventListener('pointerdown', (event) => {
      if (this.statePointerId !== null || this.hasAttribute('disabled')) {
        return;
      }

      this.statePointerId = event.pointerId;
      this.internals.states.add('pressed');
    });

    const clear = (event: PointerEvent): void => {
      if (event.pointerId === this.statePointerId) {
        this.clearPressed();
      }
    };

    this.addEventListener('pointerup', clear);
    this.addEventListener('pointercancel', clear);
    this.addEventListener('lostpointercapture', clear);
  }

  clearPressed (): void {
    this.statePointerId = null;
    this.internals.states.delete('pressed');
  }

  // Lifecycle method: Fires when observed HTML attributes change dynamically
  attributeChangedCallback (name: string): void {
    if (name === 'feel' || name === 'quality') {
      if (name === 'quality') {
        canonicalizeQualityAttribute(this);
      }

      this.resolve();
      return;
    }

    if (this.button) {
      this.sync(name);
    }
  }

  // Push one observed attribute into the inner native button
  sync (name: string): void {
    // Global ARIA state mirrors onto the inner button verbatim
    if (name.startsWith('aria-')) {
      const value = this.getAttribute(name);

      if (value === null) {
        this.button.removeAttribute(name);
      } else {
        this.button.setAttribute(name, value);
      }
      return;
    }

    switch (name) {
      case 'disabled':
        this.button.disabled = this.hasAttribute('disabled');
        this.syncHostFocusTarget();
        break;

      case 'type': {
        const type = this.getAttribute('type');
        this.button.type = type === 'submit' || type === 'reset' ? type : 'button';
        break;
      }

      case 'label': {
        const label = this.getAttribute('label');

        if (label) {
          this.button.setAttribute('aria-label', label);
        } else {
          this.button.removeAttribute('aria-label');
        }
        break;
      }

      case 'shape':
        this.reshapeMembrane();
        break;
    }
  }

  // Submit or reset the closest light-DOM form when this is a submit / reset button
  driveForm (): void {
    const type = this.button.type;

    if (type !== 'submit' && type !== 'reset') {
      return;
    }

    const form = this.closest('form');

    if (!form) {
      return;
    }

    if (type === 'submit') {
      form.requestSubmit();
    } else {
      form.reset();
    }
  }

  // Route programmatic host focus into the inner native button
  override focus (options?: FocusOptions): void {
    this.button?.focus(options);
  }

}

// Explicit helper, so strict is the default: a foreign jelly-button throws
// rather than being warned past (registration.md)
export function defineButton (options: DefineOptions = {}): DefineResult {
  return defineElements([[TAGS.button, JellyButton]], { ...options, strict: options.strict ?? true });
}

declare global {
  interface HTMLElementTagNameMap {
    'jelly-button': JellyButton;
  }
}
