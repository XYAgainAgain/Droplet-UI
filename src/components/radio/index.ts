/*
 * A jelly radio button. Radios that share a `name` under the same root
 * (the document or any shadow root) form one group; because each radio's
 * control lives in its own shadow tree - where native grouping cannot see
 * it - selection, roving tabindex and direction-aware arrow-key
 * navigation are coordinated here
 */

import { JellyElement }     from '../../element/index.js';
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

import radioStyles          from './radio.css?inline';

/**
 * A jelly radio button. Radios sharing a `name` under one root form a group
 * with roving-tabindex and arrow-key navigation.
 *
 * @element jelly-radio
 *
 * @slot - The label text shown beside the control.
 *
 * @attr {boolean} checked - Whether this radio is selected.
 * @attr {boolean} disabled - Disable the control and remove it from the group's tab order.
 * @attr {string} name - Groups radios that share the same value under one root.
 * @attr {string} label - Accessible name when there is no slotted label.
 * @attr {string} value - Form value submitted while selected (defaults to "on").
 * @attr {"small"|"medium"|"large"} size - Control size.
 * @attr {"white"|"rose"|"amber"|"azure"|"mint"|"platinum"|"graphite"} variant - Selected fill hue.
 *
 * @fires change - When selection changes through user interaction.
 *
 * @csspart wrap - The label wrapper.
 * @csspart control - The focusable radio control.
 *
 * @cssprop [--jelly-radio-size=32px] - Control size.
 * @cssprop [--jelly-on] - Selected fill color.
 * @cssprop [--jelly-radio-dot-color] - Center dot color.
 */
export class JellyRadio extends JellyElement {

  // Participate in native <form> submission through ElementInternals
  static formAssociated = true;

  internals: ElementInternals;

  // Populated in onBuilt()
  control!: HTMLElement;
  wrap!: HTMLElement;

  // Uniform scale spring driven by frame(): the control pops, never wiggles
  scale = 1;
  scaleVelocity = 0;

  // Tells the browser to trigger attributeChangedCallback when these attributes change
  static get observedAttributes (): string[] {
    return ['checked', 'disabled', 'label', 'size', 'value'];
  }

  constructor () {
    super();

    this.internals = this.attachInternals();
  }

  // Component styles layered over the shared jelly base styles
  override styles (): string {
    return radioStyles + variantColors({ color: '--jelly-on', on: '--jelly-radio-dot-color' });
  }

  // The interactive markup that sits above the canvas
  override content (): string {
    const labelId = uniqueId('jelly-radio-label');

    return `
      <label class="wrap" part="wrap">
        <span class="control" part="control" data-jelly-box role="radio"
              tabindex="-1" aria-checked="false" aria-labelledby="${labelId}">
          <span class="dot" aria-hidden="true"></span>
        </span>
        <span class="label" id="${labelId}"><slot></slot></span>
      </label>`;
  }

  // The circle the physics body takes - the control region, not the label
  override shape (width: number, height: number): Shape {
    const size = Math.min(width, height);

    return { width: size, height: size, radius: size / 2 };
  }

  // Resolve the control fill for the current state through the live theme tokens
  override fill (): string {
    return this.checked
      ? this.resolveColor(`var(--jelly-on, ${PALETTE['background-accent']})`)
      : this.resolveColor(`var(--jelly-fill, ${PALETTE['background-neutral']})`);
  }

  // Called once after the shadow DOM and canvas exist. Wire events here.
  override onBuilt (): void {
    this.control = this.shadowRoot!.querySelector('.control')!;
    this.wrap    = this.shadowRoot!.querySelector('.wrap')!;

    this.reflect();
    this.sync('label');
    this.trackFocus(this.control);

    // The whole row - control and label text - selects on click
    this.wrap.addEventListener('click', () => this.select(true));
    this.control.addEventListener('keydown', (event) => this.onKeydown(event));

    queueMicrotask(() => this.ensureTabbable());
  }

  // Kick the scale spring: +v expands (select), -v collapses (deselect)
  pop (v: number): void {
    if (this.reducedMotion) {
      return;
    }

    this.scaleVelocity += v;
    this.requestFrame();
  }

