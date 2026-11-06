import { DropletElement }     from '../../element/index.js';
import { FORM_ATTRIBUTES }    from '../../element/form-control.js';
import { FormControl }        from '../../element/form-control.js';
import type { RestoreState }  from '../../element/form-control.js';
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
 * A squishy, form-associated checkbox backed by a real native checkbox.
 *
 * @element droplet-checkbox
 *
 * @slot - The label text shown beside the box.
 *
 * @attr {boolean} checked - Whether the box is checked.
 * @attr {boolean} indeterminate - Show the mixed (dash) state; cleared by a user toggle.
 * @attr {boolean} disabled - Disable the control and remove it from the tab order.
 * @attr {string} label - Accessible name when there is no slotted label.
 * @attr {string} value - Form value submitted while checked (defaults to "on").
 * @attr {string} name - Form field name submitted with the control's value.
 * @attr {boolean} required - Invalid (valueMissing) while unchecked; blocks form submission.
 * @attr {"small"|"medium"|"large"} size - Control size.
 * @attr {"white"|"rose"|"amber"|"azure"|"mint"|"platinum"|"graphite"} variant - Checked fill hue.
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
 * @fires change - When the checked state changes through user interaction.
 *
 * @csspart wrap - The label wrapper.
 * @csspart input - The visually-hidden native checkbox.
 *
 * @cssprop [--droplet-checkbox-size=32px] - Box size.
 * @cssprop [--droplet-on] - Checked fill color.
 * @cssprop [--droplet-checkbox-mark] - Check-mark color.
 */
export class DropletCheckbox extends FormControl(DropletElement) {

  static define (options?: DefineOptions): DefineResult {
    return defineCheckbox(options);
  }

  static override usesResolver = true;

  static override textOnFill = false;

  static formAssociated = true;

  override internals: ElementInternals;

  input!: HTMLInputElement;

  // A uniform scale spring: the box pops, never wiggles
  scale = 1;
  scaleVelocity = 0;

  static get observedAttributes (): string[] {
    return ['checked', 'disabled', 'indeterminate', 'label', 'size', 'value', ...DropletElement.AXIS_ATTRIBUTES, ...FORM_ATTRIBUTES];
  }

  constructor () {
    super();

    this.internals = this.attachInternals();
  }

  override styles (): string {
    return checkboxStyles + variantColors({ color: '--droplet-on', on: '--droplet-checkbox-mark' });
  }

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

  // The box only, not the label
  override shape (width: number, height: number): Shape {
    const size = Math.min(width, height);

    return { width: size, height: size, radius: size * 0.32 };
  }

  override fill (): string {
    return this.checked || this.indeterminate
      ? this.resolveColor(`var(--jelly-on, var(--droplet-on, ${PALETTE['background-accent']}))`)
      : this.resolveColor(`var(--jelly-fill, var(--droplet-fill, ${PALETTE['background-neutral']}))`);
  }

  override onBuilt (): void {
    this.input = this.shadowRoot!.querySelector('input')!;

    this.sync('checked');
    this.sync('indeterminate');
    this.sync('disabled');
    this.sync('label');

    this.useHostFocusTarget(this.input);
    this.trackFocus(this.input);

    this.input.addEventListener('change', () => {
      this.indeterminate = false;

      this.toggleAttribute('checked', this.input.checked);
      this.syncFormValue();

      this.pop(this.input.checked ? 4 : -3);
      triggerHaptic();

      emit(this, 'change');
    });
  }

  pop (v: number): void {
    if (this.reducedMotion) {
      return;
    }

    this.scaleVelocity += v;
    this.requestFrame();
  }

  override frame (dt: number): boolean {
    const body = this.body;

    if (!body) {
      return false;
    }

    [this.scale, this.scaleVelocity] = integrateSpring(this.scale, this.scaleVelocity, 1, 260, 17, dt);

    this.clearCanvas();
    this.paintBody(body, { fill: this.fill(), scaleX: this.scale, scaleY: this.scale, ring: this.focusRing() });

    return Math.abs(1 - this.scale) > 0.0015 || Math.abs(this.scaleVelocity) > 0.0015;
  }

  syncFormValue (): void {
    this.internals.setFormValue(this.input.checked ? this.value : null);
  }

  attributeChangedCallback (name: string): void {
    if (this.axisAttributeChanged(name) || this.formAttributeChanged(name)) {
      return;
    }

    if (this.input) {
      this.sync(name);
    }
  }

  sync (name: string): void {
    switch (name) {
      case 'checked':
        this.input.checked = this.checked;
        this.syncFormValue();
        this.updateValidity();
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
        this.syncDisabled();
        this.updateValidity();
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

  get checked (): boolean {
    return this.hasAttribute('checked');
  }

  set checked (value: boolean) {
    this.toggleAttribute('checked', Boolean(value));
  }

  get indeterminate (): boolean {
    return this.hasAttribute('indeterminate');
  }

  set indeterminate (value: boolean) {
    this.toggleAttribute('indeterminate', Boolean(value));
  }

  get value (): string {
    return this.getAttribute('value') || 'on';
  }

  set value (value: string) {
    this.setAttribute('value', String(value));
  }

  override focus (options?: FocusOptions): void {
    this.input?.focus(options);
  }

  defaultCheckedValue: boolean | null = null;

  // Captured at first connect, since checked is the live attribute
  get defaultChecked (): boolean {
    return this.defaultCheckedValue ?? this.hasAttribute('checked');
  }

  set defaultChecked (value: boolean) {
    this.defaultCheckedValue = Boolean(value);
  }

  override connectedCallback (): void {
    this.defaultCheckedValue ??= this.hasAttribute('checked');

    super.connectedCallback();
  }

  override formAnchor (): HTMLElement | null {
    return this.input ?? null;
  }

  override formValueMissing (): boolean {
    return !this.checked;
  }

  override formOwnLabels (): Element[] {
    const label = this.shadowRoot?.querySelector('.label');

    return label ? [label] : [];
  }

  override formActivate (): void {
    this.input?.click();
  }

  override formReset (): void {
    this.checked = this.defaultChecked;
  }

  override formRestore (state: RestoreState): void {
    this.checked = state !== null && state !== '';
  }

  override syncDisabled (): void {
    if (!this.input) {
      return;
    }

    this.input.disabled = this.isDisabled;
    this.syncHostFocusTarget();
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
