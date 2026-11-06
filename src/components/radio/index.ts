// Native grouping can't cross shadow trees, so same-name radios under one root coordinate here

import { DropletElement }     from '../../element/index.js';
import { FORM_ATTRIBUTES }    from '../../element/form-control.js';
import { FormControl }        from '../../element/form-control.js';
import type { RestoreState }  from '../../element/form-control.js';
import type { Shape }       from '../../element/index.js';

import { canonicalizeSize } from '../../utilities/index.js';
import { emit }             from '../../utilities/index.js';
import { isRTL }            from '../../utilities/index.js';
import { listNavigate }     from '../../utilities/index.js';
import { triggerHaptic }    from '../../utilities/index.js';
import { uniqueId }         from '../../utilities/index.js';
import { integrateSpring }  from '../../utilities/index.js';

import { PALETTE }          from '../../theme/index.js';
import { variantColors }    from '../../theme/index.js';
import { anyTag, defineStrict, TAGS } from '../../registry/index.js';
import type { DefineOptions, DefineResult } from '../../registry/index.js';

import radioStyles          from './radio.css?inline';

/**
 * A soft-body radio button. Radios sharing a `name` under one root form a group
 * with roving-tabindex and arrow-key navigation.
 *
 * @element droplet-radio
 *
 * @slot - The label text shown beside the control.
 *
 * @attr {boolean} checked - Whether this radio is selected.
 * @attr {boolean} disabled - Disable the control and remove it from the group's tab order.
 * @attr {boolean} required - Makes the whole group invalid (valueMissing) until one radio in it is selected.
 * @attr {string} name - Groups radios that share the same value under one root.
 * @attr {string} label - Accessible name when there is no slotted label.
 * @attr {string} value - Form value submitted while selected (defaults to "on").
 * @attr {"small"|"medium"|"large"} size - Control size.
 * @attr {"white"|"rose"|"amber"|"azure"|"mint"|"platinum"|"graphite"} variant - Selected fill hue.
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
 * @fires change - When selection changes through user interaction.
 *
 * @csspart wrap - The label wrapper.
 * @csspart control - The focusable radio control.
 *
 * @cssprop [--droplet-radio-size=32px] - Control size.
 * @cssprop [--droplet-on] - Selected fill color.
 * @cssprop [--droplet-radio-dot-color] - Center dot color.
 */
export class DropletRadio extends FormControl(DropletElement) {

  static define (options?: DefineOptions): DefineResult {
    return defineRadio(options);
  }

  static override usesResolver = true;

  static override textOnFill = false;

  static formAssociated = true;

  override internals: ElementInternals;

  control!: HTMLElement;
  wrap!: HTMLElement;

  scale = 1;
  scaleVelocity = 0;

  static get observedAttributes (): string[] {
    return ['checked', 'disabled', 'label', 'size', 'value', 'name', 'form', ...DropletElement.AXIS_ATTRIBUTES, ...FORM_ATTRIBUTES];
  }

  constructor () {
    super();

    this.internals = this.attachInternals();
  }

  override styles (): string {
    return radioStyles + variantColors({ color: '--droplet-on', on: '--droplet-radio-dot-color' });
  }

  override content (): string {
    const labelId = uniqueId('droplet-radio-label');

    return `
      <label class="wrap" part="wrap">
        <span class="control" part="control" data-droplet-box role="radio"
              tabindex="-1" aria-checked="false" aria-labelledby="${labelId}">
          <span class="dot" aria-hidden="true"></span>
        </span>
        <span class="label" id="${labelId}"><slot></slot></span>
      </label>`;
  }

  // The physics body is the control circle, not the label
  override shape (width: number, height: number): Shape {
    const size = Math.min(width, height);

    return { width: size, height: size, radius: size / 2 };
  }

  override fill (): string {
    return this.checked
      ? this.resolveColor(`var(--jelly-on, var(--droplet-on, ${PALETTE['background-accent']}))`)
      : this.resolveColor(`var(--jelly-fill, var(--droplet-fill, ${PALETTE['background-neutral']}))`);
  }

