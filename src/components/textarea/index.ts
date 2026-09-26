/*
 * A multi-line text field on a soft jelly surface that grows with its
 * content between a min and max height while the membrane follows along.
 * Each keystroke sends a ripple through the surface at the caret - wrap-
 * and RTL-aware, measured with a hidden layout mirror - and the field is
 * form-associated like a native control: it submits under `name`,
 * validates, and resets with its form
 */

import { JellyFormField }   from '../../element/form-field.js';
import { FIELD_ATTRIBUTES } from '../../element/form-field.js';
import type { Shape }       from '../../element/index.js';

import { clamp }            from '../../utilities/index.js';
import { isRTL }            from '../../utilities/index.js';

import textareaStyles       from './textarea.css?inline';

// Layout-shaping styles the caret mirror copies from the real textarea
const MIRRORED_STYLES = [
  'direction', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'fontVariant',
  'letterSpacing', 'textTransform', 'wordSpacing', 'lineHeight',
  'textIndent', 'tabSize', 'textAlign', 'wordBreak',
];

/**
 * A multi-line text field that auto-grows with its content.
 *
 * @element jelly-textarea
 *
 * @attr {string} value - The default value; the `value` property holds the live value.
 * @attr {string} placeholder - Placeholder text.
 * @attr {number} rows - Initial visible rows.
 * @attr {string} label - Accessible name for the field.
 * @attr {string} name - Form field name submitted with the value.
 * @attr {boolean} disabled - Disable the field and remove it from the tab order.
 * @attr {boolean} readonly - Make the field read-only.
 * @attr {boolean} required - The field must have a value to submit.
 * @attr {number} minlength - Minimum length of a user-entered value.
 * @attr {number} maxlength - Maximum length of a user-entered value.
 * @attr {string} inputmode - Virtual keyboard hint.
 * @attr {string} enterkeyhint - Label hint for the virtual keyboard's Enter key.
 * @attr {string} autocomplete - Native autocomplete hint.
 * @attr {boolean} no-autofill - Opt out of browser and password-manager autofill.
 * @attr {"small"|"medium"|"large"} size - Control size.
 *
 * @prop {string} value - The live value; setting it marks the value dirty and fires no event.
 * @prop {string} defaultValue - Reflects the `value` attribute.
 * @prop {string} name - Reflects `name`.
 * @prop {boolean} disabled - Reflects `disabled`.
 * @prop {boolean} required - Reflects `required`.
 * @prop {boolean} readOnly - Reflects `readonly`.
 * @prop {string} placeholder - Reflects `placeholder`.
 * @prop {number} minLength - Reflects `minlength` (-1 when absent).
 * @prop {number} maxLength - Reflects `maxlength` (-1 when absent).
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
 * @csspart textarea - The native textarea element.
 * @csspart ring - The forced-colors focus-ring fallback.
 *
 * @cssprop [--jelly-textarea-max-height=240px] - Cap for the auto-grow height.
 * @cssprop [--jelly-fill] - Resting surface fill.
 */
export class JellyTextarea extends JellyFormField {

  // Populated in onBuilt() / lazily
  textarea!: HTMLTextAreaElement;
  textareaResizeObserver: ResizeObserver | null = null;
  mirror: HTMLDivElement | null = null;

  // Tells the browser to trigger attributeChangedCallback when these attributes change
  static get observedAttributes (): string[] {
    return [...FIELD_ATTRIBUTES, ...JellyTextarea.CONSTRAINTS, 'rows'];
  }

  // Component styles layered over the shared jelly base styles
  override styles (): string {
    return textareaStyles;
  }

  // The interactive markup that sits above the canvas
  override content (): string {
    return `<textarea part="textarea"></textarea><div class="ring" part="ring" aria-hidden="true"></div>`;
  }

  // The rounded rectangle the physics body takes, inset so the wobble stays inside the host
  override shape (width: number, height: number): Shape {
    const w = width - 8;
    const h = height - 8;

    const declared = parseFloat(getComputedStyle(this).getPropertyValue('--jelly-textarea-radius'));
    const radius   = Number.isFinite(declared) ? Math.min(declared, h / 2) : Math.min(20, h / 2);

    return { width: w, height: h, radius };
  }

  // Called once after the shadow DOM and canvas exist. Wire events here.
  override onBuilt (): void {
    this.textarea = this.shadowRoot!.querySelector('textarea')!;

    this.attachControl(this.textarea);
    this.sync('rows');

    // Auto-sizing and CSS min/max-height changes both need the jelly to follow
    this.textareaResizeObserver = new ResizeObserver(() => this.applyShape());
    this.textareaResizeObserver.observe(this.textarea);
  }

