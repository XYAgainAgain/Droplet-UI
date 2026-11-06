import type { DropletElement } from './index.js';

import { AriaLink }         from '../utilities/index.js';
import { FORWARDED_ARIA }   from '../utilities/index.js';
import { forwardAria }      from '../utilities/index.js';
import { reflectAttribute } from '../utilities/index.js';

// TypeScript requires a mixin base's constructor to take exactly ...any[]
type Ctor<T> = abstract new (...args: any[]) => T;

export const FORM_ATTRIBUTES: readonly string[] = ['required', ...FORWARDED_ARIA];

export type RestoreState = string | File | FormData | null;

// Named so .d.ts files needn't spell out all of HTMLElement for the mixin
export interface FormControlMembers {
  internals: ElementInternals;
  customMessage: string;
  formDisabled: boolean;
  linkedLabels: boolean;
  forwardedAria: Set<string>;
  readonly isDisabled: boolean;
  readonly form: HTMLFormElement | null;
  readonly labels: NodeList;
  readonly validity: ValidityState;
  readonly validationMessage: string;
  readonly willValidate: boolean;
  name: string;
  disabled: boolean;
  required: boolean;
  formAnchor (): HTMLElement | null;
  formValueMissing (): boolean;
  formRequired (): boolean;
  formOwnLabels (): Element[];
  formAriaTarget (): HTMLElement | null;
  formReset (): void;
  formRestore (state: RestoreState): void;
  syncDisabled (): void;
  formActivate (): void;
  refreshAria (): void;
  forwardAriaTo (target: Element, skip?: readonly string[]): void;
  formAttributeChanged (name: string): boolean;
  updateValidity (): void;
  formDisabledCallback (disabled: boolean): void;
  formResetCallback (): void;
  formStateRestoreCallback (state: RestoreState): void;
  checkValidity (): boolean;
  reportValidity (): boolean;
  setCustomValidity (message: string): void;
}

