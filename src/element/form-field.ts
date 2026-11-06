import { DropletElement }     from './index.js';
import type { Border }      from './index.js';

import { AriaLink }         from '../utilities/index.js';
import { canonicalizeSize } from '../utilities/index.js';
import { emit }             from '../utilities/index.js';
import { FORWARDED_ARIA }   from '../utilities/index.js';
import { forwardAria }      from '../utilities/index.js';
import { reflectAttribute } from '../utilities/index.js';
import { replayProperties } from './configure.js';
import { SUBMIT_BUTTON }    from './submitter.js';

import { PALETTE }          from '../theme/index.js';
import { readToken } from '../theme/token-read.js';

export type FieldControl = HTMLInputElement | HTMLTextAreaElement;

// Each component appends more
export const FIELD_ATTRIBUTES: readonly string[] = [
  'id', 'value', 'placeholder', 'label', 'disabled', 'readonly',
  'autocomplete', 'no-autofill', 'size', ...FORWARDED_ARIA, ...DropletElement.AXIS_ATTRIBUTES,
];

// Properties a framework may assign before upgrade
export const FIELD_REPLAYED: readonly string[] = [
  'value', 'name', 'disabled', 'required', 'readOnly', 'placeholder',
  'minLength', 'maxLength', 'autocomplete',
];

const VALIDITY_FLAGS = [
  'valueMissing', 'typeMismatch', 'patternMismatch', 'tooLong', 'tooShort',
  'rangeUnderflow', 'rangeOverflow', 'stepMismatch', 'badInput', 'customError',
] as const;

// Per HTML "implicit submission"
const BLOCKING_TYPES = new Set([
  'text', 'search', 'url', 'tel', 'email', 'password', 'date', 'month',
  'week', 'time', 'datetime-local', 'number',
]);

type LabelRefs = { ariaLabelledByElements: Element[] | null };

// HTML "rules for parsing non-negative integers"; anything else is -1
function readLength (el: Element, name: string): number {
  const n = parseInt(el.getAttribute(name) ?? '', 10);

  return Number.isNaN(n) || n < 0 ? -1 : n;
}

function writeLength (el: Element, name: string, value: number): void {
  const n = Math.trunc(Number(value)) || 0;

  if (n < 0) {
    throw new DOMException(`The value provided (${n}) is negative.`, 'IndexSizeError');
  }

  reflectAttribute(el, name, n);
}

// droplet-button answers by its brand; a foreign element's getters are never read
function isSubmitButton (el: Element): boolean {
  if (el instanceof HTMLButtonElement) {
    return el.type === 'submit';
  }

  if (el instanceof HTMLInputElement) {
    return el.type === 'submit' || el.type === 'image';
  }

  return (el as { [SUBMIT_BUTTON]?: unknown })[SUBMIT_BUTTON] === true;
}

function isDisabledControl (el: Element): boolean {
  return el.matches(':disabled') || (el as { disabled?: unknown }).disabled === true;
}

function blocksImplicitSubmission (el: Element): boolean {
  if (el instanceof HTMLInputElement) {
    return BLOCKING_TYPES.has(el.type);
  }

  return el instanceof DropletFormField && el.blocksImplicitSubmission();
}

// HTML implicit submission: click the first submit button unless disabled; with none, submit if at most one field blocks
export function implicitlySubmit (form: HTMLFormElement): void {
  let blocking = 0;

  for (const el of Array.from(form.elements)) {
    if (isSubmitButton(el)) {
      if (!isDisabledControl(el)) {
        (el as HTMLElement).click();
      }
      return;
    }

    if (blocksImplicitSubmission(el)) {
      blocking++;
    }
  }

  if (blocking <= 1) {
    form.requestSubmit();
  }
}

export abstract class DropletFormField extends DropletElement implements EventListenerObject {

  static formAssociated = true;

  static override usesResolver = true;

  // Copied verbatim onto the inner control
  static CONSTRAINTS: readonly string[] = ['required', 'minlength', 'maxlength', 'inputmode', 'enterkeyhint'];

  internals: ElementInternals;
  focused = false;

  control: FieldControl | null = null;

  // HTML dirty value flag: once set, the value attribute stops driving the value
  dirty = false;

  // Applied when the inner control is built
  pendingValue: string | null = null;

  customMessage = '';

  // Set by formDisabledCallback
  formDisabled = false;

  // Set once the user commits an edit or a submit finds the field invalid
  userInteracted = false;

  ariaLink = new AriaLink(this, () => this.refreshAria());

