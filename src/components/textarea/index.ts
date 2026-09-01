/*
 * A multi-line text field on a soft jelly surface that grows with its
 * content between a min and max height while the membrane follows along.
 * Each keystroke sends a ripple through the surface at the caret - wrap-
 * and RTL-aware, measured with a hidden layout mirror - and the field is
 * form-associated, so it submits with a `name` like any native control
 */

import { JellyElement }     from '../../element/index.js';
import type { Shape }       from '../../element/index.js';
import type { Border }      from '../../element/index.js';

import { canonicalizeSize } from '../../utilities/index.js';
import { clamp }            from '../../utilities/index.js';
import { emit }             from '../../utilities/index.js';
import { isRTL }            from '../../utilities/index.js';

import { PALETTE }          from '../../theme/index.js';

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
 * @attr {string} value - The field value.
 * @attr {string} placeholder - Placeholder text.
 * @attr {number} rows - Initial visible rows.
 * @attr {string} label - Accessible name for the field.
 * @attr {string} name - Form field name submitted with the value.
 * @attr {boolean} disabled - Disable the field and remove it from the tab order.
 * @attr {boolean} readonly - Make the field read-only.
 * @attr {string} autocomplete - Native autocomplete hint.
 * @attr {boolean} no-autofill - Opt out of browser and password-manager autofill.
 * @attr {"small"|"medium"|"large"} size - Control size.
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
export class JellyTextarea extends JellyElement implements EventListenerObject {

  // Participate in native form submission through ElementInternals
  static formAssociated = true;

  internals: ElementInternals;
  focused = false;

  // Populated in onBuilt() / lazily
  textarea!: HTMLTextAreaElement;
  textareaResizeObserver: ResizeObserver | null = null;
  mirror: HTMLDivElement | null = null;

  // Tells the browser to trigger attributeChangedCallback when these attributes change
  static get observedAttributes (): string[] {
    return ['value', 'placeholder', 'rows', 'label', 'disabled', 'readonly', 'autocomplete', 'no-autofill', 'size'];
  }

