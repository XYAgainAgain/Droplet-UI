/*
 * A squishy checkbox with an optional slotted label and a mixed
 * (indeterminate) state. A visually-hidden native checkbox carries focus,
 * keyboard and the form value while the jelly square is painted behind it
 * and pops each time it toggles; a dash mark shows the mixed state
 */

import { DropletElement }     from '../../element/index.js';
import type { Shape }       from '../../element/index.js';

import { canonicalizeSize } from '../../utilities/index.js';
import { emit }             from '../../utilities/index.js';
import { triggerHaptic }    from '../../utilities/index.js';
import { integrateSpring }  from '../../utilities/index.js';

import { PALETTE }          from '../../theme/index.js';
import { variantColors }    from '../../theme/index.js';
import { defineStrict, TAGS } from '../../registry/index.js';
import type { DefineOptions, DefineResult } from '../../registry/index.js';

import checkboxStyles       from './checkbox.css?inline';

/**
 * A squishy checkbox backed by a real form-associated native checkbox.
 *
 * @element jelly-checkbox
 *
 * @slot - The label text shown beside the box.
 *
 * @attr {boolean} checked - Whether the box is checked.
 * @attr {boolean} indeterminate - Show the mixed (dash) state; cleared by a user toggle.
 * @attr {boolean} disabled - Disable the control and remove it from the tab order.
 * @attr {string} label - Accessible name when there is no slotted label.
 * @attr {string} value - Form value submitted while checked (defaults to "on").
 * @attr {string} name - Form field name submitted with the control's value.
 * @attr {"small"|"medium"|"large"} size - Control size.
 * @attr {"white"|"rose"|"amber"|"azure"|"mint"|"platinum"|"graphite"} variant - Checked fill hue.
 * @attr {string} feel - Registered feel preset driving the physics; inherits from a `data-droplet-feel` scope.
 * @attr {"low"|"medium"|"high"} quality - Caps physics cost (med/lo/hi aliases accepted); inherits from a `data-droplet-quality` scope.
 *
 * @fires change - When the checked state changes through user interaction.
 *
 * @csspart wrap - The label wrapper.
 * @csspart input - The visually-hidden native checkbox.
 *
 * @cssprop [--jelly-checkbox-size=32px] - Box size.
 * @cssprop [--jelly-on] - Checked fill color.
 * @cssprop [--jelly-checkbox-mark] - Check-mark color.
 */
export class DropletCheckbox extends DropletElement {

  static define (options?: DefineOptions): DefineResult {
    return defineCheckbox(options);
  }

  static override usesResolver = true;

  // Participate in native <form> submission through ElementInternals
  static formAssociated = true;

  internals: ElementInternals;

  // Populated in onBuilt()
  input!: HTMLInputElement;

  // Uniform scale spring driven by frame(): the box pops, never wiggles
  scale = 1;
  scaleVelocity = 0;

  // Tells the browser to trigger attributeChangedCallback when these attributes change
  static get observedAttributes (): string[] {
    return ['checked', 'disabled', 'indeterminate', 'label', 'size', 'value', ...DropletElement.AXIS_ATTRIBUTES];
  }

  constructor () {
    super();

    this.internals = this.attachInternals();
  }

  // Component styles layered over the shared jelly base styles
  override styles (): string {
    return checkboxStyles + variantColors({ color: '--droplet-on', on: '--droplet-checkbox-mark' });
  }

  // The interactive markup that sits above the canvas
  override content (): string {
    return `
      <label class="wrap" part="wrap">
        <input type="checkbox" part="input" />
        <span class="box" data-droplet-box aria-hidden="true">
          <svg class="mark check" viewBox="0 0 32 32"><path d="M7 17l6 6 12-14" /></svg>
          <svg class="mark dash" viewBox="0 0 32 32"><path d="M9 16h14" /></svg>
        </span>
        <span class="label"><slot></slot></span>
      </label>`;
  }

  // The square the physics body takes - the box region, not the label
  override shape (width: number, height: number): Shape {
    const size = Math.min(width, height);

    return { width: size, height: size, radius: size * 0.32 };
  }

