// roles="tablist" switches to the tab semantics <droplet-tabs> uses

import { DropletElement }    from '../../element/index.js';
import { FORM_ATTRIBUTES }    from '../../element/form-control.js';
import { FormControl }        from '../../element/form-control.js';
import type { RestoreState }  from '../../element/form-control.js';
import type { Shape }      from '../../element/index.js';

import { DropletBody }       from '../../core/index.js';

import { emit }            from '../../utilities/index.js';
import { escapeHTML }      from '../../utilities/index.js';
import { isRTL }           from '../../utilities/index.js';
import { listNavigate }    from '../../utilities/index.js';
import { triggerHaptic }   from '../../utilities/index.js';
import { integrateSpring } from '../../utilities/index.js';

import { PALETTE }         from '../../theme/index.js';

import '../segment/index.js';
import { anyTag, defineStrict, TAGS } from '../../registry/index.js';
import type { DefineOptions, DefineResult } from '../../registry/index.js';
import { DropletSegment }       from '../segment/index.js';

import segmentedStyles     from './segmented.css?inline';

/**
 * A segmented control with a sliding soft-body pill (radiogroup, or tablist mode).
 *
 * @element droplet-segmented
 *
 * @slot - The `<droplet-segment>` options.
 *
 * @attr {string} value - The selected segment's value.
 * @attr {boolean} disabled - Disable the whole control.
 * @attr {"radiogroup"|"tablist"} roles - ARIA presentation.
 * @attr {string} label - The group's accessible name.
 * @attr {string} name - Form field name submitted with the selected value.
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
 * @fires change - With `detail.value` when the selection changes.
 *
 * @csspart wrap - The segment container.
 */
export class DropletSegmented extends FormControl(DropletElement) {

  static define (options?: DefineOptions): DefineResult {
    return defineSegmented(options);
  }

  static override usesResolver = true;

  static formAssociated = true;

  override internals: ElementInternals;

  wrap!: HTMLElement;
  pill: DropletBody | null = null;
  mutationObserver: MutationObserver | null = null;

  segments: DropletSegment[] = [];
  index = 0;
  pillX = 0;
  pillXVelocity = 0;
  pillTarget = 0;
  trackW = 0;
  trackH = 0;
  segW = 0;
  placed = false;
  reflecting = false;

  static get observedAttributes (): string[] {
    return ['value', 'disabled', 'size', 'roles', 'label', ...DropletElement.AXIS_ATTRIBUTES, ...FORM_ATTRIBUTES];
  }

  constructor () {
    super();

    this.internals = this.attachInternals();
  }

  override styles (): string {
    return segmentedStyles;
  }

  override content (): string {
    return `<div class="wrap" part="wrap" role="radiogroup"></div>`;
  }

  // Track capsule, inset 3px per side
  override shape (width: number, height: number): Shape {
    const w = width - 6;
    const h = height - 6;

    return { width: w, height: h, radius: h / 2 };
  }

  override onBuilt (): void {
    this.wrap = this.shadowRoot!.querySelector('.wrap')!;

    this.wrap.addEventListener('click', this);
    this.wrap.addEventListener('keydown', this);
    this.wrap.addEventListener('focusin', this);
    this.wrap.addEventListener('focusout', this);

    this.mutationObserver = new MutationObserver(() => this.sync());
    this.mutationObserver.observe(this, { childList: true, subtree: true, characterData: true });

    this.sync();
  }

  override connectedCallback (): void {
    const alreadyBuilt = this.built;

    if (this.authoredValue === undefined) {
      this.authoredValue = this.getAttribute('value');
    }

    super.connectedCallback();

    // Removal disconnected the observer, and the segments may have changed since
    if (alreadyBuilt && this.mutationObserver) {
      this.mutationObserver.observe(this, { childList: true, subtree: true, characterData: true });
      this.sync();
    }
  }

