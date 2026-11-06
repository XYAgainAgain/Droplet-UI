import { DropletElement }      from '../../element/index.js';
import type { Shape }        from '../../element/index.js';


import { AriaLink }          from '../../utilities/index.js';
import { FORWARDED_ARIA }    from '../../utilities/index.js';
import { forwardAria }       from '../../utilities/index.js';
import { forwardAllAria }    from '../../utilities/index.js';
import { reflectAttribute }  from '../../utilities/index.js';
import { defineStrict, TAGS } from '../../registry/index.js';
import type { DefineOptions, DefineResult } from '../../registry/index.js';
import { readToken } from '../../theme/token-read.js';

import iconButtonStyles      from './icon-button.css?inline';
import variantStyles         from '../../styles/variants.css?inline';

/**
 * A compact square or round button sized for a single icon.
 *
 * @element droplet-icon-button
 *
 * @slot - The icon (an SVG or emoji).
 *
 * @attr {string} label - Accessible name for the icon (required for a11y unless `aria-label` is set); wins over `aria-label`.
 * @attr {boolean} disabled - Disable the button and remove it from the tab order; a disabled ancestor fieldset does the same.
 * @attr {string} name - The control's name, for code that reads `name` off form controls.
 * @attr {"square"|"circle"} shape - Rounded square (default) or circle.
 * @attr {"small"|"medium"|"large"} size - Control size.
 * @attr {"white"|"rose"|"amber"|"azure"|"mint"|"platinum"|"graphite"} variant - Fill hue.
 * @attr {string} color - Any CSS color for the fill or accent (beats intent and variant); text or a mark on it turns white or near-black, whichever reads better.
 * @attr {"accent"|"neutral"|"info"|"success"|"warning"|"danger"|"highlight"} intent - Semantic color role (never an ARIA role); beats variant.
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
 * @prop {boolean} disabled - Reflects the `disabled` attribute.
 * @prop {string} name - Reflects the `name` attribute.
 *
 * @fires click - When the button is activated (native event, bubbles composed).
 *
 * @csspart button - The inner native <button>.
 *
 * @cssprop [--droplet-icon-button-size=48px] - Button diameter or side length.
 * @cssprop [--droplet-icon-button-radius=16px] - Corner radius for the square shape.
 */
export class DropletIconButton extends DropletElement {

  static define (options?: DefineOptions): DefineResult {
    return defineIconButton(options);
  }

  static override usesResolver = true;

  static override REPLAYED: readonly string[] = [...DropletElement.REPLAYED, 'disabled', 'name'];

  // For :disabled and fieldset disabling; it never submits
  static formAssociated = true;

  button!: HTMLButtonElement;
  activationPointerId: number | null = null;
  cancelPointerClick = false;

  internals: ElementInternals;

  ariaLink = new AriaLink(this, () => this.forwardHostAria());

  constructor () {
    super();

    this.internals = this.attachInternals();
  }

  static get observedAttributes (): string[] {
    return ['disabled', 'label', 'shape', ...FORWARDED_ARIA, ...DropletElement.AXIS_ATTRIBUTES];
  }

  get disabled (): boolean {
    return this.hasAttribute('disabled');
  }

  set disabled (value: boolean) {
    this.toggleAttribute('disabled', Boolean(value));
  }

  get name (): string {
    return this.getAttribute('name') ?? '';
  }

  set name (value: string) {
    reflectAttribute(this, 'name', value);
  }

  get effectivelyDisabled (): boolean {
    return this.hasAttribute('disabled') || this.matches(':disabled');
  }

  override connectedCallback (): void {
    super.connectedCallback();

    this.ariaLink.connect();
  }

  override disconnectedCallback (): void {
    super.disconnectedCallback();

    this.ariaLink.disconnect();
  }

  override click (): void {
    if (this.effectivelyDisabled) {
      return;
    }

    if (this.button) {
      this.button.click();
    } else {
      super.click();
    }
  }

  formDisabledCallback (): void {
    if (this.button) {
      this.sync('disabled');
    }
  }

  override styles (): string {
    return variantStyles + iconButtonStyles;
  }

  override content (): string {
    return `<button part="button"><slot></slot></button>`;
  }

  override shape (width: number, height: number): Shape {
    const size   = Math.min(width, height) - 6;
    const circle = this.getAttribute('shape') === 'circle';

    const declared = parseFloat(readToken(getComputedStyle(this), 'icon-button-radius'));
    const radius   = circle ? size / 2 : (Number.isFinite(declared) ? Math.min(declared, size / 2) : size * 0.32);

    return { width: size, height: size, radius };
  }

  override onBuilt (): void {
    this.button = this.shadowRoot!.querySelector('button')!;

    this.sync('disabled');
    this.forwardHostAria();

    this.useHostFocusTarget(this.button);
    this.trackFocus(this.button);
    this.preventReleaseOutsideActivation();
    this.wirePress(this.button, { disabled: () => this.effectivelyDisabled });
  }

  forwardHostAria (): void {
    if (!this.button) {
      return;
    }

    forwardAllAria(this, this.button);
    this.sync('label');
  }

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

    // The click is composed, so the host needs the guard too
    this.button.addEventListener('click', cancelOutsideRelease);
    this.addEventListener('click', cancelOutsideRelease, { capture: true });
  }

  attributeChangedCallback (name: string): void {
    if (this.axisAttributeChanged(name)) {
      return;
    }

    if (this.button) {
      this.sync(name);
    }
  }

  sync (name: string): void {
    if (name.startsWith('aria-') && name !== 'aria-label') {
      forwardAria(this, this.button, name);
      return;
    }

    switch (name) {
      case 'disabled':
        this.button.disabled = this.effectivelyDisabled;
        this.syncHostFocusTarget();
        break;

      case 'label':
      case 'aria-label': {
        const label = this.getAttribute('label');

        if (label) {
          reflectAttribute(this.button, 'aria-label', label);
        } else {
          forwardAria(this, this.button, 'aria-label');
        }
        break;
      }

      case 'shape':
        this.reshapeMembrane();
        break;
    }
  }

  override syncHostFocusTarget (): void {
    super.syncHostFocusTarget();

    if (this.hostFocusTarget && this.effectivelyDisabled) {
      this.hostFocusTarget.tabIndex = -1;
    }
  }

  override focus (options?: FocusOptions): void {
    this.button?.focus(options);
  }

}

export function defineIconButton (options: DefineOptions = {}): DefineResult {
  return defineStrict([[TAGS.iconButton, DropletIconButton]], options);
}

declare global {
  interface HTMLElementTagNameMap {
    'droplet-icon-button': DropletIconButton;
  }
}
