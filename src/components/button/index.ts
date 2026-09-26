/*
 * A capsule-shaped jelly button. A real <button> lives in the shadow DOM
 * for keyboard and assistive-technology support while the soft body is
 * painted on the canvas behind it; click events bubble out composed, so
 * consumers use it like any native button. The host is form-associated:
 * a disabled <fieldset> disables it, form="id" picks its owner, and
 * type="submit" / "reset" drive that owner form. shape="square" swaps the
 * full pill for a smaller, rounded-rectangle radius (same 0.32-of-height
 * ratio as jelly-icon-button's default square).
 */

import { JellyElement }   from '../../element/index.js';
import type { Shape }      from '../../element/index.js';

import { canonicalizeQualityAttribute } from '../../element/configure.js';
import { SUBMIT_BUTTON }                from '../../element/submitter.js';

import { defineElements }      from '../../registry/index.js';
import { TAGS }                from '../../registry/index.js';
import type { DefineOptions }  from '../../registry/index.js';
import type { DefineResult }   from '../../registry/index.js';

import { AriaLink }            from '../../utilities/index.js';
import { FORWARDED_ARIA }      from '../../utilities/index.js';
import { forwardAria }         from '../../utilities/index.js';
import { forwardAllAria }      from '../../utilities/index.js';
import { reflectAttribute }    from '../../utilities/index.js';

import buttonStyles        from './button.css?inline';
import variantStyles       from '../../styles/variants.css?inline';

export type ButtonType = 'button' | 'submit' | 'reset';

// Copied onto the native stand-in submitter; the form* getters parse through it too
const SUBMITTER_ATTRIBUTES = ['name', 'value', 'formaction', 'formenctype', 'formmethod', 'formnovalidate', 'formtarget'];

/**
 * A capsule-shaped jelly button with soft-body physics.
 *
 * @element jelly-button
 *
 * @slot - The button's label content (text, icons).
 *
 * @attr {boolean} disabled - Disables the button and removes it from the tab order; a disabled ancestor fieldset does the same.
 * @attr {string} label - Accessible name used when the button has no text label; wins over `aria-label`.
 * @attr {"button"|"submit"|"reset"} type - Native button behavior (default `button`); submit / reset drive the owner form.
 * @attr {string} form - Id of the owner form, when the button sits outside it.
 * @attr {string} name - Submitted as `name=value` when this button submits the form.
 * @attr {string} value - Submitted as `name=value` when this button submits the form.
 * @attr {string} formaction - Overrides the form's `action` for a submission from this button.
 * @attr {"get"|"post"|"dialog"} formmethod - Overrides the form's `method` for a submission from this button.
 * @attr {string} formenctype - Overrides the form's `enctype` for a submission from this button.
 * @attr {string} formtarget - Overrides the form's `target` for a submission from this button.
 * @attr {boolean} formnovalidate - Skips constraint validation for a submission from this button.
 * @attr {"pill"|"square"} shape - Full pill (default) or rounded-square silhouette.
 * @attr {boolean} block - Stretch the button to the full width of its container.
 * @attr {"small"|"medium"|"large"} size - Control size (sm / md / lg aliases accepted).
 * @attr {"white"|"rose"|"amber"|"azure"|"mint"|"platinum"|"graphite"} variant - Fill / label color pair.
 * @attr {string} feel - Registered feel preset driving the physics; inherits from a `data-droplet-feel` scope.
 * @attr {"low"|"medium"|"high"} quality - Caps physics cost (med/lo/hi aliases accepted); inherits from a `data-droplet-quality` scope.
 *
 * @prop {boolean} disabled - Reflects the `disabled` attribute.
 * @prop {string} name - Reflects the `name` attribute.
 * @prop {string} value - Reflects the `value` attribute.
 * @prop {"button"|"submit"|"reset"} type - Reflects `type`; a missing or unknown value reads as `button`.
 * @prop {string} formAction - Reflects `formaction` as a resolved URL (the document URL when unset).
 * @prop {string} formMethod - Reflects `formmethod`, limited to `get`, `post`, and `dialog`.
 * @prop {string} formEnctype - Reflects `formenctype`, limited to the three submittable encodings.
 * @prop {string} formTarget - Reflects `formtarget`.
 * @prop {boolean} formNoValidate - Reflects `formnovalidate`.
 * @prop {HTMLFormElement | null} form - The owner form (read-only).
 * @prop {NodeList} labels - The `<label>` elements associated with the button (read-only).
 *
 * @fires click - When the button is activated (native event, bubbles composed).
 *
 * @csspart button - The inner native <button>.
 * @csspart jelly - The canvas the soft body is painted on.
 *
 * @cssprop [--jelly-button-height=62px] - Control height.
 * @cssprop [--jelly-button-radius=999px] - Corner radius of the painted surface.
 * @cssprop [--jelly-fill] - Surface fill color (usually set by `variant`).
 * @cssprop [--jelly-label] - Label color.
 */