  override disconnectedCallback (): void {
    super.disconnectedCallback();

    this.mutationObserver?.disconnect();
  }

  handleEvent (event: Event): void {
    switch (event.type) {
      case 'click':    this.onClick(event as MouseEvent);    break;
      case 'keydown':  this.onKey(event as KeyboardEvent);   break;
      case 'focusin':  this.onFocusIn(event as FocusEvent);  break;
      case 'focusout': this.onFocusOut();                    break;
    }
  }

  get isTablist (): boolean {
    return this.getAttribute('roles') === 'tablist';
  }

  get stateAttribute (): string {
    return this.isTablist ? 'aria-selected' : 'aria-checked';
  }

  // Rebuilds the shadow buttons from the light-DOM segments
  sync (): void {
    if (!this.wrap) {
      return;
    }

    this.segments = [...this.querySelectorAll<DropletSegment>(anyTag('segment'))];

    for (const seg of this.segments) {
      if (!this.authoredSelected.has(seg)) this.authoredSelected.set(seg, seg.hasAttribute('selected'));
    }

    const want  = this.getAttribute('value');
    const found = this.segments.findIndex((s) => s.value === want);

    this.index = found >= 0 ? found : this.segments.findIndex((s) => s.hasAttribute('selected'));

    if (this.index < 0) {
      this.index = 0;
    }

    const tablist       = this.isTablist;
    const stateAttr     = this.stateAttribute;
    const groupDisabled = this.isDisabled;
    const stop          = this.tabStop(this.index);

    this.wrap.setAttribute('role', tablist ? 'tablist' : 'radiogroup');

    this.wrap.innerHTML = this.segments
      .map((s, i) => {
        const label = escapeHTML(s.label);

        return `
        <button class="segment" type="button" role="${tablist ? 'tab' : 'radio'}" data-index="${i}"
                ${stateAttr}="${i === this.index}"
                tabindex="${i === stop ? 0 : -1}"
                ${s.disabled || groupDisabled ? 'disabled' : ''}><span class="segment-top"><span>${label}</span><span class="segment-bottom" aria-hidden="true">${label}</span></span></button>`;
      })
      .join('');

    this.syncLabel();
    this.syncValue();
    this.removeAttribute('tabindex');
    this.onShape();

    this.refreshAria();
  }

  syncLabel (): void {
    const label = this.getAttribute('label');

    if (label) {
      this.wrap.setAttribute('aria-label', label);
    } else {
      this.wrap.removeAttribute('aria-label');
    }
  }

  syncValue (): void {
    const seg = this.segments[this.index];

    this.internals.setFormValue(seg ? seg.value : null);
  }

  override onShape (): void {
    if (!this.body || !this.segments.length) {
      return;
    }

    this.trackW = this.body.width;
    this.trackH = this.body.height;
    this.segW   = this.trackW / this.segments.length;

    const pillW = this.segW - 6;
    const pillH = this.trackH - 6;
    const r     = pillH / 2;

    if (!this.pill) {
      this.pill = this.createBody({ width: pillW, height: pillH, radius: r });
    } else if (Math.abs(this.pill.width - pillW) > 1.5 || Math.abs(this.pill.height - pillH) > 1.5) {
      // Only a real size change, not sub-pixel reflow
      this.pill.resize(pillW, pillH, r);
    }

    this.pillTarget = this.segX(this.index);

    // Snap only on first layout, so a mid-slide re-measure keeps the slide
    if (!this.placed) {
      this.pillX         = this.pillTarget;
      this.pillXVelocity = 0;
      this.placed        = true;
    }

    this.requestFrame();
  }

  // Measured from the rendered button, so RTL needs no math; an even split before layout
  segX (index: number): number {
    const button = this.wrap?.children[index] as HTMLElement | undefined;

    if (button && button.offsetWidth > 0) {
      return button.offsetLeft + button.offsetWidth / 2 - this.wrap.offsetWidth / 2;
    }

    const x = -this.trackW / 2 + (index + 0.5) * this.segW;

    return isRTL(this) ? -x : x;
  }