  // Resolve the box fill for the current state through the live theme tokens
  override fill (): string {
    return this.checked || this.indeterminate
      ? this.resolveColor(`var(--jelly-on, var(--droplet-on, ${PALETTE['background-accent']}))`)
      : this.resolveColor(`var(--jelly-fill, var(--droplet-fill, ${PALETTE['background-neutral']}))`);
  }

  // Called once after the shadow DOM and canvas exist. Wire events here.
  override onBuilt (): void {
    this.input = this.shadowRoot!.querySelector('input')!;

    this.sync('checked');
    this.sync('indeterminate');
    this.sync('disabled');
    this.sync('label');

    this.useHostFocusTarget(this.input);
    this.trackFocus(this.input);

    this.input.addEventListener('change', () => {
      // A user toggle resolves a mixed state - indeterminate always clears
      this.indeterminate = false;

      this.toggleAttribute('checked', this.input.checked);
      this.syncFormValue();

      // Clean expand on check, collapse on uncheck - no membrane wiggle
      this.pop(this.input.checked ? 4 : -3);
      triggerHaptic();

      emit(this, 'change');
    });
  }

  // Kick the scale spring: +v expands (check), -v collapses (uncheck)
  pop (v: number): void {
    if (this.reducedMotion) {
      return;
    }

    this.scaleVelocity += v;
    this.requestFrame();
  }

  // One animation step: advance the scale spring and repaint. True keeps animating.
  override frame (dt: number): boolean {
    const body = this.body;

    if (!body) {
      return false;
    }

    // One uniform scale spring - the box expands / collapses, never wiggles
    [this.scale, this.scaleVelocity] = integrateSpring(this.scale, this.scaleVelocity, 1, 260, 17, dt);

    this.clearCanvas();
    this.paintBody(body, { fill: this.fill(), scaleX: this.scale, scaleY: this.scale, ring: this.focusRing() });

    return Math.abs(1 - this.scale) > 0.0015 || Math.abs(this.scaleVelocity) > 0.0015;
  }

  // Report the submitted value: `value` when checked, nothing otherwise
  syncFormValue (): void {
    this.internals.setFormValue(this.input.checked ? this.value : null);
  }

  // Lifecycle method: Fires when observed HTML attributes change dynamically
  attributeChangedCallback (name: string): void {
    if (this.axisAttributeChanged(name)) {
      return;
    }

    if (this.input) {
      this.sync(name);
    }
  }

  // Push one observed attribute into the hidden native input
  sync (name: string): void {
    switch (name) {
      case 'checked':
        this.input.checked = this.checked;
        this.syncFormValue();
        this.requestFrame();
        break;

      case 'indeterminate':
        // The native input reports aria-checked="mixed" while indeterminate
        this.input.indeterminate = this.indeterminate;
        this.requestFrame();
        break;

      case 'value':
        this.syncFormValue();
        break;

      case 'disabled':
        this.input.disabled = this.hasAttribute('disabled');
        this.syncHostFocusTarget();
        break;

      case 'size':
        canonicalizeSize(this);
        break;

      case 'label': {
        const label = this.getAttribute('label');

        if (label) {
          this.input.setAttribute('aria-label', label);
        } else {
          this.input.removeAttribute('aria-label');
        }
        break;
      }
    }
  }

  // Whether the checkbox is currently checked (reflects the attribute)
  get checked (): boolean {
    return this.hasAttribute('checked');
  }

  set checked (value: boolean) {
    this.toggleAttribute('checked', Boolean(value));
  }

  // Mixed state: shows a dash and reports aria-checked="mixed"; cleared by a user toggle
  get indeterminate (): boolean {
    return this.hasAttribute('indeterminate');
  }

  set indeterminate (value: boolean) {
    this.toggleAttribute('indeterminate', Boolean(value));
  }

  // The form value submitted while checked (defaults to "on", like native)
  get value (): string {
    return this.getAttribute('value') || 'on';
  }

  set value (value: string) {
    this.setAttribute('value', String(value));
  }

  // Route programmatic host focus into the hidden native input
  override focus (options?: FocusOptions): void {
    this.input?.focus(options);
  }

}

export function defineCheckbox (options: DefineOptions = {}): DefineResult {
  return defineStrict([[TAGS.checkbox, DropletCheckbox]], options);
}

declare global {
  interface HTMLElementTagNameMap {
    'droplet-checkbox': DropletCheckbox;
  }
}
