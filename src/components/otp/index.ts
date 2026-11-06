import { emit }                 from '../../utilities/index.js';
import { FORWARDED_ARIA }       from '../../utilities/index.js';
import { forwardAria }          from '../../utilities/index.js';
import { reflectAttribute }     from '../../utilities/index.js';
import { canonicalizeSize }     from '../../utilities/index.js';
import { prefersReducedMotion } from '../../utilities/index.js';

import { ensureThemeTokens }    from '../../theme/index.js';
import { syncColorPick }        from '../../theme/pick.js';
import { variantColors }        from '../../theme/index.js';
import { HTMLElementBase }      from '../../element/base.js';
import { defineStrict, TAGS }   from '../../registry/index.js';
import type { DefineOptions, DefineResult } from '../../registry/index.js';

import otpStyles                from './otp.css?inline';

/**
 * A one-time-code input with one box per digit.
 *
 * @element droplet-otp
 *
 * @attr {number} length - Number of digit boxes (defaults to 6).
 * @attr {string} label - Accessible name for the group.
 * @attr {string} name - Form field name submitted with the joined code.
 * @attr {boolean} disabled - Disable all boxes.
 * @attr {boolean} required - Invalid (valueMissing) until every box is filled.
 * @attr {"small"|"medium"|"large"} size - Box size.
 * @attr {"white"|"rose"|"amber"|"azure"|"mint"|"platinum"|"graphite"} variant - Accent hue.
 * @attr {string} color - Any CSS color for the fill or accent (beats intent and variant); text or a mark on it turns white or near-black, whichever reads better.
 * @attr {"accent"|"neutral"|"info"|"success"|"warning"|"danger"|"highlight"} intent - Semantic color role (never an ARIA role); beats variant.
 *
 * @fires input - On every change.
 * @fires change - When the code becomes complete.
 * @fires complete - With `detail.value` when every box is filled.
 */
export class DropletOtp extends HTMLElementBase {

  static define (options?: DefineOptions): DefineResult {
    return defineOtp(options);
  }

  static formAssociated = true;

  internals?: ElementInternals;
  boxes: HTMLInputElement[] = [];

  customMessage = '';

  formDisabled = false;

  forwardedAria = new Set<string>();

  static get observedAttributes (): string[] {
    return ['length', 'size', 'variant', 'color', 'disabled', 'label', 'required', ...FORWARDED_ARIA];
  }

  connectedCallback (): void {
    ensureThemeTokens();
    canonicalizeSize(this);

    if (!this.shadowRoot) {
      this.internals = this.attachInternals?.();

      this.attachShadow({ mode: 'open', delegatesFocus: true });
    }

    this.render();
    this.refreshAria();
    syncColorPick(this);
    this.addEventListener('click', this.onLabelActivation);
  }

  disconnectedCallback (): void {
    this.removeEventListener('click', this.onLabelActivation);
  }

  // A host <label> click lands on the host; the first open box takes focus
  onLabelActivation = (event: MouseEvent): void => {
    if (event.composedPath()[0] !== this || this.isDisabled) {
      return;
    }

    (this.boxes.find((box) => !box.value) ?? this.boxes[0])?.focus();
  };

  attributeChangedCallback (name: string): void {
    if (!this.shadowRoot) {
      return;
    }

    if (name === 'required') {
      this.updateValidity();
      return;
    }

    if (name === 'color') {
      syncColorPick(this);
      return;
    }

    if (name.startsWith('aria-')) {
      this.syncLabel();
      this.refreshAria();
      return;
    }

    switch (name) {
      case 'size':     canonicalizeSize(this);  break;
      case 'length':   this.render();           break;
      case 'disabled': this.syncDisabled();     break;
      case 'label':    this.syncLabel(); this.refreshAria(); break;
    }
  }

  render (): void {
    const count = Math.max(1, parseInt(this.getAttribute('length') ?? '', 10) || 6);

    if (this.boxes && this.boxes.length === count) {
      return;
    }

    this.shadowRoot!.innerHTML = `
      <style>${otpStyles}${variantColors({ color: '--droplet-otp-accent', ring: '--droplet-ring' })}</style>

      <div class="row" role="group" aria-label="One-time code"></div>
    `;

    const row = this.shadowRoot!.querySelector('.row')!;

    this.boxes = [];

    for (let i = 0; i < count; i++) {
      const input = document.createElement('input');

      input.inputMode    = 'numeric';
      input.autocomplete = (i === 0 ? 'one-time-code' : 'off') as AutoFill;
      input.maxLength    = 1;

      input.setAttribute('aria-label', `Digit ${i + 1}`);

      input.addEventListener('input', (event) => this.onInput(event, i));
      input.addEventListener('keydown', (event) => this.onKey(event, i));
      input.addEventListener('paste', (event) => this.onPaste(event, i));
      input.addEventListener('focus', () => input.select());

      row.appendChild(input);
      this.boxes.push(input);
    }

    this.removeAttribute('tabindex');
    this.syncDisabled();
    this.syncLabel();
    this.refreshAria();

    this.internals?.setFormValue('');
    this.updateValidity();
  }

  get isDisabled (): boolean {
    return this.hasAttribute('disabled') || this.formDisabled;
  }

  syncDisabled (): void {
    const disabled = this.isDisabled;

    for (const box of this.boxes || []) {
      box.disabled = disabled;
    }
  }

