/*
 * Two role="slider" knobs carry focus and all the ARIA while the painted
 * thumbs squish and lean. It submits "low,high", and in RTL the painting,
 * knob placement, and arrow keys all mirror like native sliders.
 */

import { DropletElement }     from '../../element/index.js';
import type { Shape }       from '../../element/index.js';

import { DropletBody }        from '../../core/index.js';
import type { DropletConfig } from '../../core/index.js';

import { canonicalizeSize } from '../../utilities/index.js';
import { clamp }            from '../../utilities/index.js';
import { emit }             from '../../utilities/index.js';
import { horizontalStep }   from '../../utilities/index.js';
import { isRTL }            from '../../utilities/index.js';
import { numberAttribute }  from '../../utilities/index.js';
import type { Size }        from '../../utilities/index.js';
import { triggerHaptic }    from '../../utilities/index.js';
import { integrateSpring }  from '../../utilities/index.js';

import { PALETTE }          from '../../theme/index.js';
import { variantColors }    from '../../theme/index.js';
import { defineStrict, TAGS } from '../../registry/index.js';
import type { DefineOptions, DefineResult } from '../../registry/index.js';

import rangeStyles          from './range.css?inline';

interface RangeSize {
  width: number;
  height: number;
  thumb: number;
  track: number;
}

type ThumbIndex = 0 | 1;

// Host geometry per size: footprint, thumb diameter, track height
const RANGE_SIZES: Record<Size, RangeSize> = {
  small:  { width: 220, height: 30, thumb: 24, track: 9 },
  medium: { width: 260, height: 36, thumb: 28, track: 12 },
  large:  { width: 320, height: 44, thumb: 34, track: 14 },
};

// Thumb physics: small, tight drops that stay lively under drag
const THUMB_CONFIG: Partial<DropletConfig> = {
  membraneSpring:          82,
  membraneDamping:         14,
  waveCoupling:            170,
  pressure:                700,
  volumeCorrection:        0.14,
  insideLocalBulgeImpulse: 330,
  rippleWidth:             10,
};

/**
 * A dual-thumb range slider that picks a low/high interval.
 *
 * @element droplet-range
 *
 * @attr {number} low - Lower bound of the selection.
 * @attr {number} high - Upper bound of the selection.
 * @attr {number} min - Minimum value (defaults to 0).
 * @attr {number} max - Maximum value (defaults to 100).
 * @attr {number} step - Step increment (defaults to 1).
 * @attr {string} label - Accessible name for the control.
 * @attr {string} name - Form field name submitted with the value.
 * @attr {boolean} disabled - Disable the control and remove it from the tab order.
 * @attr {"small"|"medium"|"large"} size - Control size.
 * @attr {"white"|"rose"|"amber"|"azure"|"mint"|"platinum"|"graphite"} variant - Accent fill hue.
 * @attr {string} feel - Registered feel preset driving the physics; inherits from a `data-droplet-feel` scope.
 * @attr {"low"|"medium"|"high"} quality - Caps physics cost (med/lo/hi aliases accepted); inherits from a `data-droplet-quality` scope.
 *
 * @fires input - Continuously as a bound changes.
 * @fires change - When a bound is committed.
 *
 * @csspart wrap - The positioning wrapper.
 * @csspart track - The track surface.
 * @csspart knob - Each draggable knob.
 *
 * @cssprop [--droplet-accent] - Selected-interval fill and thumb color.
 * @cssprop [--droplet-track] - Empty-track color.
 */
export class DropletRange extends DropletElement implements EventListenerObject {

  static define (options?: DefineOptions): DefineResult {
    return defineRange(options);
  }

  static override usesResolver = true;

  // Participate in native form submission through ElementInternals
  static formAssociated = true;

  internals: ElementInternals;

  // Populated in onBuilt()/onShape()
  track!: HTMLElement;
  knobs!: HTMLElement[];
  thumbs: [DropletBody, DropletBody] | null = null;
  val: [number, number] = [0, 100];

  x: [number, number] = [0, 0];
  xVelocity: [number, number] = [0, 0];
  target: [number, number] = [0, 0];
  pressScale: [number, number] = [1, 1];
  pressScaleVelocity: [number, number] = [0, 0];