  constructor () {
    super();

    this.internals = this.attachInternals();

    this.addEventListener('invalid', this);
    this.addEventListener('click', this);
  }

  // Subclasses call this from onBuilt()
  attachControl (control: FieldControl): void {
    this.control = control;

    // An ancestor <fieldset disabled> can precede its first formDisabledCallback
    if (!this.hasAttribute('disabled')) {
      this.formDisabled ||= this.matches(':disabled');
    }

    this.sync('placeholder');
    this.sync('readonly');
    this.sync('disabled');
    this.syncAutofill();

    for (const name of (this.constructor as typeof DropletFormField).CONSTRAINTS) {
      this.syncConstraint(name);
    }

    this.refreshAria();

    if (this.customMessage) {
      control.setCustomValidity(this.customMessage);
    }

    if (this.pendingValue !== null) {
      this.applyValue(this.pendingValue);
      this.pendingValue = null;
    } else {
      this.applyValue(this.defaultValue);
    }

    this.useHostFocusTarget(control);

    control.addEventListener('focus',  this);
    control.addEventListener('blur',   this);
    control.addEventListener('input',  this);
    control.addEventListener('change', this);

    this.updateValidity();
  }

  override connectedCallback (): void {
    replayProperties(this, (this.constructor as typeof DropletFormField).fieldReplayed());

    super.connectedCallback();

    // Labels and IDREF targets may have arrived since the last connect
    this.ariaLink.connect();

    if (this.control) {
      this.updateValidity();
    }
  }

  override disconnectedCallback (): void {
    super.disconnectedCallback();

    this.ariaLink.disconnect();
    this.internals.states.delete('user-invalid');
  }

  static fieldReplayed (): readonly string[] {
    return FIELD_REPLAYED;
  }

  // An explicit ARIA element set rewrites the same "" attribute, so aria-* syncs even unchanged
  attributeChangedCallback (name: string, oldValue: string | null, newValue: string | null): void {
    if (this.axisAttributeChanged(name)) {
      return;
    }

    if (this.control && (oldValue !== newValue || name.startsWith('aria-'))) {
      this.sync(name);
    }
  }

  sync (name: string): void {
    const control = this.control;

    if (!control) {
      return;
    }

    switch (name) {
      case 'value':
        if (!this.dirty) {
          this.applyValue(this.defaultValue);
        }
        break;

      case 'placeholder':
        control.placeholder = this.getAttribute('placeholder') ?? '';
        break;

      case 'disabled':
        control.disabled = this.fieldDisabled;
        this.syncHostFocusTarget();
        this.requestFrame();
        break;

      case 'readonly':
        control.readOnly = this.hasAttribute('readonly');
        break;

      case 'autocomplete':
      case 'no-autofill':
        this.syncAutofill();
        break;

      case 'size':
        canonicalizeSize(this);
        break;

      case 'id':
      case 'label':
      case 'aria-label':
      case 'aria-labelledby':
        this.syncName();
        break;

      default:
        if ((this.constructor as typeof DropletFormField).CONSTRAINTS.includes(name)) {
          this.syncConstraint(name);
        } else if (FORWARDED_ARIA.includes(name)) {
          forwardAria(this, control, name);
          this.requestFrame();
        }
    }

    this.updateValidity();
  }

  syncConstraint (name: string): void {
    const value = this.getAttribute(name);

    if (value === null) {
      this.control!.removeAttribute(name);
    } else if (this.control!.getAttribute(name) !== value) {
      this.control!.setAttribute(name, value);
    }
  }

  refreshAria (): void {
    if (!this.control) {
      return;
    }

    for (const name of FORWARDED_ARIA) {
      if (name !== 'aria-label' && name !== 'aria-labelledby' && this.hasAttribute(name)) {
        forwardAria(this, this.control!, name);
      }
    }

    this.syncName();
  }

  // `label` beats aria-label; with neither, host <label>s link by reference, since they name the roleless host
  syncName (): void {
    const control    = this.control!;
    const own        = this.getAttribute('label') || this.getAttribute('aria-label') || '';
    const labelledBy = this.hasAttribute('aria-labelledby');
    const reflects   = 'ariaLabelledByElements' in (control as object);
    const labels     = own || labelledBy ? [] : Array.from(this.internals.labels ?? []) as HTMLElement[];

    // Without element reflection the labels' text stands in; this is the inner aria-label's only writer
    const fallback = reflects ? '' : labels.map((label) => label.textContent?.trim() ?? '').join(' ').trim();
    const name     = own || fallback;

    if (name) {
      reflectAttribute(control, 'aria-label', name);
    } else {
      control.removeAttribute('aria-label');
    }

    if (labelledBy) {
      forwardAria(this, control, 'aria-labelledby');
    } else if (reflects) {
      (control as unknown as LabelRefs).ariaLabelledByElements = labels.length ? labels : null;
    }
  }