  tabStop (index: number): number {
    if (!this.segments[index]?.disabled) {
      return index;
    }

    const first = this.segments.findIndex((seg) => !seg.disabled);

    return first >= 0 ? first : index;
  }

  // evenDisabled: a form reset may land on a disabled segment, as a native select's does
  select (index: number, fromUser = false, evenDisabled = false): void {
    const seg = this.segments[index];

    if (!seg || (seg.disabled && !evenDisabled) || index === this.index) {
      if (fromUser) {
        this.focusSeg(index);
      }
      return;
    }

    this.index      = index;
    this.pillTarget = this.segX(index);

    // Physical direction, so the stretch is right in RTL too
    const dir       = Math.sign(this.pillTarget - this.pillX) || 1;
    const stateAttr = this.stateAttribute;

    const stop = this.tabStop(index);

    ([...this.wrap.children] as HTMLElement[]).forEach((button, i) => {
      button.setAttribute(stateAttr, String(i === index));
      button.tabIndex = i === stop ? 0 : -1;
    });

    this.syncValue();

    this.reflecting = true;
    this.setAttribute('value', seg.value);
    this.reflecting = false;

    if (fromUser) {
      if (!this.reducedMotion && this.pill) {
        this.pill.stretchAlong(dir, 0, 0.75);
      }

      triggerHaptic();
      this.focusSeg(index);
      emit(this, 'change', { value: seg.value });
    }

    this.requestFrame();
  }

  focusSeg (index: number): void {
    (this.wrap.children[index] as HTMLElement | undefined)?.focus();
  }

  onClick (event: MouseEvent): void {
    const seg = (event.target as HTMLElement).closest('.segment') as HTMLElement | null;

    if (seg) {
      this.select(Number(seg.dataset.index), true);
    }
  }

  onKey (event: KeyboardEvent): void {
    const count = this.segments.length;

    if (!count) {
      return;
    }

    // The focused segment is the tab stop when the chosen one is disabled
    const button = (event.target as HTMLElement).closest?.('.segment') as HTMLElement | null;
    const from   = button ? Number(button.dataset.index) : this.tabStop(this.index);
    const next   = listNavigate(event.key, from, count, { rtl: isRTL(this) });

    if (next < 0) {
      return;
    }

    event.preventDefault();

    // Skip disabled segments in the direction of travel
    const step = event.key === 'Home' ? 1
               : event.key === 'End' ? -1
               : next === (from + 1) % count ? 1 : -1;

    let index = next;

    for (let tries = 0; tries < count && this.segments[index]?.disabled; tries++) {
      index = (index + step + count) % count;
    }

    this.select(index, true);
  }

  onFocusIn (event: FocusEvent): void {
    const seg = (event.target as HTMLElement).closest('.segment');

    this.focusVisible = seg ? seg.matches(':focus-visible') : false;
    this.requestFrame();
  }

  onFocusOut (): void {
    this.focusVisible = false;
    this.requestFrame();
  }