  active: ThumbIndex = 1;
  drag: ThumbIndex | null = null;
  pointerId: number | null = null;
  windowBound = false;
  trackW = 0;
  trackH = 0;

  static get observedAttributes (): string[] {
    return ['min', 'max', 'step', 'low', 'high', 'label', 'disabled', 'size', ...DropletElement.AXIS_ATTRIBUTES];
  }

  constructor () {
    super();

    this.internals = this.attachInternals();
  }

  override styles (): string {
    return rangeStyles + variantColors({ color: '--droplet-accent' });
  }

  override content (): string {
    return `
      <div class="wrap" part="wrap">
        <span class="track" part="track" data-droplet-box aria-hidden="true"></span>
        <span class="knob" part="knob" data-k="0" role="slider" tabindex="0"></span>
        <span class="knob" part="knob" data-k="1" role="slider" tabindex="0"></span>
      </div>`;
  }

  // The base body is the track capsule; the thumbs ride on top
  override shape (width: number, height: number): Shape {
    const trackH = height || this.sizeConfig.track;

    return { width, height: trackH, radius: trackH / 2 };
  }

  get sizeKey (): Size {
    const size = (this.getAttribute('size') || 'medium').toLowerCase();

    return size === 'small' || size === 'large' ? size : 'medium';
  }

  get sizeConfig (): RangeSize {
    return RANGE_SIZES[this.sizeKey];
  }

  get min (): number {
    return numberAttribute(this, 'min', 0);
  }

  get max (): number {
    return numberAttribute(this, 'max', 100);
  }

  // The step increment (always positive)
  get step (): number {
    const step = numberAttribute(this, 'step', 1);

    return step > 0 ? step : 1;
  }

  // How far a thumb center can travel along the track, in pixels
  get travel (): number {
    return Math.max(0, this.trackW - this.sizeConfig.thumb);
  }

  override onBuilt (): void {
    this.track = this.shadowRoot!.querySelector('.track')!;
    this.knobs = [...this.shadowRoot!.querySelectorAll<HTMLElement>('.knob')];

    this.val = [
      numberAttribute(this, 'low', this.min),
      numberAttribute(this, 'high', this.max),
    ];
    this.normalizeValues();

    this.track.addEventListener('pointerdown', this);

    for (const knob of this.knobs) {
      knob.addEventListener('pointerdown', this);
      knob.addEventListener('keydown',     this);
      knob.addEventListener('focus',       this);
      knob.addEventListener('blur',        this);
    }

    this.syncA11y();
    this.syncFormValue();
  }

  override disconnectedCallback (): void {
    super.disconnectedCallback();

    this.unbindWindow();

    this.drag      = null;
    this.pointerId = null;
  }

  // Route knob-, track-, and window-level events registered with `this`
  handleEvent (event: Event): void {
    switch (event.type) {
      case 'pointerdown':   this.down(event as PointerEvent, this.knobIndex(event)); break;
      case 'pointermove':   this.move(event as PointerEvent);                        break;
      case 'pointerup':
      case 'pointercancel': this.up(event as PointerEvent);                          break;
      case 'keydown':       this.key(event as KeyboardEvent, this.knobIndex(event)); break;
      case 'focus':         this.focusKnob(event as FocusEvent);                     break;
      case 'blur':          this.blurKnob();                                         break;
    }
  }

  // The knob index an event was wired on, or null for the track/window
  knobIndex (event: Event): ThumbIndex | null {
    const index = (event.currentTarget as HTMLElement | null)?.dataset?.k;

    return index === '0' ? 0 : index === '1' ? 1 : null;
  }

  // Rebuild the two thumb bodies and settle them onto their targets
  override onShape (): void {
    this.trackW = this.body ? this.body.width : this.getBoundingClientRect().width;
    this.trackH = this.body ? this.body.height : this.sizeConfig.track;

    const size = this.sizeConfig.thumb;

    if (!this.thumbs) {
      this.thumbs = [
        this.createBody({ width: size, height: size, radius: size / 2 }, THUMB_CONFIG),
        this.createBody({ width: size, height: size, radius: size / 2 }, THUMB_CONFIG),
      ];
    } else {
      this.thumbs.forEach((thumb) => thumb.resize(size, size, size / 2));
    }

    this.target    = [this.valToX(this.val[0]), this.valToX(this.val[1])];
    this.x         = [...this.target];
    this.xVelocity = [0, 0];

    this.reflectKnobs();
    this.syncA11y();
    this.requestFrame();
  }