  // The data-* attributes are opt-outs the common password managers respect
  syncAutofill (): void {
    const control      = this.control!;
    const off          = this.hasAttribute('no-autofill');
    const autocomplete = this.getAttribute('autocomplete');

    control.autocomplete = (off ? 'off' : autocomplete || '') as AutoFill;
    control.toggleAttribute('data-lpignore', off);
    control.toggleAttribute('data-1p-ignore', off);
    control.toggleAttribute('data-bwignore', off);

    if (off) {
      control.setAttribute('data-form-type', 'other');
      control.setAttribute('autocorrect', 'off');
      control.setAttribute('autocapitalize', 'none');
      control.spellcheck = false;
    } else {
      control.removeAttribute('data-form-type');
      control.removeAttribute('autocorrect');
      control.removeAttribute('autocapitalize');
      control.removeAttribute('spellcheck');
    }
  }

  // Never emits; a file input only ever clears
  applyValue (value: string): void {
    const control = this.control!;

    control.value = control.type === 'file' ? '' : value;

    this.syncFormValue();
    this.onValueApplied();
  }

  // droplet-input's file type overrides this
  formValue (): string | FormData | null {
    return this.control!.value;
  }

  syncFormValue (): void {
    this.internals.setFormValue(this.formValue());
  }

  // For value-dependent layout (the textarea's auto-grow)
  onValueApplied (): void {}

  // Anchored on the control so native invalid-submit focuses it; a barred control has no message, hence the fallback
  updateValidity (): void {
    const control = this.control;

    if (!control) {
      return;
    }

    const validity = control.validity;
    const flags: ValidityStateFlags = {};
    let invalid = false;

    for (const flag of VALIDITY_FLAGS) {
      if (validity[flag]) {
        flags[flag] = true;
        invalid = true;
      }
    }

    if (invalid) {
      this.internals.setValidity(flags, control.validationMessage || this.customMessage || 'Invalid value.', control);
    } else {
      this.internals.setValidity({});
    }

    this.updateUserInvalid();
  }

  // The only writer of :state(user-invalid)
  updateUserInvalid (): void {
    const invalid = this.userInteracted && this.internals.willValidate && !this.internals.validity.valid;

    if (invalid !== this.internals.states.has('user-invalid')) {
      if (invalid) {
        this.internals.states.add('user-invalid');
      } else {
        this.internals.states.delete('user-invalid');
      }

      this.requestFrame();
    }
  }

  get fieldDisabled (): boolean {
    return this.hasAttribute('disabled') || this.formDisabled;
  }

  // aria-invalid tokens are case-insensitive; absent, empty, and false mean valid
  get paintsInvalid (): boolean {
    const aria = this.getAttribute('aria-invalid')?.trim().toLowerCase() ?? '';

    return this.internals.states.has('user-invalid') || (aria !== '' && aria !== 'false');
  }

  // droplet-input overrides; a textarea never blocks implicit submission
  blocksImplicitSubmission (): boolean {
    return false;
  }

  override fill (): string {
    if (this.fieldDisabled) {
      return this.resolveColor(`var(--jelly-color-background-neutral, var(--droplet-color-background-neutral, ${PALETTE['background-neutral']}))`);
    }

    if (this.focused) {
      return this.resolveColor(`var(--jelly-color-background-surface, var(--droplet-color-background-surface, ${PALETTE['background-surface']}))`);
    }

    const custom = readToken(getComputedStyle(this), 'fill').trim();

    return custom || this.resolveColor(`var(--jelly-color-background-muted, var(--droplet-color-background-muted, ${PALETTE['background-muted']}))`);
  }

  override surfaceBorder (): Border {
    let color: string;

    if (this.paintsInvalid) {
      color = this.resolveColor(`var(--jelly-color-background-rose, var(--droplet-color-background-rose, ${PALETTE['background-rose']}))`);
    } else if (this.focused) {
      color = this.resolveColor(`var(--jelly-accent, var(--droplet-accent, var(--jelly-color-background-accent, var(--droplet-color-background-accent, ${PALETTE['background-accent']}))))`);
    } else {
      color = this.resolveColor(`var(--jelly-color-background-neutral, var(--droplet-color-background-neutral, ${PALETTE['background-neutral']}))`);
    }

    return { color, width: 1 };
  }