  // Host aria-* belongs on the group of boxes
  refreshAria (): void {
    const row = this.shadowRoot?.querySelector('.row');

    if (!row) {
      return;
    }

    for (const name of FORWARDED_ARIA) {
      if (name === 'aria-label') continue;

      if (this.hasAttribute(name)) {
        forwardAria(this, row, name);
        this.forwardedAria.add(name);
      } else if (this.forwardedAria.has(name)) {
        forwardAria(this, row, name);
        this.forwardedAria.delete(name);
      }
    }

    // An outer <label> names the group only when the host has no other name
    const named  = this.hasAttribute('label') || this.hasAttribute('aria-label') || this.hasAttribute('aria-labelledby');
    const labels = named ? [] : Array.from(this.internals?.labels ?? []) as Element[];

    if ('ariaLabelledByElements' in row && !this.hasAttribute('aria-labelledby') && (labels.length || this.linkedLabels)) {
      (row as unknown as { ariaLabelledByElements: Element[] | null }).ariaLabelledByElements = labels.length ? labels : null;
      this.linkedLabels = labels.length > 0;
    }
  }

  linkedLabels = false;

  // A partial code is unusable, so required means every box is filled
  updateValidity (): void {
    const internals = this.internals;

    if (!internals) {
      return;
    }

    const missing = this.hasAttribute('required') && !this.isDisabled && this.value.length < this.boxes.length;
    const anchor  = this.boxes.find((box) => !box.value) ?? this.boxes[0];

    if (this.customMessage) {
      internals.setValidity({ customError: true, valueMissing: missing }, this.customMessage, anchor);
    } else if (missing) {
      internals.setValidity({ valueMissing: true }, 'Please enter the whole code.', anchor);
    } else {
      internals.setValidity({});
    }
  }

  formDisabledCallback (disabled: boolean): void {
    this.formDisabled = disabled;
    this.syncDisabled();
    this.updateValidity();
  }

  formResetCallback (): void {
    this.value = '';
  }

  formStateRestoreCallback (state: string | File | FormData | null): void {
    if (typeof state === 'string') {
      this.value = state;
    }
  }

  get form (): HTMLFormElement | null {
    return this.internals?.form ?? null;
  }

  get labels (): NodeList | null {
    return this.internals?.labels ?? null;
  }

  get validity (): ValidityState | null {
    return this.internals?.validity ?? null;
  }

  get validationMessage (): string {
    return this.internals?.validationMessage ?? '';
  }

  get willValidate (): boolean {
    return this.internals?.willValidate ?? false;
  }

  checkValidity (): boolean {
    return this.internals?.checkValidity() ?? true;
  }

  reportValidity (): boolean {
    return this.internals?.reportValidity() ?? true;
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

  syncLabel (): void {
    const row = this.shadowRoot!.querySelector('.row');

    row?.setAttribute('aria-label', this.getAttribute('label') || this.getAttribute('aria-label') || 'One-time code');
  }

  reveal (index: number, delay = 0): void {
    if (prefersReducedMotion()) {
      return;
    }

    this.boxes[index]?.animate?.(
      [
        { opacity: 0, transform: 'translateY(6px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ],
      { duration: 260, delay, easing: 'cubic-bezier(.2,.7,.2,1)' },
    );
  }

  completeReveal (): void {
    if (prefersReducedMotion()) {
      return;
    }

    this.shadowRoot!.querySelector('.row')?.animate?.(
      [
        { opacity: 0.82 },
        { opacity: 1 },
      ],
      { duration: 420, easing: 'ease-out' },
    );
  }

  onInput (event: Event, index: number): void {
    // The native input event is composed; stop it so announce() emits the only 'input'
    event.stopPropagation();

    const box   = event.target as HTMLInputElement;
    const digit = box.value.replace(/\D/g, '').slice(-1);

    box.value = digit;

    if (digit) {
      this.reveal(index);

      if (index < this.boxes.length - 1) {
        this.boxes[index + 1]?.focus();
      }
    }

    this.announce();
  }

  // Physical arrows are correct because otp.css pins the row LTR
  onKey (event: KeyboardEvent, index: number): void {
    const box = event.target as HTMLInputElement;

    if (event.key === 'Backspace' && !box.value && index > 0) {
      this.boxes[index - 1]?.focus();
    } else if (event.key === 'ArrowLeft' && index > 0) {
      this.boxes[index - 1]?.focus();
    } else if (event.key === 'ArrowRight' && index < this.boxes.length - 1) {
      this.boxes[index + 1]?.focus();
    }
  }

  onPaste (event: ClipboardEvent, index: number): void {
    event.preventDefault();

    const digits = (event.clipboardData?.getData('text') || '').replace(/\D/g, '').split('');

    for (let k = 0; k + index < this.boxes.length && k < digits.length; k++) {
      const box = this.boxes[index + k];
      const digit = digits[k];

      if (!box || digit === undefined) {
        break;
      }

      box.value = digit;
      this.reveal(index + k, k * 45);
    }

    const next = Math.min(this.boxes.length - 1, index + digits.length);

    this.boxes[next]?.focus();
    this.announce();
  }

  announce (): void {
    const value = this.value;

    this.internals?.setFormValue(value);
    this.updateValidity();

    emit(this, 'input');

    if (value.length === this.boxes.length) {
      this.completeReveal();

      // 'change' is the shared commit event; 'complete' also carries the value
      emit(this, 'change');
      emit(this, 'complete', { value });
    }
  }

  get value (): string {
    return this.boxes.map((box) => box.value).join('');
  }

  set value (value: string) {
    const chars = String(value).split('');

    this.boxes.forEach((box, i) => {
      box.value = chars[i] || '';
    });

    this.internals?.setFormValue(this.value);
    this.updateValidity();
  }

  override focus (options?: FocusOptions): void {
    this.boxes?.[0]?.focus(options);
  }

}

export function defineOtp (options: DefineOptions = {}): DefineResult {
  return defineStrict([[TAGS.otp, DropletOtp]], options);
}

declare global {
  interface HTMLElementTagNameMap {
    'droplet-otp': DropletOtp;
  }
}
