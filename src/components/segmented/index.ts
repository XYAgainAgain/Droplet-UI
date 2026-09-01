/*
 * A segmented control: a capsule track of mutually exclusive options with
 * a jelly pill that slides between segments, leaning and stretching along
 * its travel. Form-associated and presented as a radiogroup by default -
 * roles="tablist" switches to tab semantics (used by <jelly-tabs>)
 */

import { JellyElement }    from '../../element/index.js';
import type { Shape }      from '../../element/index.js';

import { JellyBody }       from '../../core/index.js';

import { emit }            from '../../utilities/index.js';
import { escapeHTML }      from '../../utilities/index.js';
import { isRTL }           from '../../utilities/index.js';
import { listNavigate }    from '../../utilities/index.js';
import { triggerHaptic }   from '../../utilities/index.js';
import { integrateSpring } from '../../utilities/index.js';

import { PALETTE }         from '../../theme/index.js';

import '../segment/index.js';
import type { JellySegment } from '../segment/index.js';

import segmentedStyles     from './segmented.css?inline';

/**
 * A segmented control with a sliding jelly pill (radiogroup, or tablist mode).
 *
 * @element jelly-segmented
 *
 * @slot - The `<jelly-segment>` options.
 *
 * @attr {string} value - The selected segment's value.
 * @attr {boolean} disabled - Disable the whole control.
 * @attr {"radiogroup"|"tablist"} roles - ARIA presentation.
 * @attr {string} label - The group's accessible name.
 * @attr {string} name - Form field name submitted with the selected value.
 * @attr {"small"|"medium"|"large"} size - Control size.
 *
 * @fires change - With `detail.value` when the selection changes.
 *
 * @csspart wrap - The segment container.
 */
export class JellySegmented extends JellyElement {

  // Participate in native <form> submission through ElementInternals
  static formAssociated = true;

  internals: ElementInternals;

  // Populated in onBuilt() / onShape()
  wrap!: HTMLElement;
  pill: JellyBody | null = null;
  mutationObserver: MutationObserver | null = null;

  // Pill slide spring (position, velocity, target) plus the rendered segments
  segments: JellySegment[] = [];
  index = 0;
  pillX = 0;
  pillXVelocity = 0;
  pillTarget = 0;
  trackW = 0;
  trackH = 0;
  segW = 0;
  placed = false;
  reflecting = false;

  // Tells the browser to trigger attributeChangedCallback when these attributes change
  static get observedAttributes (): string[] {
    return ['value', 'disabled', 'size', 'roles', 'label'];
  }

  constructor () {
    super();

    this.internals = this.attachInternals();
  }

  // Component styles layered over the shared jelly base styles
  override styles (): string {
    return segmentedStyles;
  }

  // The interactive markup that sits above the canvas
  override content (): string {
    return `<div class="wrap" part="wrap" role="radiogroup"></div>`;
  }

  // The jelly track: a capsule inset a hair from the host box
  override shape (width: number, height: number): Shape {
    const w = width - 6;
    const h = height - 6;

    return { width: w, height: h, radius: h / 2 };
  }

  // Called once after the shadow DOM and canvas exist. Wire events here.
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

  // Lifecycle method: Called automatically when the element is appended to the DOM
  override connectedCallback (): void {
    const alreadyBuilt = this.built;

    super.connectedCallback();

    // Re-arm the light-DOM observer after a remove + re-append - it was
    // disconnected on removal and the segments may have changed since
    if (alreadyBuilt && this.mutationObserver) {
      this.mutationObserver.observe(this, { childList: true, subtree: true, characterData: true });
      this.sync();
    }
  }

  // Lifecycle method: Called automatically when the element leaves the DOM
  override disconnectedCallback (): void {
    super.disconnectedCallback();

    this.mutationObserver?.disconnect();
  }

  // Central handler for the listeners registered with `this`
  handleEvent (event: Event): void {
    switch (event.type) {
      case 'click':    this.onClick(event as MouseEvent);    break;
      case 'keydown':  this.onKey(event as KeyboardEvent);   break;
      case 'focusin':  this.onFocusIn(event as FocusEvent);  break;
      case 'focusout': this.onFocusOut();                    break;
    }
  }

  // True when the control presents tab semantics instead of radio semantics
  get isTablist (): boolean {
    return this.getAttribute('roles') === 'tablist';
  }

  // The ARIA state attribute matching the current roles mode
  get stateAttribute (): string {
    return this.isTablist ? 'aria-selected' : 'aria-checked';
  }