  override onBuilt (): void {
    this.control = this.shadowRoot!.querySelector('.control')!;
    this.wrap    = this.shadowRoot!.querySelector('.wrap')!;

    this.reflect();
    this.sync('label');
    this.trackFocus(this.control);

    this.wrap.addEventListener('click', () => this.select(true));
    this.control.addEventListener('keydown', (event) => this.onKeydown(event));

    queueMicrotask(() => this.ensureTabbable());
  }

  // +v expands, -v collapses
  pop (v: number): void {
    if (this.reducedMotion) {
      return;
    }

    this.scaleVelocity += v;
    this.requestFrame();
  }

  override frame (dt: number): boolean {
    const body = this.body;

    if (!body) {
      return false;
    }

    [this.scale, this.scaleVelocity] = integrateSpring(this.scale, this.scaleVelocity, 1, 260, 17, dt);

    this.clearCanvas();
    this.paintBody(body, { fill: this.fill(), scaleX: this.scale, scaleY: this.scale, ring: this.focusRing() });

    return Math.abs(1 - this.scale) > 0.0015 || Math.abs(this.scaleVelocity) > 0.0015;
  }

  group (): DropletRadio[] {
    const name = this.getAttribute('name');

    if (!name) {
      return [this];
    }

    const root = this.getRootNode() as Document | ShadowRoot;

    return DropletRadio.peers(root, name, this.internals?.form ?? null);
  }

  // Tree, name, and form owner, as natively: two forms never share a group
  static peers (root: Document | ShadowRoot | Node, name: string, form: HTMLFormElement | null): DropletRadio[] {
    if (!('querySelectorAll' in root)) {
      return [];
    }

    return [...(root as ParentNode).querySelectorAll<DropletRadio>(`:is(${anyTag('radio')})[name="${CSS.escape(name)}"]`)]
      .filter((radio) => (radio.internals?.form ?? null) === form);
  }

  // Validity is group-wide, so every peer refreshes
  refreshGroup (radios: DropletRadio[] = this.group()): void {
    for (const radio of radios) {
      if (typeof radio.updateValidity === 'function') radio.updateValidity();
    }
  }

  // Where it last grouped, so leaving can still refresh the peers left behind
  lastGroup: { root: Node; name: string; form: HTMLFormElement | null } | null = null;

  rememberGroup (): void {
    const name = this.getAttribute('name');

    this.lastGroup = name ? { root: this.getRootNode(), name, form: this.internals?.form ?? null } : null;
  }

  refreshLastGroup (): void {
    const last = this.lastGroup;

    if (last) {
      this.refreshGroup(DropletRadio.peers(last.root, last.name, last.form));
    }
  }

  // One tab stop per group, as natively
  ensureTabbable (): void {
    const group = this.group();
    const stop  = group.find((radio) => radio.checked && !radio.isDisabled) ?? group.find((radio) => !radio.isDisabled);

    for (const radio of group) {
      if (radio.control) radio.control.tabIndex = radio === stop ? 0 : -1;
    }
  }

  select (fromUser = false): void {
    if (this.isDisabled) {
      return;
    }

    for (const radio of this.group()) {
      if (radio === this) {
        continue;
      }

      if (fromUser && radio.checked && radio.pop) {
        radio.pop(-2.5);
      }

      radio.checked = false;
    }

    this.checked = true;

    if (fromUser) {
      this.pop(4);
      triggerHaptic();
      emit(this, 'change');
    }
  }

  onKeydown (event: KeyboardEvent): void {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      this.select(true);
      return;
    }

    const group = this.group().filter((radio) => !radio.isDisabled);
    const index = group.indexOf(this);

    if (index === -1) {
      return;
    }

    const next = listNavigate(event.key, index, group.length, { rtl: isRTL(this) });

    if (next === -1) {
      return;
    }