export class JellyButton extends JellyElement {

  // Opt in to the base class's feel / quality / resolver half
  static override usesResolver = true;

  // :disabled, fieldset disabling, and form="id" ownership all come from the platform
  static formAssociated = true;

  static override REPLAYED: readonly string[] = [
    ...JellyElement.REPLAYED,
    'disabled', 'name', 'value', 'type',
    'formAction', 'formMethod', 'formEnctype', 'formTarget', 'formNoValidate',
  ];

  // Populated in onBuilt()
  button!: HTMLButtonElement;
  activationPointerId: number | null = null;
  cancelPointerClick = false;

  internals: ElementInternals;

  statePointerId: number | null = null;

  // Clicks already waiting to run activation behavior, so no click drives the form twice
  activations = new WeakSet<Event>();

  ariaLink = new AriaLink(this, () => this.forwardHostAria());

  constructor () {
    super();

    // Once, in the constructor: attachInternals() throws on a second call
    this.internals = this.attachInternals();
  }

  static define (options?: DefineOptions): DefineResult {
    return defineButton(options);
  }

  // Tells the browser to trigger attributeChangedCallback when these attributes change
  static get observedAttributes (): string[] {
    return [
      'disabled', 'label', 'type', 'shape', 'feel', 'quality',
      // Forwarded to the inner button, because the roleless host is not what AT reads
      ...FORWARDED_ARIA,
    ];
  }

  // Native IDL surface

  get disabled (): boolean {
    return this.hasAttribute('disabled');
  }

  set disabled (value: boolean) {
    this.toggleAttribute('disabled', Boolean(value));
  }

  get name (): string {
    return this.getAttribute('name') ?? '';
  }

  set name (value: string) {
    reflectAttribute(this, 'name', value);
  }

  get value (): string {
    return this.getAttribute('value') ?? '';
  }

  set value (value: string) {
    reflectAttribute(this, 'value', value);
  }

  // Native parity except the default: a bare jelly-button stays type="button"
  get type (): ButtonType {
    const type = this.getAttribute('type')?.toLowerCase();

    return type === 'submit' || type === 'reset' ? type : 'button';
  }

  set type (value: string) {
    reflectAttribute(this, 'type', value);
  }

  get formAction (): string {
    return this.nativeSubmitter().formAction;
  }

  set formAction (value: string) {
    reflectAttribute(this, 'formaction', value);
  }

  get formMethod (): string {
    return this.nativeSubmitter().formMethod;
  }

  set formMethod (value: string) {
    reflectAttribute(this, 'formmethod', value);
  }

  get formEnctype (): string {
    return this.nativeSubmitter().formEnctype;
  }

  set formEnctype (value: string) {
    reflectAttribute(this, 'formenctype', value);
  }

  get formTarget (): string {
    return this.getAttribute('formtarget') ?? '';
  }

  set formTarget (value: string) {
    reflectAttribute(this, 'formtarget', value);
  }

  get formNoValidate (): boolean {
    return this.hasAttribute('formnovalidate');
  }

  set formNoValidate (value: boolean) {
    this.toggleAttribute('formnovalidate', Boolean(value));
  }

  get form (): HTMLFormElement | null {
    return this.internals.form;
  }

  get labels (): NodeList {
    return this.internals.labels;
  }

  get [SUBMIT_BUTTON] (): boolean {
    return this.type === 'submit';
  }

  // The disabled attribute or a disabled ancestor fieldset; the attribute check
  // keeps an engine without form-associated elements honest
  get effectivelyDisabled (): boolean {
    return this.hasAttribute('disabled') || this.matches(':disabled');
  }