  /*
   * Rebuild the shadow buttons from the light-DOM <jelly-segment> children.
   * Runs on connect, on any light-DOM mutation and when the roles or
   * disabled attributes change the rendered semantics.
   */
  sync (): void {
    if (!this.wrap) {
      return;
    }

    this.segments = [...this.querySelectorAll('jelly-segment')];

    const want  = this.getAttribute('value');
    const found = this.segments.findIndex((s) => s.value === want);

    this.index = found >= 0 ? found : this.segments.findIndex((s) => s.hasAttribute('selected'));

    if (this.index < 0) {
      this.index = 0;
    }

    const tablist       = this.isTablist;
    const stateAttr     = this.stateAttribute;
    const groupDisabled = this.hasAttribute('disabled');

    this.wrap.setAttribute('role', tablist ? 'tablist' : 'radiogroup');

    this.wrap.innerHTML = this.segments
      .map((s, i) => {
        const label = escapeHTML(s.label);

        return `
        <button class="segment" type="button" role="${tablist ? 'tab' : 'radio'}" data-index="${i}"
                ${stateAttr}="${i === this.index}"
                tabindex="${i === this.index ? 0 : -1}"
                ${s.disabled || groupDisabled ? 'disabled' : ''}><span class="segment-top"><span>${label}</span><span class="segment-bottom" aria-hidden="true">${label}</span></span></button>`;
      })
      .join('');

    this.syncLabel();
    this.syncValue();
    this.removeAttribute('tabindex');
    this.onShape();
  }

  // Apply the label attribute as the group's accessible name
  syncLabel (): void {
    const label = this.getAttribute('label');

    if (label) {
      this.wrap.setAttribute('aria-label', label);
    } else {
      this.wrap.removeAttribute('aria-label');
    }
  }

  // Push the active segment's value into the form internals
  syncValue (): void {
    const seg = this.segments[this.index];

    this.internals.setFormValue(seg ? seg.value : null);
  }