    event.preventDefault();

    const target = group[next];

    if (!target) {
      return;
    }

    target.control.focus();
    target.select(true);
  }

  reflect (): void {
    const checked  = this.checked;
    const disabled = this.isDisabled;

    this.control.setAttribute('aria-checked', String(checked));
    this.control.setAttribute('aria-disabled', String(disabled));
    this.control.tabIndex = disabled ? -1 : checked ? 0 : -1;
    this.removeAttribute('tabindex');

    this.internals.setFormValue(checked ? this.value : null);
  }

  attributeChangedCallback (name: string): void {
    // Required is group-wide; a new name or form moves the radio between groups
    if (name === 'required' || name === 'name' || name === 'form') {
      this.refreshLastGroup();
      this.rememberGroup();
      this.refreshGroup();
      return;
    }

    if (this.axisAttributeChanged(name) || this.formAttributeChanged(name)) {
      return;
    }

    if (this.control) {
      this.sync(name);
    }
  }

  sync (name: string): void {
    switch (name) {
      case 'checked':
        this.reflect();
        this.refreshGroup();
        this.requestFrame();
        queueMicrotask(() => this.ensureTabbable());
        break;

      case 'value':
        this.reflect();
        this.requestFrame();
        break;

      case 'disabled':
        this.syncDisabled();
        break;

      case 'size':
        canonicalizeSize(this);
        break;

      case 'label': {
        const label = this.getAttribute('label');

        if (label) {
          this.control.setAttribute('aria-label', label);
        } else {
          this.control.removeAttribute('aria-label');
        }
        break;
      }
    }
  }

  get checked (): boolean {
    return this.hasAttribute('checked');
  }

  set checked (value: boolean) {
    this.toggleAttribute('checked', Boolean(value));
  }

  get value (): string {
    return this.getAttribute('value') || 'on';
  }

  set value (value: string) {
    this.setAttribute('value', String(value));
  }

  override focus (options?: FocusOptions): void {
    this.control?.focus(options);
  }

  defaultCheckedValue: boolean | null = null;

  // What a form reset returns to: the markup's checked attribute at first connect
  get defaultChecked (): boolean {
    return this.defaultCheckedValue ?? this.hasAttribute('checked');
  }

  set defaultChecked (value: boolean) {
    this.defaultCheckedValue = Boolean(value);
  }

  override connectedCallback (): void {
    this.defaultCheckedValue ??= this.hasAttribute('checked');

    super.connectedCallback();

    this.rememberGroup();
    this.refreshGroup();
  }

  override disconnectedCallback (): void {
    super.disconnectedCallback();

    this.refreshLastGroup();
  }

  formAssociatedCallback (): void {
    this.refreshLastGroup();
    this.rememberGroup();
    this.refreshGroup();
  }

  override formAnchor (): HTMLElement | null {
    return this.control ?? null;
  }

  override formRequired (): boolean {
    return this.group().some((radio) => radio.hasAttribute('required'));
  }

  override formValueMissing (): boolean {
    return !this.group().some((radio) => radio.checked);
  }

  override formOwnLabels (): Element[] {
    const label = this.shadowRoot?.querySelector('.label');

    return label ? [label] : [];
  }

  override formActivate (): void {
    this.control?.focus();
    this.select(true);
  }

  override formReset (): void {
    this.checked = this.defaultChecked;
  }

  override formRestore (state: RestoreState): void {
    if (state !== null && state !== '') {
      this.select(false);
    }
  }

  override syncDisabled (): void {
    if (!this.control) {
      return;
    }

    this.reflect();
    queueMicrotask(() => this.ensureTabbable());
    this.updateValidity();
    this.requestFrame();
  }

}

export function defineRadio (options: DefineOptions = {}): DefineResult {
  return defineStrict([[TAGS.radio, DropletRadio]], options);
}

declare global {
  interface HTMLElementTagNameMap {
    'droplet-radio': DropletRadio;
  }
}