export function FormControl<TBase extends Ctor<DropletElement>> (Base: TBase): TBase & Ctor<FormControlMembers> {

  abstract class FormControlled extends Base {

    abstract internals: ElementInternals;

    customMessage = '';

    // From an ancestor <fieldset disabled>
    formDisabled = false;

    ariaLink = new AriaLink(this, () => this.refreshAria());

    // Takes focus, anchors validity, and receives forwarded aria-*
    abstract formAnchor (): HTMLElement | null;

    // False when the control has no notion of a missing value
    formValueMissing (): boolean {
      return false;
    }

    // Radios answer for their whole group here
    formRequired (): boolean {
      return this.hasAttribute('required');
    }

    // Where host aria-* and outer labels land; a group control returns its group element
    formAriaTarget (): HTMLElement | null {
      return this.formAnchor();
    }

    // Shadow elements that already name the control, kept beside any outer <label>
    formOwnLabels (): Element[] {
      return [];
    }

    linkedLabels = false;

    abstract formReset (): void;

    abstract formRestore (state: RestoreState): void;

    abstract syncDisabled (): void;

    get isDisabled (): boolean {
      return this.hasAttribute('disabled') || this.formDisabled;
    }

    override connectedCallback (): void {
      super.connectedCallback();

      // A fieldset disabled before the first formDisabledCallback still disables
      this.formDisabled ||= this.matches(':disabled') && !this.hasAttribute('disabled');

      this.ariaLink.connect();
      this.addEventListener('click', this.onLabelActivation);
      this.updateValidity();
    }

    override disconnectedCallback (): void {
      super.disconnectedCallback();

      this.ariaLink.disconnect();
      this.removeEventListener('click', this.onLabelActivation);
    }

    // A <label> naming the host clicks the host itself; hand that to the inner control
    onLabelActivation = (event: MouseEvent): void => {
      if (event.composedPath()[0] !== this || this.isDisabled) {
        return;
      }

      this.formActivate();
    };

    // Checkables override this to toggle
    formActivate (): void {
      this.formAnchor()?.focus();
    }

    // Host <label>s name the roleless host, so they link by reference, as in syncName() in form-field.ts
    refreshAria (): void {
      const anchor = this.formAriaTarget();

      if (!anchor) {
        return;
      }

      const own = this.hasAttribute('label');

      this.forwardAriaTo(anchor, own ? ['aria-label'] : []);

      const labels = own || this.hasAttribute('aria-labelledby') ? [] : Array.from(this.internals.labels ?? []) as Element[];

      // Only when outer labels exist or did, so a name from shadow markup (a radio's aria-labelledby) survives
      if ('ariaLabelledByElements' in anchor && !this.hasAttribute('aria-labelledby') && (labels.length || this.linkedLabels)) {
        const inner = this.formOwnLabels();
        const all = labels.length ? [...labels, ...inner] : inner;

        (anchor as unknown as { ariaLabelledByElements: Element[] | null }).ariaLabelledByElements = all.length ? all : null;
        this.linkedLabels = labels.length > 0;
      }
    }

    // Removing a forwarded name never clears aria-* the control writes (aria-expanded, aria-checked)
    forwardedAria = new Set<string>();

    forwardAriaTo (target: Element, skip: readonly string[] = []): void {
      for (const name of FORWARDED_ARIA) {
        if (skip.includes(name)) continue;

        if (this.hasAttribute(name)) {
          forwardAria(this, target, name);
          this.forwardedAria.add(name);
        } else if (this.forwardedAria.has(name)) {
          forwardAria(this, target, name);
          this.forwardedAria.delete(name);

          // That also cleared the shadow's labelling, which refreshAria restores
          if (name === 'aria-labelledby') this.linkedLabels = true;
        }
      }
    }

    // True when handled here
    formAttributeChanged (name: string): boolean {
      if (name === 'required') {
        this.updateValidity();
        return true;
      }

      if (name.startsWith('aria-')) {
        this.refreshAria();
        return true;
      }

      return false;
    }

    updateValidity (): void {
      const missing = this.formRequired() && !this.isDisabled && this.formValueMissing();
      const anchor  = this.formAnchor() ?? undefined;

      if (this.customMessage) {
        this.internals.setValidity({ customError: true, valueMissing: missing }, this.customMessage, anchor);
      } else if (missing) {
        this.internals.setValidity({ valueMissing: true }, 'Please fill out this field.', anchor);
      } else {
        this.internals.setValidity({});
      }
    }

    formDisabledCallback (disabled: boolean): void {
      this.formDisabled = disabled;
      this.syncDisabled();
      this.updateValidity();
    }

    formResetCallback (): void {
      this.formReset();
      this.updateValidity();
    }

    formStateRestoreCallback (state: RestoreState): void {
      this.formRestore(state);
      this.updateValidity();
    }

    get form (): HTMLFormElement | null {
      return this.internals.form;
    }

    get labels (): NodeList {
      return this.internals.labels;
    }

    get validity (): ValidityState {
      return this.internals.validity;
    }

    get validationMessage (): string {
      return this.internals.validationMessage;
    }

    get willValidate (): boolean {
      return this.internals.willValidate;
    }

    checkValidity (): boolean {
      return this.internals.checkValidity();
    }

    reportValidity (): boolean {
      return this.internals.reportValidity();
    }

    setCustomValidity (message: string): void {
      this.customMessage = message === null ? '' : String(message);
      this.updateValidity();
    }

    get name (): string {
      return this.getAttribute('name') ?? '';
    }

    set name (value: string) {
      reflectAttribute(this, 'name', value);
    }

    get disabled (): boolean {
      return this.hasAttribute('disabled');
    }

    set disabled (value: boolean) {
      this.toggleAttribute('disabled', Boolean(value));
    }

    get required (): boolean {
      return this.hasAttribute('required');
    }

    set required (value: boolean) {
      this.toggleAttribute('required', Boolean(value));
    }

  }

  return FormControlled;
}