  // One animation step: advance the scale spring and repaint. True keeps animating.
  override frame (dt: number): boolean {
    const body = this.body;

    if (!body) {
      return false;
    }

    // One uniform scale spring - the control expands / collapses, never wiggles
    [this.scale, this.scaleVelocity] = integrateSpring(this.scale, this.scaleVelocity, 1, 260, 17, dt);

    this.clearCanvas();
    this.paintBody(body, { fill: this.fill(), scaleX: this.scale, scaleY: this.scale, ring: this.focusRing() });

    return Math.abs(1 - this.scale) > 0.0015 || Math.abs(this.scaleVelocity) > 0.0015;
  }

  // Every radio sharing this name under the same root (document or shadow root)
  group (): JellyRadio[] {
    const name = this.getAttribute('name');

    if (!name) {
      return [this];
    }

    const root = this.getRootNode() as Document | ShadowRoot;

    return [...root.querySelectorAll<JellyRadio>(`jelly-radio[name="${CSS.escape(name)}"]`)];
  }

  // With no selection yet, the first enabled radio becomes the group's tab stop
  ensureTabbable (): void {
    const group = this.group();

    if (group.some((radio) => radio.checked && !radio.hasAttribute('disabled'))) {
      return;
    }

    const first = group.find((radio) => !radio.hasAttribute('disabled'));

    if (first && first.control) {
      first.control.tabIndex = 0;
    }
  }

  // Select this radio, deselecting the rest of its group
  select (fromUser = false): void {
    if (this.hasAttribute('disabled')) {
      return;
    }

    for (const radio of this.group()) {
      if (radio === this) {
        continue;
      }

      if (fromUser && radio.checked && radio.pop) {
        radio.pop(-2.5); // the deselected control collapses
      }

      radio.checked = false;
    }

    this.checked = true;

    if (fromUser) {
      this.pop(4); // the selected control expands
      triggerHaptic();
      emit(this, 'change');
    }
  }

  // Keyboard: Space / Enter select; arrows and Home / End move the selection
  onKeydown (event: KeyboardEvent): void {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      this.select(true);
      return;
    }

    const group = this.group().filter((radio) => !radio.hasAttribute('disabled'));
    const index = group.indexOf(this);

    if (index === -1) {
      return;
    }

    // Direction-aware navigation: horizontal arrows flip on RTL pages
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

  // Mirror state into ARIA, the roving tabindex and the submitted form value
  reflect (): void {
    const checked  = this.checked;
    const disabled = this.hasAttribute('disabled');

    this.control.setAttribute('aria-checked', String(checked));
    this.control.setAttribute('aria-disabled', String(disabled));
    this.control.tabIndex = disabled ? -1 : checked ? 0 : -1;
    this.removeAttribute('tabindex');

    this.internals.setFormValue(checked ? this.value : null);
  }

  // Lifecycle method: Fires when observed HTML attributes change dynamically
  attributeChangedCallback (name: string): void {
    if (this.control) {
      this.sync(name);
    }
  }

  // Push one observed attribute into the inner control
  sync (name: string): void {
    switch (name) {
      case 'checked':
      case 'value':
        this.reflect();
        this.requestFrame();
        break;

      case 'disabled':
        this.reflect();
        queueMicrotask(() => this.ensureTabbable());
        this.requestFrame();
        break;

      case 'size':
        canonicalizeSize(this);
        break;

      case 'label': {
        // An explicit label wins over the slotted text for the accessible name
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

  // Whether this radio is currently selected (reflects the attribute)
  get checked (): boolean {
    return this.hasAttribute('checked');
  }

  set checked (value: boolean) {
    this.toggleAttribute('checked', Boolean(value));
  }

  // The form value submitted while selected (defaults to "on", like native)
  get value (): string {
    return this.getAttribute('value') || 'on';
  }

  set value (value: string) {
    this.setAttribute('value', String(value));
  }

  // Route programmatic host focus into the inner control
  override focus (options?: FocusOptions): void {
    this.control?.focus(options);
  }

}

// Register the custom element
customElements.define('jelly-radio', JellyRadio);

declare global {
  interface HTMLElementTagNameMap {
    'jelly-radio': JellyRadio;
  }
}
