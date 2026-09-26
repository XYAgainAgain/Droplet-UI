/*
 * A single-line text field resting on a soft jelly surface. A real <input>
 * is overlaid on the canvas; focusing it lifts the fill onto the elevated
 * surface color, pops the membrane and paints a colored ring and every
 * keystroke sends a small ripple through the surface at the caret - RTL-
 * aware, so the ripple lands under the caret in either direction. Form-
 * associated like a native field: it submits under `name`, validates,
 * resets, and Enter submits its form
 */

import { JellyFormField }   from '../../element/form-field.js';
import { FIELD_ATTRIBUTES } from '../../element/form-field.js';
import { FIELD_REPLAYED }   from '../../element/form-field.js';
import { implicitlySubmit } from '../../element/form-field.js';
import type { Shape }       from '../../element/index.js';

import { clamp }            from '../../utilities/index.js';
import { isRTL }            from '../../utilities/index.js';
import { reflectAttribute } from '../../utilities/index.js';

import inputStyles          from './input.css?inline';

// Input types that block implicit submission (HTML "implicit submission"), which are
// also the text-entry types jelly-input is built for
const BLOCKING_TYPES = new Set([
  'text', 'search', 'url', 'tel', 'email', 'password', 'date', 'month',
  'week', 'time', 'datetime-local', 'number',
]);

// Any other type (checkbox, range, the button types...) reads as text, as an unknown native type does
function fieldType (value: string | null): string {
  const type = (value ?? '').toLowerCase();

  return BLOCKING_TYPES.has(type) || type === 'file' ? type : 'text';
}

/**
 * A single-line text field on a soft jelly surface.
 *
 * @element jelly-input
 *
 * @attr {string} value - The default value; the `value` property holds the live value.
 * @attr {string} placeholder - Placeholder text.
 * @attr {"text"|"search"|"email"|"url"|"tel"|"password"|"number"|"date"|"month"|"week"|"time"|"datetime-local"|"file"} type - Input type (default `text`). `file` submits its selected files under `name`; any other type (checkbox, radio, range, color, hidden, and the button types included) runs the inner control as `text` and leaves the attribute as authored, as a native input treats an unknown type.
 * @attr {string} label - Accessible name for the field.
 * @attr {string} name - Form field name submitted with the value.
 * @attr {boolean} disabled - Disable the field and remove it from the tab order.
 * @attr {boolean} readonly - Make the field read-only.
 * @attr {boolean} required - The field must have a value to submit.
 * @attr {number} minlength - Minimum length of a user-entered value.
 * @attr {number} maxlength - Maximum length of a user-entered value.
 * @attr {string} pattern - Regular expression the value must match.
 * @attr {string} min - Minimum value for numeric and date types.
 * @attr {string} max - Maximum value for numeric and date types.
 * @attr {string} step - Step granularity for numeric and date types.
 * @attr {string} inputmode - Virtual keyboard hint.
 * @attr {string} enterkeyhint - Label hint for the virtual keyboard's Enter key.
 * @attr {string} autocomplete - Native autocomplete hint.
 * @attr {boolean} no-autofill - Opt out of browser and password-manager autofill.
 * @attr {"small"|"medium"|"large"} size - Control size.
 *
 * @prop {string} value - The live value; setting it marks the value dirty and fires no event.
 * @prop {string} defaultValue - Reflects the `value` attribute.
 * @prop {string} name - Reflects `name`.
 * @prop {string} type - Reflects `type`; reads the sanitized type (`text` for an unsupported one).
 * @prop {boolean} disabled - Reflects `disabled`.
 * @prop {boolean} required - Reflects `required`.
 * @prop {boolean} readOnly - Reflects `readonly`.
 * @prop {string} placeholder - Reflects `placeholder`.
 * @prop {number} minLength - Reflects `minlength` (-1 when absent).
 * @prop {number} maxLength - Reflects `maxlength` (-1 when absent).
 * @prop {string} pattern - Reflects `pattern`.
 * @prop {string} min - Reflects `min`.
 * @prop {string} max - Reflects `max`.
 * @prop {string} step - Reflects `step`.
 * @prop {string} autocomplete - Reflects `autocomplete`.
 * @prop {HTMLFormElement | null} form - The form owner (read-only).
 * @prop {NodeList} labels - The labels associated with the field (read-only).
 * @prop {ValidityState} validity - Constraint validation state (read-only).
 * @prop {string} validationMessage - The current validation message (read-only).
 * @prop {boolean} willValidate - Whether the field takes part in constraint validation (read-only).
 *
 * @fires change - When the value is committed (native change).
 * @fires input - On every keystroke (native input, bubbles composed).
 *
 * @csspart input - The native input element.
 * @csspart ring - The forced-colors focus-ring fallback.
 *
 * @cssprop [--jelly-fill] - Resting surface fill.
 * @cssprop [--jelly-accent] - Focused-border accent color.
 * @cssprop [--jelly-input-radius=16px] - Corner radius of the painted surface.
 */