  // A value as a 0–1 fraction of the min → max span
  fraction (value: number): number {
    return (value - this.min) / ((this.max - this.min) || 1);
  }

  // A value's logical x-offset from the track center (+ toward the inline end)
  logicalX (value: number): number {
    return -this.travel / 2 + this.fraction(value) * this.travel;
  }

  // A value's physical canvas x, mirrored in RTL where values grow leftward
  valToX (value: number): number {
    const x = this.logicalX(value);

    return isRTL(this) ? -x : x;
  }

  // A physical canvas x back to a stepped value, honoring reading direction
  xToVal (x: number): number {
    const half = this.travel / 2 || 1;

    let fraction = clamp((x + half) / (half * 2), 0, 1);

    if (isRTL(this)) {
      fraction = 1 - fraction;
    }

    const raw = this.min + fraction * (this.max - this.min);

    return Math.round(raw / this.step) * this.step;
  }

  // Clamp both values into [min, max] and keep low ≤ high
  normalizeValues (): void {
    const min  = this.min;
    const max  = this.max;
    const low  = Number.isFinite(this.val?.[0]) ? this.val[0] : min;
    const high = Number.isFinite(this.val?.[1]) ? this.val[1] : max;

    this.val = [
      clamp(Math.min(low, high), min, max),
      clamp(Math.max(low, high), min, max),
    ];
  }

  // Re-derive targets, knob placement, ARIA, and the form value after a bound change
  syncValueState (): void {
    if (!this.val) {
      return;
    }

    this.normalizeValues();

    if (this.body) {
      this.target = [this.valToX(this.val[0]), this.valToX(this.val[1])];
    }

    this.reflectKnobs();
    this.syncA11y();
    this.syncFormValue();
    this.requestFrame();
  }

  // Set one bound (0 = low, 1 = high), clamped against the other and reflect it
  setVal (i: ThumbIndex, value: number, fromUser = false): void {
    if (!Number.isFinite(value)) {
      return;
    }

    value = clamp(value, this.min, this.max);
    value = i === 0 ? Math.min(value, this.val[1]) : Math.max(value, this.val[0]);

    if (value === this.val[i]) {
      return;
    }

    this.val[i]    = value;
    this.target[i] = this.valToX(value);
    this.active    = i;

    this.reflectKnobs();
    this.syncA11y();
    this.syncFormValue();

    if (fromUser) {
      emit(this, 'input');
    }

    this.requestFrame();
  }

  // Place the knobs along the track via direction-aware inset-inline-start
  reflectKnobs (): void {
    if (!this.knobs || !Number.isFinite(this.trackW)) {
      return;
    }

    const thumb = this.sizeConfig.thumb;

    this.knobs.forEach((knob, i) => {
      const value = this.val[i];

      if (value === undefined) {
        return;
      }

      const center = this.trackW / 2 + this.logicalX(value);

      knob.style.insetInlineStart = `${center - thumb / 2}px`;
    });
  }

  // Mirror state onto the two role=slider knobs, which carry all the ARIA
  syncA11y (): void {
    if (!this.knobs) {
      return;
    }

    const disabled = this.hasAttribute('disabled');
    const label    = this.getAttribute('label');

    this.removeAttribute('tabindex');

    this.knobs.forEach((knob, i) => {
      const name = i === 0 ? 'Minimum' : 'Maximum';

      knob.tabIndex = disabled ? -1 : 0;

      knob.setAttribute('aria-label',     label ? `${label} ${name.toLowerCase()}` : name);
      knob.setAttribute('aria-valuemin',  String(this.min));
      knob.setAttribute('aria-valuemax',  String(this.max));
      knob.setAttribute('aria-valuenow',  String(this.val[i]));
      knob.setAttribute('aria-valuetext', String(this.val[i]));
      knob.setAttribute('aria-disabled',  String(disabled));
    });
  }

