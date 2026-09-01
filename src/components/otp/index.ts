/*
 * A one-time-code input: one box per digit, with typing, backspace,
 * arrow and paste handling. Each filled digit settles in softly.
 * Form-associated, so the joined code submits like a native field
 *
 * Emits `input` on every change and `complete` (detail.value) when all
 * boxes are filled.
 */

import { emit }                 from '../../utilities/index.js';
import { canonicalizeSize }     from '../../utilities/index.js';
import { prefersReducedMotion } from '../../utilities/index.js';

import { ensureThemeTokens }    from '../../theme/index.js';
import { variantColors }        from '../../theme/index.js';

import otpStyles                from './otp.css?inline';

/**
 * A one-time-code input with one box per digit.
 *
 * @element jelly-otp
 *
 * @attr {number} length - Number of digit boxes (defaults to 6).
 * @attr {string} label - Accessible name for the group.
 * @attr {string} name - Form field name submitted with the joined code.
 * @attr {boolean} disabled - Disable all boxes.
 * @attr {"small"|"medium"|"large"} size - Box size.
 * @attr {"white"|"rose"|"amber"|"azure"|"mint"|"platinum"|"graphite"} variant - Accent hue.
 *
 * @fires input - On every change.
 * @fires change - When the code becomes complete.
 * @fires complete - With `detail.value` when every box is filled.
 */
export class JellyOtp extends HTMLElement {

  // Participate in forms via ElementInternals
  static formAssociated = true;

  internals?: ElementInternals;
  boxes: HTMLInputElement[] = [];

  // Tells the browser to trigger attributeChangedCallback when these attributes change
  static get observedAttributes (): string[] {
    return ['length', 'size', 'variant', 'disabled', 'label'];
  }

  // Lifecycle method: Called automatically when the element is appended to the DOM
  connectedCallback (): void {
    ensureThemeTokens();
    canonicalizeSize(this);

    if (!this.shadowRoot) {
      this.internals = this.attachInternals?.();

      // Encapsulate styles and markup inside a Shadow DOM so they don't leak out
      this.attachShadow({ mode: 'open', delegatesFocus: true });
    }

    this.render();
  }

  // Lifecycle method: Fires when observed HTML attributes change dynamically
  attributeChangedCallback (name: string): void {
    if (!this.shadowRoot) {
      return;
    }

    switch (name) {
      case 'size':     canonicalizeSize(this);  break;
      case 'length':   this.render();           break;
      case 'disabled': this.syncDisabled();     break;
      case 'label':    this.syncLabel();        break;
    }
  }

  // Build one input box per digit (rebuilds when `length` changes)
  render (): void {
    const count = Math.max(1, parseInt(this.getAttribute('length') ?? '', 10) || 6);

    if (this.boxes && this.boxes.length === count) {
      return;
    }

    this.shadowRoot!.innerHTML = `
      <style>${otpStyles}${variantColors({ color: '--jelly-otp-accent', ring: '--jelly-ring' })}</style>

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

    this.internals?.setFormValue('');
  }

  // Mirror the disabled attribute onto every box (observed live)
  syncDisabled (): void {
    const disabled = this.hasAttribute('disabled');

    for (const box of this.boxes || []) {
      box.disabled = disabled;
    }
  }

  // Map the label attribute onto the group's accessible name
  syncLabel (): void {
    const row = this.shadowRoot!.querySelector('.row');

    row?.setAttribute('aria-label', this.getAttribute('label') || 'One-time code');
  }

  // A filled digit settles in softly (the box itself stays put)
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

  // A quiet confirmation when every box is filled
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

  // Accept one digit, reveal it and hop to the next box
  onInput (event: Event, index: number): void {
    // The box's native input event is composed and would retarget to the host
    // on its own; stop it so announce()'s single custom 'input' is the only one
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

  // Backspace hops back when empty; arrows move between boxes.
  // The row is pinned LTR, so the physical arrow directions are correct.
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

  // Distribute pasted digits across the remaining boxes
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

  // Push the joined value to the form and notify listeners
  announce (): void {
    const value = this.value;

    this.internals?.setFormValue(value);

    emit(this, 'input');

    if (value.length === this.boxes.length) {
      this.completeReveal();

      // 'change' matches every other form control's commit event; 'complete'
      // stays as a code-specific alias that also carries the finished value
      emit(this, 'change');
      emit(this, 'complete', { value });
    }
  }

  // The joined code across all boxes
  get value (): string {
    return this.boxes.map((box) => box.value).join('');
  }

  set value (value: string) {
    const chars = String(value).split('');

    this.boxes.forEach((box, i) => {
      box.value = chars[i] || '';
    });

    this.internals?.setFormValue(this.value);
  }

  // Route programmatic host focus onto the first box
  override focus (options?: FocusOptions): void {
    this.boxes?.[0]?.focus(options);
  }

}

// Register the custom element
customElements.define('jelly-otp', JellyOtp);

declare global {
  interface HTMLElementTagNameMap {
    'jelly-otp': JellyOtp;
  }
}
