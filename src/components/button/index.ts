import { DropletElement }   from '../../element/index.js';
import type { Shape }      from '../../element/index.js';

import { SUBMIT_BUTTON }                from '../../element/submitter.js';

import { defineStrict }        from '../../registry/index.js';
import { TAGS }                from '../../registry/index.js';
import type { DefineOptions }  from '../../registry/index.js';
import type { DefineResult }   from '../../registry/index.js';

import { AriaLink }            from '../../utilities/index.js';
import { FORWARDED_ARIA }      from '../../utilities/index.js';
import { forwardAria }         from '../../utilities/index.js';
import { forwardAllAria }      from '../../utilities/index.js';
import { reflectAttribute }    from '../../utilities/index.js';
import { readToken } from '../../theme/token-read.js';

import buttonStyles        from './button.css?inline';
import variantStyles       from '../../styles/variants.css?inline';

export type ButtonType = 'button' | 'submit' | 'reset';

const SUBMITTER_ATTRIBUTES = ['name', 'value', 'formaction', 'formenctype', 'formmethod', 'formnovalidate', 'formtarget'];

/**
 * A capsule-shaped soft-body button.
 *
 * @element droplet-button
 *
 * @slot - The button's label content (text, icons).
 *
 * @attr {boolean} disabled - Disables the button and removes it from the tab order; a disabled ancestor fieldset does the same.
 * @attr {string} label - Accessible name used when the button has no text label; wins over `aria-label`.
 * @attr {"button"|"submit"|"reset"} type - Native button behavior (default `button`); submit/reset drive the owner form.
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
 * @attr {"small"|"medium"|"large"} size - Control size (sm/md/lg aliases accepted).
 * @attr {"white"|"rose"|"amber"|"azure"|"mint"|"platinum"|"graphite"} variant - Fill/label color pair.
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
 * @csspart droplet - The canvas the soft body is painted on.
 * @csspart jelly - The same canvas under its Jelly UI part name.
 *
 * @cssprop [--droplet-button-height=62px] - Control height.
 * @cssprop [--droplet-button-radius=999px] - Corner radius of the painted surface.
 * @cssprop [--droplet-fill] - Surface fill color (usually set by `variant`).
 * @cssprop [--droplet-label] - Label color.
 */
export class DropletButton extends DropletElement {

  static override usesResolver = true;

  static formAssociated = true;

  static override REPLAYED: readonly string[] = [
    ...DropletElement.REPLAYED,
    'disabled', 'name', 'value', 'type',
    'formAction', 'formMethod', 'formEnctype', 'formTarget', 'formNoValidate',
  ];

  button!: HTMLButtonElement;
  activationPointerId: number | null = null;
  cancelPointerClick = false;

  internals: ElementInternals;

  statePointerId: number | null = null;

  // Clicks with activation pending, so none drives the form twice
  activations = new WeakSet<Event>();

  ariaLink = new AriaLink(this, () => this.forwardHostAria());

  constructor () {
    super();

    // attachInternals() throws on a second call
    this.internals = this.attachInternals();
  }

  static define (options?: DefineOptions): DefineResult {
    return defineButton(options);
  }

  static get observedAttributes (): string[] {
    return [
      'disabled', 'label', 'type', 'shape', ...DropletElement.AXIS_ATTRIBUTES,
      ...FORWARDED_ARIA,
    ];
  }

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

  // Defaults to button, not native's submit
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

  // The attribute check covers engines without form-associated elements
  get effectivelyDisabled (): boolean {
    return this.hasAttribute('disabled') || this.matches(':disabled');
  }

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

  // Through the inner button, so one composed click drives the form
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

  formDisabledCallback (): void {
    if (this.button) {
      this.sync('disabled');
    }
  }

  override styles (): string {
    return variantStyles + buttonStyles;
  }

  override content (): string {
    return `<button part="button"><slot></slot></button>`;
  }

  // Inset so the wobble stays inside the host
  override shape (width: number, height: number): Shape {
    const w      = width - 8;
    const h      = height - 8;
    const square = this.getAttribute('shape') === 'square';

    // A px radius token wins; the square's calc() default falls through to the ratio
    const declared = parseFloat(readToken(getComputedStyle(this), 'button-radius'));
    const radius   = Number.isFinite(declared) ? Math.min(declared, h / 2) : (square ? h * 0.32 : h / 2);

    return { width: w, height: h, radius };
  }

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

    // A <label for> click lands on the host and never reaches the inner button
    this.addEventListener('click', (event) => {
      if (event.composedPath()[0] === this) {
        this.activate(event);
      }
    });
  }

  // Runs after dispatch so a canceled click stays canceled: the window is a bubbling click's
  // last stop, and the macrotask covers stopPropagation() and windowless hosts
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

  // The name goes last so label keeps precedence
  forwardHostAria (): void {
    if (!this.button) {
      return;
    }

    forwardAllAria(this, this.button);
    this.sync('label');
  }

  // Pointer capture still clicks the button on a release outside it, so cancel that click
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

  // On the host: pointer capture retargets the rest of the press
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

  attributeChangedCallback (name: string): void {
    if (this.axisAttributeChanged(name)) {
      return;
    }

    if (this.button) {
      this.sync(name);
    }
  }

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

  // The base class sees only the attribute; a disabled fieldset leaves the tab order too
  override syncHostFocusTarget (): void {
    super.syncHostFocusTarget();

    if (this.hostFocusTarget && this.effectivelyDisabled) {
      this.hostFocusTarget.tabIndex = -1;
    }
  }

  // Detached, so the form* getters and the submitter share the platform's parsing
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

  // A form-associated custom element can't be a submitter, so a native stand-in joins for the call
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

  override focus (options?: FocusOptions): void {
    this.button?.focus(options);
  }

}

export function defineButton (options: DefineOptions = {}): DefineResult {
  return defineStrict([[TAGS.button, DropletButton]], options);
}

declare global {
  interface HTMLElementTagNameMap {
    'droplet-button': DropletButton;
  }
}