export class JellyInput extends JellyFormField {

  static override CONSTRAINTS: readonly string[] = [
    'required', 'minlength', 'maxlength', 'pattern', 'min', 'max', 'step', 'inputmode', 'enterkeyhint',
  ];

  // Populated in onBuilt() / lazily
  input!: HTMLInputElement;
  measure: CanvasRenderingContext2D | null = null;

  // Tells the browser to trigger attributeChangedCallback when these attributes change
  static get observedAttributes (): string[] {
    return [...FIELD_ATTRIBUTES, ...JellyInput.CONSTRAINTS, 'type', 'name'];
  }

  static override fieldReplayed (): readonly string[] {
    return [...FIELD_REPLAYED, 'type', 'pattern', 'min', 'max', 'step'];
  }

  // Component styles layered over the shared jelly base styles
  override styles (): string {
    return inputStyles;
  }

  // The interactive markup that sits above the canvas
  override content (): string {
    return `<input part="input" /><div class="ring" part="ring" aria-hidden="true"></div>`;
  }

  // The rounded rectangle the physics body takes, inset so the wobble stays inside the host
  override shape (width: number, height: number): Shape {
    const w = width - 8;
    const h = height - 8;

    const declared = parseFloat(getComputedStyle(this).getPropertyValue('--jelly-input-radius'));
    const radius   = Number.isFinite(declared) ? Math.min(declared, h / 2) : Math.min(16, h / 2);

    return { width: w, height: h, radius };
  }

  // Called once after the shadow DOM and canvas exist. Wire events here.
  override onBuilt (): void {
    this.input = this.shadowRoot!.querySelector('input')!;

    // The type sanitizes the value, so it has to land first
    this.input.type = fieldType(this.getAttribute('type'));
    this.attachControl(this.input);

    this.input.addEventListener('keydown', this);
  }

  override handleEvent (event: Event): void {
    if (event.type === 'keydown') {
      this.handleKeydown(event as KeyboardEvent);
    } else {
      super.handleEvent(event);
    }
  }

  // Focus lifts the surface: elevated fill, a soft center pop, a visible ring
  override handleFocus (): void {
    super.handleFocus();
    this.centerPop(0.7);
  }

  // Ripple the membrane at the caret
  override handleInput (): void {
    if (!this.reducedMotion && this.body) {
      const x = this.caretLocalX();
      const h = this.body.height / 2;

      this.body.pulseAt(x, -h, 0.34);
      this.body.pulseAt(x, h, 0.34);
      this.requestFrame();
    }

    // The native <input>'s own input event is composed, so it already crosses
    // the shadow boundary and reaches host listeners - re-emitting would make
    // consumers see two 'input' events per keystroke.
  }

  // Enter submits after the keydown dispatch ends, so a host listener can still
  // preventDefault() it as it could natively
  handleKeydown (event: KeyboardEvent): void {
    if (event.key !== 'Enter' || event.isComposing || event.keyCode === 229) {
      return;
    }

    setTimeout(() => {
      const form = this.internals.form;

      if (!event.defaultPrevented && form && this.isConnected) {
        implicitlySubmit(form);
      }
    });
  }