  // Mirror the "low,high" value into the host form
  syncFormValue (): void {
    this.internals.setFormValue(this.val.join(','));
  }

  // The knob index whose thumb sits closest to a physical canvas x
  nearest (x: number): ThumbIndex {
    return Math.abs(x - this.valToX(this.val[0])) <= Math.abs(x - this.valToX(this.val[1])) ? 0 : 1;
  }

  bindWindow (): void {
    if (this.windowBound) {
      return;
    }

    this.windowBound = true;

    window.addEventListener('pointermove',   this);
    window.addEventListener('pointerup',     this);
    window.addEventListener('pointercancel', this);
  }

  unbindWindow (): void {
    if (!this.windowBound) {
      return;
    }

    this.windowBound = false;

    window.removeEventListener('pointermove',   this);
    window.removeEventListener('pointerup',     this);
    window.removeEventListener('pointercancel', this);
  }

  // Begin a drag: pick the pressed (or nearest) knob and jump it to the pointer
  down (event: PointerEvent, forced: ThumbIndex | null): void {
    if (this.hasAttribute('disabled')) {
      return;
    }

    const local = this.toLocal(event.clientX, 0);
    const drag  = forced != null ? forced : this.nearest(local.x);

    this.drag      = drag;
    this.active    = drag;
    this.pointerId = event.pointerId;

    this.focus({ preventScroll: true });

    if (!this.reducedMotion) {
      this.thumbs?.[drag]?.centerPop(1);
    }

    this.setVal(drag, this.xToVal(local.x), true);
    this.bindWindow();
    this.requestFrame();
    triggerHaptic();
  }

  move (event: PointerEvent): void {
    const drag = this.drag;

    if (drag == null || this.pointerId !== event.pointerId) {
      return;
    }

    const local = this.toLocal(event.clientX, 0);

    this.setVal(drag, this.xToVal(local.x), true);
  }

  up (event: PointerEvent): void {
    const drag = this.drag;

    if (drag == null || this.pointerId !== event.pointerId) {
      return;
    }

    this.thumbs?.[drag]?.release();

    this.drag      = null;
    this.pointerId = null;

    this.unbindWindow();
    emit(this, 'change');
    this.requestFrame();
  }