  constructor () {
    super();

    this.internals = this.attachInternals();
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

  // Resolve the surface color the canvas paints: neutral when disabled,
  // the elevated surface while focused, the resting field fill otherwise
  override fill (): string {
    if (this.hasAttribute('disabled')) {
      return this.resolveColor(`var(--jelly-color-background-neutral, ${PALETTE['background-neutral']})`);
    }

    if (this.focused) {
      return this.resolveColor(`var(--jelly-color-background-surface, ${PALETTE['background-surface']})`);
    }

    const custom = getComputedStyle(this).getPropertyValue('--jelly-fill').trim();

    return custom || this.resolveColor(`var(--jelly-color-background-muted, ${PALETTE['background-muted']})`);
  }

  // Hairline border on the jelly surface: accent while focused, neutral at rest
  override surfaceBorder (): Border {
    const color = this.focused
      ? this.resolveColor(`var(--jelly-accent, var(--jelly-color-background-accent, ${PALETTE['background-accent']}))`)
      : this.resolveColor(`var(--jelly-color-background-neutral, ${PALETTE['background-neutral']})`);

    return { color, width: 1 };
  }

  // Called once after the shadow DOM and canvas exist. Wire events here.
  override onBuilt (): void {
    this.textarea = this.shadowRoot!.querySelector('textarea')!;

    this.sync('value');
    this.sync('placeholder');
    this.sync('rows');
    this.sync('label');
    this.sync('readonly');
    this.sync('disabled');
    this.syncAutofill();

    this.useHostFocusTarget(this.textarea);
    this.autoSize();

    // Auto-sizing and CSS min/max-height changes both need the jelly to follow
    this.textareaResizeObserver = new ResizeObserver(() => this.applyShape());
    this.textareaResizeObserver.observe(this.textarea);

    this.textarea.addEventListener('focus',  this);
    this.textarea.addEventListener('blur',   this);
    this.textarea.addEventListener('input',  this);
    this.textarea.addEventListener('change', this);
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

  // Route the inner textarea's events (registered with `this` as the listener)
  handleEvent (event: Event): void {
    switch (event.type) {
      case 'focus':  this.handleFocus();   break;
      case 'blur':   this.handleBlur();    break;
      case 'input':  this.handleInput();   break;
      case 'change': emit(this, 'change'); break;
    }
  }

  // Focus lifts the surface: elevated fill, a soft center pop, a visible ring
  handleFocus (): void {
    this.focused      = true;
    this.focusVisible = true;

    this.centerPop(0.6);
    this.requestFrame();
  }

  // Blur settles the surface back to its resting fill
  handleBlur (): void {
    this.focused      = false;
    this.focusVisible = false;

    this.requestFrame();
  }

  // Mirror the value into the form, grow to fit and ripple at the caret
  handleInput (): void {
    this.internals.setFormValue(this.textarea.value);
    this.autoSize();

    if (!this.reducedMotion && this.body) {
      const { x, y } = this.caretLocalPoint();

      this.body.pulseAt(x, y, 0.5);
      this.requestFrame();
    }

    // The native <textarea>'s input event is composed and already reaches host
    // listeners; re-emitting would double-fire 'input' per keystroke.
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
   * Apply the autofill posture: no-autofill turns off autocomplete,
   * autocorrect, autocapitalize and spellcheck and sets the opt-out
   * attributes the common password managers respect
   */
  syncAutofill (): void {
    const off          = this.hasAttribute('no-autofill');
    const autocomplete = this.getAttribute('autocomplete');

    this.textarea.autocomplete = (off ? 'off' : autocomplete || '') as AutoFill;
    this.textarea.toggleAttribute('data-lpignore', off);
    this.textarea.toggleAttribute('data-1p-ignore', off);
    this.textarea.toggleAttribute('data-bwignore', off);

    if (off) {
      this.textarea.setAttribute('data-form-type', 'other');
      this.textarea.setAttribute('autocorrect', 'off');
      this.textarea.setAttribute('autocapitalize', 'none');
      this.textarea.spellcheck = false;
    } else {
      this.textarea.removeAttribute('data-form-type');
      this.textarea.removeAttribute('autocorrect');
      this.textarea.removeAttribute('autocapitalize');
      this.textarea.removeAttribute('spellcheck');
    }
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

  // Lifecycle method: Fires when observed HTML attributes change dynamically
  attributeChangedCallback (name: string): void {
    if (this.textarea) {
      this.sync(name);
    }
  }

  // Push one observed attribute into the inner native textarea
  sync (name: string): void {
    switch (name) {
      case 'value':
        this.textarea.value = this.getAttribute('value') ?? '';
        this.internals.setFormValue(this.textarea.value);
        this.autoSize();
        break;

      case 'placeholder':
        this.textarea.placeholder = this.getAttribute('placeholder') ?? '';
        break;

      case 'rows': {
        const rows = this.getAttribute('rows');

        if (rows == null) {
          this.textarea.removeAttribute('rows');
        } else {
          this.textarea.rows = Number(rows) || 2;
        }

        this.autoSize();
        break;
      }

      case 'label': {
        const label = this.getAttribute('label');

        if (label) {
          this.textarea.setAttribute('aria-label', label);
        } else {
          this.textarea.removeAttribute('aria-label');
        }
        break;
      }

      case 'disabled':
        this.textarea.disabled = this.hasAttribute('disabled');
        this.syncHostFocusTarget();
        this.requestFrame();
        break;

      case 'readonly':
        this.textarea.readOnly = this.hasAttribute('readonly');
        break;

      case 'autocomplete':
      case 'no-autofill':
        this.syncAutofill();
        break;

      case 'size':
        canonicalizeSize(this);
        break;
    }
  }

  // The current text value (read live from the inner control once built)
  get value (): string {
    return this.textarea ? this.textarea.value : this.getAttribute('value') || '';
  }

  // Set the text value, mirror it into the form and re-fit the height
  set value (v: string) {
    if (this.textarea) {
      this.textarea.value = v;
      this.internals.setFormValue(v);
      this.autoSize();
    }
  }

  // Route programmatic host focus into the inner native textarea
  override focus (options?: FocusOptions): void {
    this.textarea?.focus(options);
  }

}

// Register the custom element
customElements.define('jelly-textarea', JellyTextarea);

declare global {
  interface HTMLElementTagNameMap {
    'jelly-textarea': JellyTextarea;
  }
}