  // Lifecycle

  override connectedCallback (): void {
    super.connectedCallback();

    // A move can change the tree scope IDREFs resolve in
    this.ariaLink.connect();
  }

  override disconnectedCallback (): void {
    super.disconnectedCallback();

    this.ariaLink.disconnect();
    this.clearPressed();
  }

  // Native HTMLButtonElement.click(): nothing while disabled, otherwise the inner
  // button activates, so one composed click still drives the form
  override click (): void {
    if (this.effectivelyDisabled) {
      return;
    }

    if (this.button) {
      this.button.click();
    } else {
      super.click();
    }
  }

  // Fieldset disabling reaches the inner control without touching the host attribute
  formDisabledCallback (): void {
    if (this.button) {
      this.sync('disabled');
    }
  }

  // Component styles layered over the shared jelly base styles
  override styles (): string {
    return variantStyles + buttonStyles;
  }

  // The interactive markup that sits above the canvas
  override content (): string {
    return `<button part="button"><slot></slot></button>`;
  }

  // The capsule (or, with shape="square", rounded-rectangle) the physics body
  // takes, inset so the wobble stays inside the host
  override shape (width: number, height: number): Shape {
    const w      = width - 8;
    const h      = height - 8;
    const square = this.getAttribute('shape') === 'square';

    // Honor a plain-px --jelly-button-radius override on the painted surface;
    // the pill (999px) and square (calc) defaults fall through to the ratios
    const declared = parseFloat(getComputedStyle(this).getPropertyValue('--jelly-button-radius'));
    const radius   = Number.isFinite(declared) ? Math.min(declared, h / 2) : (square ? h * 0.32 : h / 2);

    return { width: w, height: h, radius };
  }

  // Called once after the shadow DOM and canvas exist. Wire events here.
  override onBuilt (): void {
    this.button = this.shadowRoot!.querySelector('button')!;

    this.sync('type');
    this.sync('disabled');
    this.forwardHostAria();

    this.useHostFocusTarget(this.button);
    this.trackFocus(this.button);
    this.preventReleaseOutsideActivation();
    this.trackPressedState();
    this.wirePress(this.button, { disabled: () => this.effectivelyDisabled });

    this.button.addEventListener('click', (event) => this.activate(event));

    // A <label for> activates the labelable host itself, and that click never reaches the inner button
    this.addEventListener('click', (event) => {
      if (event.composedPath()[0] === this) {
        this.activate(event);
      }
    });
  }

  // Native activation behavior runs after dispatch and honors a canceled click. The window is a bubbling
  // click's last stop; the macrotask covers stopPropagation() (which never cancels it) and windowless hosts.
  activate (event: Event): void {
    if (this.activations.has(event)) {
      return;
    }

    this.activations.add(event);

    const view = this.ownerDocument.defaultView;
    let done   = false;
    let timer  = 0;

    const finish = (reached?: Event): void => {
      // A nested click dispatched from a listener reaches the window first
      if (done || (reached && reached !== event)) {
        return;
      }

      done = true;
      view?.removeEventListener('click', finish);
      clearTimeout(timer);

      if (!event.defaultPrevented) {
        this.driveForm();
      }
    };

    view?.addEventListener('click', finish);
    timer = window.setTimeout(() => finish());
  }

  // Every forwarded aria-* the host carries, then the name so label keeps precedence
  forwardHostAria (): void {
    if (!this.button) {
      return;
    }

    forwardAllAria(this, this.button);
    this.sync('label');
  }

  // Pointer capture keeps a drag routed to the button after the pointer leaves
  // it. Only let the resulting native click through when it is released back
  // inside the button; keyboard activation stays unchanged.
  preventReleaseOutsideActivation (): void {
    this.button.addEventListener('pointerdown', (event) => {
      this.activationPointerId = event.pointerId;
      this.cancelPointerClick = false;
    });

    this.button.addEventListener('pointerup', (event) => {
      if (event.pointerId !== this.activationPointerId) {
        return;
      }

      const rect = this.button.getBoundingClientRect();

      this.cancelPointerClick =
        event.clientX < rect.left || event.clientX > rect.right
        || event.clientY < rect.top || event.clientY > rect.bottom;
      this.activationPointerId = null;
    });

    this.button.addEventListener('pointercancel', () => {
      this.activationPointerId = null;
      this.cancelPointerClick = false;
    });

    const cancelOutsideRelease = (event: Event): void => {
      if (!this.cancelPointerClick) {
        return;
      }

      this.cancelPointerClick = false;
      event.preventDefault();
      event.stopImmediatePropagation();
    };

    this.button.addEventListener('click', cancelOutsideRelease);
    this.addEventListener('click', cancelOutsideRelease, { capture: true });
  }

