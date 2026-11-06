import { DropletFormField }   from '../../element/form-field.js';
import { FIELD_ATTRIBUTES } from '../../element/form-field.js';
import { FIELD_REPLAYED }   from '../../element/form-field.js';
import { implicitlySubmit } from '../../element/form-field.js';
import type { Shape }       from '../../element/index.js';

import { clamp }            from '../../utilities/index.js';
import { isRTL }            from '../../utilities/index.js';
import { reflectAttribute } from '../../utilities/index.js';
import { defineStrict, TAGS } from '../../registry/index.js';
import type { DefineOptions, DefineResult } from '../../registry/index.js';
import { readToken } from '../../theme/token-read.js';

import inputStyles          from './input.css?inline';

// The types that block HTML implicit submission, which are also the supported text types
const BLOCKING_TYPES = new Set([
  'text', 'search', 'url', 'tel', 'email', 'password', 'date', 'month',
  'week', 'time', 'datetime-local', 'number',
]);

// Anything else runs as text, like an unknown native type
function fieldType (value: string | null): string {
  const type = (value ?? '').toLowerCase();

  return BLOCKING_TYPES.has(type) || type === 'file' ? type : 'text';
}

/**
 * A single-line text field on a soft-body surface.
 *
 * @element droplet-input
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
 * @cssprop [--droplet-fill] - Resting surface fill.
 * @cssprop [--droplet-accent] - Focused-border accent color.
 * @cssprop [--droplet-input-radius=16px] - Corner radius of the painted surface.
 */
export class DropletInput extends DropletFormField {

  static define (options?: DefineOptions): DefineResult {
    return defineInput(options);
  }

  static override CONSTRAINTS: readonly string[] = [
    'required', 'minlength', 'maxlength', 'pattern', 'min', 'max', 'step', 'inputmode', 'enterkeyhint',
  ];

  input!: HTMLInputElement;
  measure: CanvasRenderingContext2D | null = null;

  static get observedAttributes (): string[] {
    return [...FIELD_ATTRIBUTES, ...DropletInput.CONSTRAINTS, 'type', 'name'];
  }

  static override fieldReplayed (): readonly string[] {
    return [...FIELD_REPLAYED, 'type', 'pattern', 'min', 'max', 'step'];
  }

  override styles (): string {
    return inputStyles;
  }

  override content (): string {
    return `<input part="input" /><div class="ring" part="ring" aria-hidden="true"></div>`;
  }

  override shape (width: number, height: number): Shape {
    const w = width - 8;
    const h = height - 8;

    const declared = parseFloat(readToken(getComputedStyle(this), 'input-radius'));
    const radius   = Number.isFinite(declared) ? Math.min(declared, h / 2) : Math.min(16, h / 2);

    return { width: w, height: h, radius };
  }

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

  override handleFocus (): void {
    super.handleFocus();
    this.centerPop(0.7);
  }

  override handleInput (): void {
    if (!this.reducedMotion && this.body) {
      const x = this.caretLocalX();
      const h = this.body.height / 2;

      this.body.pulseAt(x, -h, 0.34);
      this.body.pulseAt(x, h, 0.34);
      this.requestFrame();
    }

    // No re-emit: the native composed input event already reaches consumers
  }

  // Submits after dispatch, so a host listener can still preventDefault() it
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

  // Body-local x (0 is the center, +x is right) in LTR and RTL alike
  caretLocalX (): number {
    const input = this.input;
    let caret: number | null;

    try {
      caret = input.selectionStart;
    } catch {
      caret = null; // number and email throw in older engines
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

    const shown = input.type === 'password'
      ? '•'.repeat(caret)
      : input.value.slice(0, caret);
    const textWidth = measure.measureText(shown).width;

    // In RTL, scrollLeft runs negative from the right edge
    const rtl            = isRTL(this);
    const paddingStart   = parseFloat(cs.paddingInlineStart || (rtl ? cs.paddingRight : cs.paddingLeft)) || 0;
    const scrolled       = rtl ? -input.scrollLeft : input.scrollLeft;
    const caretFromStart = paddingStart + textWidth - scrolled;

    const localX = rtl
      ? input.clientWidth / 2 - caretFromStart
      : caretFromStart - input.clientWidth / 2;

    const half = this.body!.width / 2;

    return clamp(localX, -half + 6, half - 6);
  }

  override sync (name: string): void {
    if (name === 'type' && this.input) {
      const wasFile = this.input.type === 'file';

      this.input.type = fieldType(this.getAttribute('type'));

      // HTML type-change steps: leaving file clears the dirty flag
      if (wasFile && this.input.type !== 'file') {
        this.dirty = false;
      }

      if (this.dirty) {
        this.syncFormValue();
      } else {
        this.applyValue(this.defaultValue);
      }
    }

    // File entries are keyed by the name
    if (name === 'name' && this.input?.type === 'file') {
      this.syncFormValue();
    }

    super.sync(name);
  }

  // FormData entries submit even from an unnamed host, hence the name check
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

export function defineInput (options: DefineOptions = {}): DefineResult {
  return defineStrict([[TAGS.input, DropletInput]], options);
}

declare global {
  interface HTMLElementTagNameMap {
    'droplet-input': DropletInput;
  }
}