  // Called whenever the shape (re)builds: size the pill and aim it at the active segment
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
      this.pill = new JellyBody({ width: pillW, height: pillH, radius: r });
    } else if (Math.abs(this.pill.width - pillW) > 1.5 || Math.abs(this.pill.height - pillH) > 1.5) {
      // Only rebuild the membrane on a real size change - not the sub-pixel
      // reflow that selecting a tab causes (the active label turns bold).
      this.pill.resize(pillW, pillH, r);
    }

    this.pillTarget = this.segX(this.index);

    // Snap into place only on first layout. Re-measures triggered mid-slide
    // (e.g. the ResizeObserver firing when the active label goes bold) must NOT
    // reset the pill, or the animation between segments is killed on every click.
    if (!this.placed) {
      this.pillX         = this.pillTarget;
      this.pillXVelocity = 0;
      this.placed        = true;
    }

    this.requestFrame();
  }

  /*
   * The pill's resting center for a segment, in canvas-local coordinates.
   * Measured from the rendered button's box, so it is correct in both LTR
   * and RTL without any direction math; falls back to an even split
   * (mirrored for RTL) before the first layout.
   */
  segX (index: number): number {
    const button = this.wrap?.children[index] as HTMLElement | undefined;

    if (button && button.offsetWidth > 0) {
      return button.offsetLeft + button.offsetWidth / 2 - this.wrap.offsetWidth / 2;
    }

    const x = -this.trackW / 2 + (index + 0.5) * this.segW;

    return isRTL(this) ? -x : x;
  }

  /*
   * Make a segment the active one: move the roving tabindex, launch the
   * pill toward it, sync the form value and reflect to the host attribute.
   * User selections also stretch the pill, buzz, focus and emit change.
   */
  select (index: number, fromUser = false): void {
    const seg = this.segments[index];

    if (!seg || seg.disabled || index === this.index) {
      if (fromUser) {
        this.focusSeg(index);
      }
      return;
    }

    this.index      = index;
    this.pillTarget = this.segX(index);

    // Physical travel direction (from the rect math above), so the stretch
    // leans the right way in both LTR and RTL layouts
    const dir       = Math.sign(this.pillTarget - this.pillX) || 1;
    const stateAttr = this.stateAttribute;

    ([...this.wrap.children] as HTMLElement[]).forEach((button, i) => {
      button.setAttribute(stateAttr, String(i === index));
      button.tabIndex = i === index ? 0 : -1;
    });

    this.syncValue();

    // Reflect to the host attribute without re-entering via attributeChanged.
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

  // Move focus onto a segment's button
  focusSeg (index: number): void {
    (this.wrap.children[index] as HTMLElement | undefined)?.focus();
  }

  // Activate the segment under a click / tap
  onClick (event: MouseEvent): void {
    const seg = (event.target as HTMLElement).closest('.segment') as HTMLElement | null;

    if (seg) {
      this.select(Number(seg.dataset.index), true);
    }
  }

  /*
   * Roving-tabindex keyboard support: arrows move the selection (horizontal
   * arrows flip with the reading direction), Home / End jump to the ends,
   * and disabled segments are skipped in the direction of travel.
   */
  onKey (event: KeyboardEvent): void {
    const count = this.segments.length;

    if (!count) {
      return;
    }

    const next = listNavigate(event.key, this.index, count, { rtl: isRTL(this) });

    if (next < 0) {
      return;
    }

    event.preventDefault();

    // Keep stepping the same way while the landing segment is disabled
    const step = event.key === 'Home' ? 1
               : event.key === 'End' ? -1
               : next === (this.index + 1) % count ? 1 : -1;

    let index = next;

    for (let tries = 0; tries < count && this.segments[index]?.disabled; tries++) {
      index = (index + step + count) % count;
    }

    this.select(index, true);
  }

  // Show the painted focus ring only for keyboard (:focus-visible) focus
  onFocusIn (event: FocusEvent): void {
    const seg = (event.target as HTMLElement).closest('.segment');

    this.focusVisible = seg ? seg.matches(':focus-visible') : false;
    this.requestFrame();
  }

  // Hide the painted focus ring when focus leaves the control
  onFocusOut (): void {
    this.focusVisible = false;
    this.requestFrame();
  }

  // One animation step: spring the pill toward its segment, paint track + pill
  override frame (dt: number): boolean {
    const pill = this.pill;

    if (!pill) {
      return false;
    }

    // Smooth, nearly critically-damped slide. This keeps the jelly feel without
    // the uneven overshoot/clamp rhythm that made longer jumps feel lumpy.
    // Reduced motion snaps the pill straight to the active segment.
    if (this.reducedMotion) {
      this.pillX         = this.pillTarget;
      this.pillXVelocity = 0;
    } else {
      [this.pillX, this.pillXVelocity] = integrateSpring(this.pillX, this.pillXVelocity, this.pillTarget, 260, 32, dt);
    }

    // Keep the pill fully inside the track: the bouncy spring's overshoot must
    // never carry it past the parent's edges. Stop the outward velocity at the
    // wall so it settles instead of fighting the clamp.
    const limit = Math.max(0, this.trackW / 2 - pill.width / 2);

    if (this.pillX > limit) {
      this.pillX = limit;
      if (this.pillXVelocity > 0) this.pillXVelocity = 0;
    } else if (this.pillX < -limit) {
      this.pillX = -limit;
      if (this.pillXVelocity < 0) this.pillXVelocity = 0;
    }

    // Gentle organic lean: enough to feel soft, but not enough to pull the
    // moving pill into an uneven shape.
    const speed = Math.abs(this.pillXVelocity);

    if (speed > 6) {
      pill.lean = Math.sign(this.pillXVelocity);
    }

    pill.leanAmount = this.reducedMotion ? 0 : Math.min(pill.height * 0.16, speed * 0.006);

    pill.update(dt);

    // Canvas colors resolve through the live theme tokens on every paint, so
    // theme flips and token overrides recolor the control immediately
    const trackColor = this.resolveColor(`var(--jelly-track, ${PALETTE['background-neutral']})`);
    const pillColor  = this.resolveColor(`var(--jelly-pill, ${PALETTE['background-accent']})`);
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

  // Lifecycle method: Fires when observed HTML attributes change dynamically
  attributeChangedCallback (name: string): void {
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
      case 'disabled':
        if (this.wrap) {
          this.sync();
        }
        break;

      case 'label':
        if (this.wrap) {
          this.syncLabel();
        }
        break;
    }
  }

  // The active segment's value (empty until segments exist)
  get value (): string {
    return this.segments[this.index]?.value ?? '';
  }

  // Select the segment whose value matches, without the user-interaction effects
  set value (v: string) {
    const index = this.segments.findIndex((s) => s.value === v);

    if (index >= 0) {
      this.select(index, false);
    }
  }

  // Route programmatic host focus onto the active segment's button
  override focus (options?: FocusOptions): void {
    (this.wrap?.children[this.index] as HTMLElement | undefined)?.focus(options);
  }

}

// Register the custom element
customElements.define('jelly-segmented', JellySegmented);

declare global {
  interface HTMLElementTagNameMap {
    'jelly-segmented': JellySegmented;
  }
}