  // Tracked on the host because pointer capture retargets the rest of the press
  // lifecycle to whatever element captured it (state-and-reflection.md)
  trackPressedState (): void {
    this.addEventListener('pointerdown', (event) => {
      if (this.statePointerId !== null || this.effectivelyDisabled) {
        return;
      }

      this.statePointerId = event.pointerId;
      this.internals.states.add('pressed');
    });

    const clear = (event: PointerEvent): void => {
      if (event.pointerId === this.statePointerId) {
        this.clearPressed();
      }
    };

    this.addEventListener('pointerup', clear);
    this.addEventListener('pointercancel', clear);
    this.addEventListener('lostpointercapture', clear);
  }

  clearPressed (): void {
    this.statePointerId = null;
    this.internals.states.delete('pressed');
  }

  // Lifecycle method: Fires when observed HTML attributes change dynamically
  attributeChangedCallback (name: string): void {
    if (name === 'feel' || name === 'quality') {
      if (name === 'quality') {
        canonicalizeQualityAttribute(this);
      }

      this.resolve();
      return;
    }

    if (this.button) {
      this.sync(name);
    }
  }

  // Push one observed attribute into the inner native button
  sync (name: string): void {
    if (name.startsWith('aria-') && name !== 'aria-label') {
      forwardAria(this, this.button, name);
      return;
    }

    switch (name) {
      case 'disabled':
        this.button.disabled = this.effectivelyDisabled;
        this.syncHostFocusTarget();
        break;

      case 'type':
        this.button.type = this.type;
        break;

      case 'label':
      case 'aria-label': {
        const label = this.getAttribute('label');

        if (label) {
          reflectAttribute(this.button, 'aria-label', label);
        } else {
          forwardAria(this, this.button, 'aria-label');
        }
        break;
      }

      case 'shape':
        this.reshapeMembrane();
        break;
    }
  }

  // The base class only sees the attribute; a disabled fieldset must leave the tab order too
  override syncHostFocusTarget (): void {
    super.syncHostFocusTarget();

    if (this.hostFocusTarget && this.effectivelyDisabled) {
      this.hostFocusTarget.tabIndex = -1;
    }
  }

  // A detached native button carrying the host's submission attributes, so the
  // form* getters and the submitter share the platform's own parsing
  nativeSubmitter (): HTMLButtonElement {
    const submitter = this.ownerDocument.createElement('button');

    submitter.type   = 'submit';
    submitter.hidden = true;

    for (const name of SUBMITTER_ATTRIBUTES) {
      const value = this.getAttribute(name);

      if (value !== null) {
        submitter.setAttribute(name, value);
      }
    }

    return submitter;
  }

  // Submit or reset the owner form as the host stands now. A form-associated custom element
  // cannot be a submitter, so a native stand-in joins the form for the one synchronous call.
  driveForm (): void {
    const type = this.type;
    const form = this.internals.form;

    if (type === 'button' || !form || this.effectivelyDisabled) {
      return;
    }

    if (type === 'reset') {
      form.reset();
      return;
    }

    const submitter = this.nativeSubmitter();

    form.append(submitter);

    try {
      form.requestSubmit(submitter);
    } finally {
      submitter.remove();
    }
  }

  // Route programmatic host focus into the inner native button
  override focus (options?: FocusOptions): void {
    this.button?.focus(options);
  }

}

// Explicit helper, so strict is the default: a foreign jelly-button throws
// rather than being warned past (registration.md)
export function defineButton (options: DefineOptions = {}): DefineResult {
  return defineElements([[TAGS.button, JellyButton]], { ...options, strict: options.strict ?? true });
}

declare global {
  interface HTMLElementTagNameMap {
    'jelly-button': JellyButton;
  }
}