  override frame (dt: number): boolean {
    const pill = this.pill;

    if (!pill) {
      return false;
    }

    // Nearly critically damped; less makes long jumps overshoot into the clamp
    if (this.reducedMotion) {
      this.pillX         = this.pillTarget;
      this.pillXVelocity = 0;
    } else {
      [this.pillX, this.pillXVelocity] = integrateSpring(this.pillX, this.pillXVelocity, this.pillTarget, 260, 32, dt);
    }

    // Zero outward velocity at the wall so overshoot settles instead of fighting the clamp
    const limit = Math.max(0, this.trackW / 2 - pill.width / 2);

    if (this.pillX > limit) {
      this.pillX = limit;
      if (this.pillXVelocity > 0) this.pillXVelocity = 0;
    } else if (this.pillX < -limit) {
      this.pillX = -limit;
      if (this.pillXVelocity < 0) this.pillXVelocity = 0;
    }

    // Keep the lean subtle; more pulls the moving pill out of shape
    const speed = Math.abs(this.pillXVelocity);

    if (speed > 6) {
      pill.lean = Math.sign(this.pillXVelocity);
    }

    pill.leanAmount = this.reducedMotion ? 0 : Math.min(pill.height * 0.16, speed * 0.006);

    pill.update(dt);

    const trackColor = this.resolveColor(`var(--jelly-track, var(--droplet-track, ${PALETTE['background-neutral']}))`);
    const pillColor  = this.resolveColor(`var(--jelly-pill, var(--droplet-pill, ${PALETTE['background-accent']}))`);
    const ctx        = this.ctx;
    const cx         = this.cssW / 2;
    const cy         = this.cssH / 2;

    this.clearCanvas();

    ctx.beginPath();
    ctx.roundRect(cx - this.trackW / 2, cy - this.trackH / 2, this.trackW, this.trackH, this.trackH / 2);
    ctx.fillStyle = trackColor;
    ctx.fill();

    this.paintBody(pill, {
      fill: pillColor,
      cx:   this.pillX,
      ring: this.focusRing(),
    });

    const settled =
      Math.abs(this.pillTarget - this.pillX) < 0.2 &&
      Math.abs(this.pillXVelocity) < 0.5 &&
      pill.isResting();

    return !settled;
  }

  attributeChangedCallback (name: string): void {
    if (this.axisAttributeChanged(name) || this.formAttributeChanged(name)) {
      return;
    }

    if (this.reflecting) {
      return;
    }

    switch (name) {
      case 'value':
        if (this.segments?.length) {
          const index = this.segments.findIndex((s) => s.value === this.getAttribute('value'));

          if (index >= 0) {
            this.select(index, false);
          }
        }
        break;

      case 'size':
        if (this.body) {
          this.applyShape();
        }
        break;

      case 'roles':
        if (this.wrap) {
          this.sync();
        }
        break;

      case 'disabled':
        this.syncDisabled();
        break;

      case 'label':
        if (this.wrap) {
          this.syncLabel();
        }
        break;
    }
  }

  get value (): string {
    return this.segments[this.index]?.value ?? '';
  }

  set value (v: string) {
    const index = this.segments.findIndex((s) => s.value === v);

    if (index >= 0) {
      this.select(index, false);
    }
  }

  override focus (options?: FocusOptions): void {
    (this.wrap?.children[this.tabStop(this.index)] as HTMLElement | undefined)?.focus(options);
  }

  // Reset defaults: value at first connect, each segment's selected on arrival
  authoredValue: string | null | undefined = undefined;
  authoredSelected = new WeakMap<Element, boolean>();

  override formAnchor (): HTMLElement | null {
    return (this.wrap?.children[this.index] as HTMLElement | undefined) ?? null;
  }

  // Descriptions and outer labels belong to the radiogroup, not one segment
  override formAriaTarget (): HTMLElement | null {
    return this.wrap ?? null;
  }

  override formReset (): void {
    const byValue  = this.authoredValue != null ? this.segments.find((seg) => seg.value === this.authoredValue) : undefined;
    const selected = byValue ?? this.segments.find((seg) => this.authoredSelected.get(seg)) ?? this.segments[0];

    if (selected) {
      this.select(this.segments.indexOf(selected), false, true);
    }
  }

  override formRestore (state: RestoreState): void {
    if (typeof state === 'string') {
      this.value = state;
    }
  }

  override syncDisabled (): void {
    this.sync();
  }

}

export function defineSegmented (options: DefineOptions = {}): DefineResult {
  return defineStrict([[TAGS.segmented, DropletSegmented], [TAGS.segment, DropletSegment]], options);
}

declare global {
  interface HTMLElementTagNameMap {
    'droplet-segmented': DropletSegmented;
  }
}