  // Keyboard stepping per knob: arrows follow reading direction, Shift ×10, Home/End
  key (event: KeyboardEvent, i: ThumbIndex | null): void {
    if (i == null) {
      return;
    }

    const step = this.step * (event.shiftKey ? 10 : 1);

    let delta = horizontalStep(event.key, isRTL(this)) * step;

    if (delta === 0 && event.key === 'ArrowUp')   delta = step;
    if (delta === 0 && event.key === 'ArrowDown') delta = -step;
    // PageUp/PageDown page by the ×10 step, matching droplet-slider's native range
    if (event.key === 'PageUp')   delta = this.step * 10;
    if (event.key === 'PageDown') delta = -this.step * 10;

    let next: number;

    if (delta !== 0) {
      next = this.val[i] + delta;
    } else if (event.key === 'Home') {
      next = this.min;
    } else if (event.key === 'End') {
      next = this.max;
    } else {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    this.setVal(i, next, true);
    emit(this, 'change');
  }

  // A knob taking keyboard focus becomes the active thumb and shows the ring
  focusKnob (event: FocusEvent): void {
    const knob = event.currentTarget as HTMLElement;
    const index = this.knobIndex(event);

    if (index === null) {
      return;
    }

    this.focusVisible = knob.matches(':focus-visible');
    this.active       = index;

    this.requestFrame();
  }

  blurKnob (): void {
    this.focusVisible = false;

    this.requestFrame();
  }

  override frame (dt: number): boolean {
    const thumbs = this.thumbs;

    if (!thumbs) {
      return false;
    }

    // Resolve the theme tokens at paint time so a mode flip recolors live
    const ctx    = this.ctx;
    const cx     = this.cssW / 2;
    const cy     = this.cssH / 2;
    const tW     = this.trackW;
    const trackH = this.trackH || this.sizeConfig.track;
    const track  = this.resolveColor(`var(--jelly-track, var(--droplet-track, ${PALETTE['background-neutral']}))`);
    const accent = this.resolveColor(`var(--jelly-accent, var(--droplet-accent, ${PALETTE['background-accent']}))`);

    let settled = true;

    for (const i of [0, 1] as const) {
      // Reduced motion snaps each knob straight to its value instead of gliding
      if (this.reducedMotion) {
        this.x[i]         = this.target[i];
        this.xVelocity[i] = 0;
      } else {
        [this.x[i], this.xVelocity[i]] = integrateSpring(this.x[i], this.xVelocity[i], this.target[i], 310, 22, dt);
      }

      const speed = Math.abs(this.xVelocity[i]);

      if (speed > 6) {
        thumbs[i].lean = Math.sign(this.xVelocity[i]);
      }

      thumbs[i].leanAmount = this.reducedMotion ? 0 : Math.min(thumbs[i].height * 0.12, speed * 0.0045);
      thumbs[i].update(dt);

      if (Math.abs(this.target[i] - this.x[i]) > 0.2 || Math.abs(this.xVelocity[i]) > 0.5 || !thumbs[i].isResting()) {
        settled = false;
      }
    }

    this.clearCanvas();

    // The accent fill spans the interval between both physical thumb
    // positions, so RTL mirrors for free
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(cx - tW / 2, cy - trackH / 2, tW, trackH, trackH / 2);
    ctx.fillStyle = track;
    ctx.fill();
    ctx.clip();

    const xa = cx + this.x[0];
    const xb = cx + this.x[1];

    ctx.fillStyle = accent;
    ctx.fillRect(Math.min(xa, xb), cy - trackH / 2, Math.abs(xb - xa), trackH);
    ctx.restore();

    for (const i of [0, 1] as const) {
      const speed       = Math.abs(this.xVelocity[i]);
      const drive       = this.reducedMotion ? 0 : Math.min(1, speed / 550);
      const pressTarget = this.drag === i && !this.reducedMotion ? 1.12 : 1;
      const pressAccel  = (pressTarget - this.pressScale[i]) * 420 - this.pressScaleVelocity[i] * 28;

      this.pressScaleVelocity[i] += pressAccel * dt;
      this.pressScale[i]         += this.pressScaleVelocity[i] * dt;

      const travelStretchX = 1 + drive * 0.32;
      const stretchX       = travelStretchX * this.pressScale[i];
      const stretchY       = (1 / Math.sqrt(travelStretchX)) * this.pressScale[i];

      // The focus ring is painted from the thumb's own deformed surface so it
      // stays in lockstep with the wobble and travel
      this.paintBody(thumbs[i], {
        fill:    accent,
        cx:      this.x[i],
        scaleX:  stretchX,
        scaleY:  stretchY,
        easeKey: `thumb${i}`,
        ring:    this.active === i ? this.focusRing() : null,
      });

      if (Math.abs(this.pressScale[i] - 1) > 0.001 || Math.abs(this.pressScaleVelocity[i]) > 0.001) {
        settled = false;
      }
    }

    return !settled || this.drag != null;
  }

  attributeChangedCallback (name: string): void {
    if (this.axisAttributeChanged(name)) {
      return;
    }

    if (name === 'size') {
      canonicalizeSize(this);
    }

    if (this.knobs) {
      this.sync(name);
    }
  }

  sync (name: string): void {
    switch (name) {
      case 'low':
        this.val[0] = numberAttribute(this, 'low', this.min);
        this.syncValueState();
        break;

      case 'high':
        this.val[1] = numberAttribute(this, 'high', this.max);
        this.syncValueState();
        break;

      case 'min':
      case 'max':
      case 'step':
        this.syncValueState();
        break;

      case 'label':
      case 'disabled':
        this.syncA11y();
        break;

      case 'size':
        this.applyShape();
        break;
    }
  }

  get value (): string {
    return this.val.join(',');
  }

  // Route programmatic host focus into the active knob
  override focus (options?: FocusOptions): void {
    this.knobs?.[this.active]?.focus(options);
  }

}

export function defineRange (options: DefineOptions = {}): DefineResult {
  return defineStrict([[TAGS.range, DropletRange]], options);
}

declare global {
  interface HTMLElementTagNameMap {
    'droplet-range': DropletRange;
  }
}