  override blocksImplicitSubmission (): boolean {
    return BLOCKING_TYPES.has(this.type);
  }

  /*
   * The caret's x in the body's local frame (0 = shape center, +x = right).
   * Measures the text advance up to the caret in the input's own font,
   * offsets it by the inline-start padding and the direction-aware scroll,
   * then mirrors the result in RTL - where the inline start is the right
   * edge - so the ripple lands under the caret in either direction.
   */
  caretLocalX (): number {
    const input = this.input;
    let caret: number | null;

    try {
      caret = input.selectionStart;
    } catch {
      caret = null; // some input types (e.g. number/email in older engines) throw
    }

    if (caret == null) {
      caret = input.value.length;
    }

    const cs = getComputedStyle(input);

    if (!this.measure) {
      this.measure = document.createElement('canvas').getContext('2d');
    }
    const measure = this.measure!;

    measure.font = cs.font || `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;

    // Password fields render bullets, not the raw characters
    const shown = input.type === 'password'
      ? '•'.repeat(caret)
      : input.value.slice(0, caret);
    const textWidth = measure.measureText(shown).width;

    // Distance from the inline-start edge: padding plus text advance, minus
    // how far the field has scrolled away from its start. In RTL the scroll
    // origin is the inline start (right edge) and scrollLeft runs negative.
    const rtl            = isRTL(this);
    const paddingStart   = parseFloat(cs.paddingInlineStart || (rtl ? cs.paddingRight : cs.paddingLeft)) || 0;
    const scrolled       = rtl ? -input.scrollLeft : input.scrollLeft;
    const caretFromStart = paddingStart + textWidth - scrolled;

    // Convert into the physical, center-origin frame the physics use
    const localX = rtl
      ? input.clientWidth / 2 - caretFromStart
      : caretFromStart - input.clientWidth / 2;

    const half = this.body!.width / 2;

    return clamp(localX, -half + 6, half - 6);
  }

  // Push one observed attribute into the inner native input
  override sync (name: string): void {
    if (name === 'type' && this.input) {
      const wasFile = this.input.type === 'file';

      this.input.type = fieldType(this.getAttribute('type'));

      // HTML's type-change steps: leaving the file type restores the default and clears the dirty flag
      if (wasFile && this.input.type !== 'file') {
        this.dirty = false;
      }

      // A new type can sanitize the value away, so the form value follows it
      if (this.dirty) {
        this.syncFormValue();
      } else {
        this.applyValue(this.defaultValue);
      }
    }

    // Selected files enter the form as FormData entries keyed by the name
    if (name === 'name' && this.input?.type === 'file') {
      this.syncFormValue();
    }

    super.sync(name);
  }

  // A file field submits each selected File under the host's name, and nothing when unnamed
  // or empty: FormData entries join the form data set whether or not the host has a name
  override formValue (): string | FormData | null {
    const input = this.input;

    if (input.type !== 'file') {
      return input.value;
    }

    const files = Array.from(input.files ?? []);

    if (!files.length || !this.name) {
      return null;
    }

    const data = new FormData();

    for (const file of files) {
      data.append(this.name, file);
    }

    return data;
  }

  get type (): string {
    return this.input ? this.input.type : fieldType(this.getAttribute('type'));
  }

  set type (v: string) {
    reflectAttribute(this, 'type', v);
  }

  get pattern (): string {
    return this.getAttribute('pattern') ?? '';
  }

  set pattern (v: string) {
    reflectAttribute(this, 'pattern', v);
  }

  get min (): string {
    return this.getAttribute('min') ?? '';
  }

  set min (v: string) {
    reflectAttribute(this, 'min', v);
  }

  get max (): string {
    return this.getAttribute('max') ?? '';
  }

  set max (v: string) {
    reflectAttribute(this, 'max', v);
  }

  get step (): string {
    return this.getAttribute('step') ?? '';
  }

  set step (v: string) {
    reflectAttribute(this, 'step', v);
  }

}

// Register the custom element
customElements.define('jelly-input', JellyInput);

declare global {
  interface HTMLElementTagNameMap {
    'jelly-input': JellyInput;
  }
}