  handleEvent (event: Event): void {
    switch (event.type) {
      case 'focus':
        this.handleFocus();
        break;

      case 'blur':
        this.handleBlur();
        break;

      case 'input':
        this.dirty = true;
        this.syncFormValue();
        this.updateValidity();
        this.handleInput();
        break;

      case 'change':
        this.userInteracted = true;
        this.updateUserInvalid();
        emit(this, 'change');
        break;

      case 'invalid':
        this.userInteracted = true;
        this.updateUserInvalid();
        break;

      case 'click':
        this.handleHostClick(event);
        break;
    }
  }

  handleFocus (): void {
    this.focused      = true;
    this.focusVisible = true;

    this.requestFrame();
  }

  handleBlur (): void {
    this.focused      = false;
    this.focusVisible = false;

    this.requestFrame();
  }

  // Subclasses ripple the membrane here
  handleInput (): void {}

  // A <label> activating the host moves focus inside
  handleHostClick (event: Event): void {
    const control = this.control;

    if (control && event.composedPath()[0] === this && !this.fieldDisabled && this.shadowRoot!.activeElement !== control) {
      control.focus();
    }
  }

  formResetCallback (): void {
    this.dirty          = false;
    this.pendingValue   = null;
    this.userInteracted = false;

    if (this.control) {
      this.applyValue(this.defaultValue);
      this.updateValidity();
    }
  }

  formDisabledCallback (disabled: boolean): void {
    this.formDisabled = disabled;
    this.sync('disabled');
  }

  // File selections never restore, as natively; a string state would throw in the file value setter
  formStateRestoreCallback (state: string | File | FormData | null): void {
    if (typeof state === 'string' && !this.fileField) {
      this.value = state;
    }
  }

  get fileField (): boolean {
    return (this.control?.type ?? this.getAttribute('type')?.toLowerCase()) === 'file';
  }

  // The `value` attribute is only the default
  get value (): string {
    return this.control ? this.control.value : this.pendingValue ?? this.defaultValue;
  }

  set value (v: string) {
    const next = v === null ? '' : String(v);

    // Native file inputs refuse a scripted filename; only clearing is allowed
    if (next !== '' && this.fileField) {
      throw new DOMException('A file input may only be programmatically set to the empty string.', 'InvalidStateError');
    }

    this.dirty = true;

    if (!this.control) {
      this.pendingValue = next;
      return;
    }

    this.applyValue(next);
    this.updateValidity();
  }

  get defaultValue (): string {
    return this.getAttribute('value') ?? '';
  }

  set defaultValue (v: string) {
    reflectAttribute(this, 'value', v);
  }

  get name (): string {
    return this.getAttribute('name') ?? '';
  }

  set name (v: string) {
    reflectAttribute(this, 'name', v);
  }

  get disabled (): boolean {
    return this.hasAttribute('disabled');
  }

  set disabled (v: boolean) {
    this.toggleAttribute('disabled', Boolean(v));
  }

  get required (): boolean {
    return this.hasAttribute('required');
  }

  set required (v: boolean) {
    this.toggleAttribute('required', Boolean(v));
  }

  get readOnly (): boolean {
    return this.hasAttribute('readonly');
  }

  set readOnly (v: boolean) {
    this.toggleAttribute('readonly', Boolean(v));
  }

  get placeholder (): string {
    return this.getAttribute('placeholder') ?? '';
  }

  set placeholder (v: string) {
    reflectAttribute(this, 'placeholder', v);
  }

  get autocomplete (): string {
    return this.getAttribute('autocomplete') ?? '';
  }

  set autocomplete (v: string) {
    reflectAttribute(this, 'autocomplete', v);
  }

  get minLength (): number {
    return readLength(this, 'minlength');
  }

  set minLength (v: number) {
    writeLength(this, 'minlength', v);
  }

  get maxLength (): number {
    return readLength(this, 'maxlength');
  }

  set maxLength (v: number) {
    writeLength(this, 'maxlength', v);
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
    this.control?.setCustomValidity(this.customMessage);

    if (this.control) {
      this.updateValidity();
    } else if (this.customMessage) {
      // Before build there is no anchor yet; the form still has to see the error
      this.internals.setValidity({ customError: true }, this.customMessage);
    } else {
      this.internals.setValidity({});
    }
  }

  override focus (options?: FocusOptions): void {
    this.control?.focus(options);
  }

}