  // Lifecycle method: Called automatically when the element is appended to the DOM
  override connectedCallback (): void {
    super.connectedCallback();

    // Re-attach the auto-size observer when the element re-enters the DOM
    if (this.textarea && !this.textareaResizeObserver) {
      this.textareaResizeObserver = new ResizeObserver(() => this.applyShape());
      this.textareaResizeObserver.observe(this.textarea);
    }
  }

  // Lifecycle method: Called automatically when the element leaves the DOM
  override disconnectedCallback (): void {
    super.disconnectedCallback();

    if (this.textareaResizeObserver) {
      this.textareaResizeObserver.disconnect();
      this.textareaResizeObserver = null;
    }
  }

  // Focus lifts the surface: elevated fill, a soft center pop, a visible ring
  override handleFocus (): void {
    super.handleFocus();
    this.centerPop(0.6);
  }

  // Grow to fit and ripple at the caret
  override handleInput (): void {
    this.autoSize();

    if (!this.reducedMotion && this.body) {
      const { x, y } = this.caretLocalPoint();

      this.body.pulseAt(x, y, 0.5);
      this.requestFrame();
    }

    // The native <textarea>'s input event is composed and already reaches host
    // listeners; re-emitting would double-fire 'input' per keystroke.
  }

  // Every programmatic value change re-fits the height
  override onValueApplied (): void {
    this.autoSize();
  }

  // Grow the control to fit its content (the CSS max-height caps it)
  autoSize (): void {
    if (!this.textarea) {
      return;
    }

    this.textarea.style.height = 'auto';
    this.textarea.style.height = `${this.textarea.scrollHeight}px`;

    this.applyShape();
  }

  /*
   * The caret's {x, y} in the body's local frame (0,0 = shape center). A
   * hidden "mirror" div replicates the textarea's layout - font, width,
   * padding, wrap and direction - so a marker span at the caret reports
   * its real physical position, wrapping and RTL layout included.
   */
  caretLocalPoint (): { x: number; y: number } {
    const ta = this.textarea;
    let caret: number | null;

    try {
      caret = ta.selectionStart;
    } catch {
      caret = null;
    }

    if (caret == null) {
      caret = ta.value.length;
    }

    const cs  = getComputedStyle(ta);
    const div = this.mirror || (this.mirror = document.createElement('div'));
    const s   = div.style;

    s.position     = 'absolute';
    s.top          = '0';
    s.left         = '-9999px';
    s.visibility   = 'hidden';
    s.whiteSpace   = 'pre-wrap';
    s.overflowWrap = 'break-word';
    s.boxSizing    = 'content-box';

    const padL = parseFloat(cs.paddingLeft) || 0;
    const padR = parseFloat(cs.paddingRight) || 0;

    s.width = `${ta.clientWidth - padL - padR}px`;

    const source = cs as unknown as Record<string, string>;
    const dest   = s as unknown as Record<string, string>;

    for (const property of MIRRORED_STYLES) {
      dest[property] = source[property] ?? '';
    }

    div.textContent = ta.value.slice(0, caret);

    const marker = document.createElement('span');

    marker.textContent = ta.value.slice(caret) || '.';
    div.appendChild(marker);

    // The mirror lays out in physical coordinates (direction included), so
    // the marker's offsets map straight onto the canvas frame. Horizontal
    // scroll is direction-aware: in RTL the scroll origin is the inline
    // start (right edge) and scrollLeft runs from 0 down to negative.
    this.shadowRoot!.appendChild(div);

    const maxScrollX = ta.scrollWidth - ta.clientWidth;
    const scrollX    = isRTL(this) ? ta.scrollLeft + maxScrollX : ta.scrollLeft;
    const caretX     = marker.offsetLeft - scrollX;
    const caretY     = marker.offsetTop - ta.scrollTop;

    this.shadowRoot!.removeChild(div);
    div.removeChild(marker);

    const localX = caretX - ta.offsetWidth / 2;
    const localY = caretY - ta.offsetHeight / 2;
    const halfW  = this.body!.width / 2 - 6;
    const halfH  = this.body!.height / 2 - 6;

    return {
      x: clamp(localX, -halfW, halfW),
      y: clamp(localY, -halfH, halfH),
    };
  }

  // Push one observed attribute into the inner native textarea
  override sync (name: string): void {
    if (name === 'rows' && this.textarea) {
      const rows = this.getAttribute('rows');

      if (rows == null) {
        this.textarea.removeAttribute('rows');
      } else {
        this.textarea.rows = Number(rows) || 2;
      }

      this.autoSize();
    }

    super.sync(name);
  }

}

// Register the custom element
customElements.define('jelly-textarea', JellyTextarea);

declare global {
  interface HTMLElementTagNameMap {
    'jelly-textarea': JellyTextarea;
  }
}
