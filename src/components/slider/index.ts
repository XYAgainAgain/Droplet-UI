// A hidden native range input owns the value and the accessibility semantics

import { DropletElement }         from '../../element/index.js';
import { FORM_ATTRIBUTES }    from '../../element/form-control.js';
import { FormControl }        from '../../element/form-control.js';
import type { RestoreState }  from '../../element/form-control.js';
import type { PainterFrame }    from '../../element/index.js';
import type { Shape }           from '../../element/index.js';

import { buildFrame }           from '../../element/painter.js';

import { defineStrict }         from '../../registry/index.js';
import { LOG_PREFIX, TAGS }     from '../../registry/index.js';
import type { DefineOptions }   from '../../registry/index.js';
import type { DefineResult }    from '../../registry/index.js';

import type { Resolved }        from '../../resolve/index.js';

import { DropletBody }        from '../../core/index.js';
import type { DropletConfig } from '../../core/index.js';

import { canonicalizeSize } from '../../utilities/index.js';
import { clamp }            from '../../utilities/index.js';
import { emit }             from '../../utilities/index.js';
import { horizontalStep }   from '../../utilities/index.js';
import { isRTL }            from '../../utilities/index.js';
import type { Size }        from '../../utilities/index.js';
import { triggerHaptic }    from '../../utilities/index.js';
import { integrateSpring }  from '../../utilities/index.js';

import { PALETTE }          from '../../theme/index.js';
import { variantColors }    from '../../theme/index.js';

import sliderStyles         from './slider.css?inline';

interface SliderSize {
  width: number;
  height: number;
  thumb: number;
  track: number;
}

// px, mirroring slider.css
const SLIDER_SIZES: Record<Size, SliderSize> = {
  small:  { width: 200, height: 30, thumb: 24, track: 9 },
  medium: { width: 240, height: 36, thumb: 28, track: 12 },
  large:  { width: 300, height: 44, thumb: 34, track: 14 },
};

// Resolved through the same feel and quality axes as the track
export const THUMB_CONFIG: Partial<DropletConfig> = {
  membraneSpring:          82,
  membraneDamping:         14,
  waveCoupling:            170,
  pressure:                700,
  volumeCorrection:        0.14,
  insideLocalBulgeImpulse: 330,
  rippleWidth:             10,
};

/**
 * A single-value range slider with a squishy soft-body thumb.
 *
 * @element droplet-slider
 *
 * @attr {number} value - Current value (defaults to 50).
 * @attr {number} min - Minimum value (defaults to 0).
 * @attr {number} max - Maximum value (defaults to 100).
 * @attr {number} step - Step increment (defaults to 1).
 * @attr {string} label - Accessible name for the control.
 * @attr {string} name - Form field name submitted with the value.
 * @attr {boolean} disabled - Disable the control and remove it from the tab order.
 * @attr {"small"|"medium"|"large"} size - Control size.
 * @attr {string} origin - Where the accent fill starts: "start" (default), "center", "end", or a value between min and max.
 * @attr {"white"|"rose"|"amber"|"azure"|"mint"|"platinum"|"graphite"} variant - Accent fill hue.
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
 * @fires input - Continuously as the value changes (drag/arrow keys).
 * @fires change - When the value is committed.
 *
 * @csspart wrap - The positioning wrapper.
 * @csspart track - The track drag surface.
 * @csspart input - The visually-hidden native range input.
 *
 * @cssprop [--droplet-accent] - Filled-track and thumb color.
 * @cssprop [--droplet-track] - Empty-track color.
 * @cssprop [--droplet-slider-width] - Host width, inherited from any ancestor; defaults to 200/240/300px by size.
 */
export class DropletSlider extends FormControl(DropletElement) implements EventListenerObject {

  static formAssociated = true;

  static override usesResolver = true;

  static override textOnFill = false;

  // Pre-upgrade writes survive to the first build
  static override REPLAYED: readonly string[] = ['value', 'origin', ...DropletElement.REPLAYED];

  override internals: ElementInternals;

  input!: HTMLInputElement;
  track!: HTMLElement;
  thumbBody: DropletBody | null = null;

  thumbRecord: Resolved | undefined = undefined;

  // The last-set value, so a write before build survives
  storedValue: string | null = null;

  // Last committed value, so a no-op commit stays silent
  committedValue: string | null = null;

  thumbX = 0;
  thumbXVelocity = 0;
  thumbTarget = 0;
  dragging = false;
  pointerId: number | null = null;
  statePointerId: number | null = null;

  // Separate from the surface flag, so one failing painter spares the other
  trackPainterFailed = false;
  pressScale = 1;
  pressScaleVelocity = 0;
  trackW = 0;
  trackH = 0;

  static get observedAttributes (): string[] {
    return ['value', 'min', 'max', 'step', 'label', 'disabled', 'size', 'origin', ...DropletElement.AXIS_ATTRIBUTES, ...FORM_ATTRIBUTES];
  }

  constructor () {
    super();

    // attachInternals() throws on a second call
    this.internals = this.attachInternals();
  }

  static define (options?: DefineOptions): DefineResult {
    return defineSlider(options);
  }

  get thumbConfig (): Readonly<DropletConfig> {
    return (this.thumbRecord ?? this.resolveThumb()).config;
  }

  // Re-resolve the thumb too, so it never keeps a stale record
  override resolve (): Resolved {
    const resolved = super.resolve();

    this.resolveThumb();

    return resolved;
  }

  resolveThumb (): Resolved {
    const resolved = this.resolveFor(THUMB_CONFIG);

    this.thumbRecord = resolved;
    this.applyResolved(resolved, this.thumbBody);

    return resolved;
  }

  override styles (): string {
    return sliderStyles + variantColors({ color: '--droplet-accent' });
  }

  override content (): string {
    return `
      <div class="wrap" part="wrap">
        <input type="range" part="input" />
        <span class="track" part="track" data-droplet-box aria-hidden="true"></span>
      </div>`;
  }

  // The base body is the track capsule; the thumb rides on top
  override shape (width: number, height: number): Shape {
    const trackH = height || this.sizeConfig.track;

    return { width, height: trackH, radius: trackH / 2 };
  }

  get sizeKey (): Size {
    const size = (this.getAttribute('size') || 'medium').toLowerCase();

    return size === 'small' || size === 'large' ? size : 'medium';
  }

  get sizeConfig (): SliderSize {
    return SLIDER_SIZES[this.sizeKey];
  }

  override onBuilt (): void {
    this.input = this.shadowRoot!.querySelector('input')!;
    this.track = this.shadowRoot!.querySelector('.track')!;

    this.input.min      = this.getAttribute('min') ?? '0';
    this.input.max      = this.getAttribute('max') ?? '100';
    this.input.step     = this.getAttribute('step') ?? '1';
    this.input.value    = this.getAttribute('value') ?? this.storedValue ?? '50';
    this.committedValue = this.input.value;
    this.input.disabled = this.hasAttribute('disabled');

    this.syncLabel();
    this.syncA11y();
    this.internals.setFormValue(this.input.value);

    this.trackFocus(this.input);

    this.input.addEventListener('input',   this);
    this.input.addEventListener('change',  this);
    this.input.addEventListener('keydown', this);

    this.track.addEventListener('pointerdown',   this);
    this.track.addEventListener('pointermove',   this);
    this.track.addEventListener('pointerup',     this);
    this.track.addEventListener('pointercancel', this);

    this.trackDraggingState();
  }

  handleEvent (event: Event): void {
    switch (event.type) {
      case 'input':         this.onNativeInput(event);           break;
      case 'change':        this.onNativeChange(event);          break;
      case 'keydown':       this.onKey(event as KeyboardEvent);  break;
      case 'pointerdown':   this.onDown(event as PointerEvent);  break;
      case 'pointermove':   this.onMove(event as PointerEvent);  break;
      case 'pointerup':
      case 'pointercancel': this.onUp(event as PointerEvent);    break;
    }
  }

  // Stop the hidden input's composed events and re-emit one of each
  onNativeInput (event: Event): void {
    event.stopPropagation();

    this.updateFromInput();
    emit(this, 'input');
  }

  // Firefox fires change for a Page key at a bound; an unchanged commit stays silent
  onNativeChange (event: Event): void {
    event.stopPropagation();

    if (this.input.value === this.committedValue) {
      return;
    }

    this.committedValue = this.input.value;
    emit(this, 'change');
  }

  // Capture retargets the drag, so every ending arrives at the host
  trackDraggingState (): void {
    const clear = (event: PointerEvent): void => {
      if (event.pointerId === this.statePointerId) {
        this.clearDragging();
      }
    };

    this.addEventListener('pointerup', clear);
    this.addEventListener('pointercancel', clear);
    this.addEventListener('lostpointercapture', clear);
  }

  clearDragging (): void {
    this.dragging       = false;
    this.pointerId      = null;
    this.statePointerId = null;
    this.internals.states.delete('dragging');
  }

  override onShape (): void {
    this.trackW = this.body ? this.body.width : this.getBoundingClientRect().width;
    this.trackH = this.body ? this.body.height : this.sizeConfig.track;

    const thumb = this.sizeConfig.thumb;

    if (!this.thumbBody) {
      // Born with its record, so the first shape never rebuilds it
      const record = this.thumbRecord ?? this.resolveThumb();

      this.thumbBody = new DropletBody({ width: thumb, height: thumb, radius: thumb / 2, config: { ...record.config } });
      this.seedResolved(this.thumbBody, record);
    } else {
      this.thumbBody.resize(thumb, thumb, thumb / 2);
    }

    this.thumbTarget    = this.valueToX();
    this.thumbX         = this.thumbTarget;
    this.thumbXVelocity = 0;
  }

  // px
  get travel (): number {
    return Math.max(0, this.trackW - this.sizeConfig.thumb);
  }

  fraction (value = this.input.valueAsNumber): number {
    const min  = +this.input.min;
    const max  = +this.input.max;
    const span = max - min || 1;

    return (value - min) / span;
  }

  // Physical canvas x, mirrored in RTL
  valueToX (): number {
    return this.fractionToX(this.fraction());
  }

  fractionToX (fraction: number): number {
    const x = -this.travel / 2 + fraction * this.travel;

    return isRTL(this) ? -x : x;
  }

  // The fill anchor, in thumbX space
  originX (): number {
    const edge   = isRTL(this) ? this.trackW / 2 : -this.trackW / 2;
    const origin = this.origin;

    if (origin === 'start') return edge;
    if (origin === 'end')   return -edge;
    if (origin === 'center') return 0;

    // A collapsed span pins the native value to min, so the origin follows
    const span = +this.input.max - +this.input.min;

    return this.fractionToX(span > 0 ? clamp(this.fraction(Number(origin)), 0, 1) : 0);
  }

  updateFromInput (): void {
    this.thumbTarget = this.valueToX();

    this.syncA11y();
    this.internals.setFormValue(this.input.value);
    this.requestFrame();
  }

  syncLabel (): void {
    const label = this.getAttribute('label');

    if (label) {
      this.input.setAttribute('aria-label', label);
    } else {
      this.input.removeAttribute('aria-label');
    }
  }

  syncA11y (): void {
    const disabled = this.isDisabled;

    this.input.tabIndex = disabled ? -1 : 0;
    this.removeAttribute('tabindex');

    this.input.setAttribute('aria-valuemin', this.input.min);
    this.input.setAttribute('aria-valuemax', this.input.max);
    this.input.setAttribute('aria-valuenow', this.input.value);
    this.input.setAttribute('aria-disabled', String(disabled));
  }

  setFromClientX (clientX: number): void {
    const local = this.toLocal(clientX, 0);
    const half  = this.travel / 2 || 1;

    let fraction = clamp((local.x + half) / (half * 2), 0, 1);

    if (isRTL(this)) {
      fraction = 1 - fraction;
    }

    const min = +this.input.min;
    const max = +this.input.max;

    this.input.value = String(min + fraction * (max - min));

    this.updateFromInput();
    emit(this, 'input');
  }

  setFromStep (direction: number, multiplier = 1): void {
    const min        = +this.input.min || 0;
    const max        = +this.input.max || 100;
    const span       = max - min || 1;
    const parsedStep = parseFloat(this.input.step);
    const step       = Number.isFinite(parsedStep) && parsedStep > 0 ? parsedStep : span / 100;
    const current    = Number.isFinite(this.input.valueAsNumber) ? this.input.valueAsNumber : min;
    const next       = clamp(current + direction * step * multiplier, min, max);

    this.input.value = String(Number(next.toFixed(10)));

    this.updateFromInput();
    emit(this, 'input');
  }

  onKey (event: KeyboardEvent): void {
    let direction = horizontalStep(event.key, isRTL(this));

    if (direction === 0 && event.key === 'ArrowUp')   direction = 1;
    if (direction === 0 && event.key === 'ArrowDown') direction = -1;

    if (direction !== 0) {
      event.preventDefault();
      this.setFromStep(direction, event.shiftKey ? 10 : 1);
      emit(this, 'change');
      return;
    }

    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      this.input.value = event.key === 'Home' ? this.input.min : this.input.max;
      this.updateFromInput();
      emit(this, 'input');
      emit(this, 'change');
    }
  }

  onDown (event: PointerEvent): void {
    // One pointer at a time, like the base press wiring
    if (this.isDisabled || this.pointerId !== null) {
      return;
    }

    this.dragging       = true;
    this.pointerId      = event.pointerId;
    this.statePointerId = event.pointerId;

    this.internals.states.add('dragging');

    try {
      this.track.setPointerCapture(event.pointerId);
    } catch {
      // Pointer already gone
    }

    this.setFromClientX(event.clientX);

    if (!this.reducedMotion && this.thumbBody) {
      this.thumbBody.centerPop(1);
    }

    triggerHaptic();
  }

  onMove (event: PointerEvent): void {
    if (!this.dragging || this.pointerId !== event.pointerId) {
      return;
    }

    this.setFromClientX(event.clientX);
  }

  onUp (event: PointerEvent): void {
    if (this.pointerId !== event.pointerId) {
      return;
    }

    this.clearDragging();

    try {
      this.track.releasePointerCapture(event.pointerId);
    } catch {
      // Capture already gone
    }

    this.thumbBody?.release();
    this.requestFrame();
    emit(this, 'change');
  }

  override frame (dt: number): boolean {
    const thumb = this.thumbBody;

    if (!thumb) {
      return false;
    }

    if (this.reducedMotion) {
      this.thumbX         = this.thumbTarget;
      this.thumbXVelocity = 0;
    } else {
      [this.thumbX, this.thumbXVelocity] = integrateSpring(this.thumbX, this.thumbXVelocity, this.thumbTarget, 310, 22, dt);
    }

    // Keep the stretch symmetric; an uneven one forms a pointy tail
    const speed = Math.abs(this.thumbXVelocity);

    if (speed > 6) {
      thumb.lean = Math.sign(this.thumbXVelocity);
    }

    const drive = this.reducedMotion ? 0 : Math.min(1, speed / 550);

    thumb.leanAmount = this.reducedMotion ? 0 : Math.min(thumb.height * 0.12, speed * 0.0045);

    const pressTarget = this.dragging && !this.reducedMotion ? 1.12 : 1;
    const pressAccel  = (pressTarget - this.pressScale) * 420 - this.pressScaleVelocity * 28;

    this.pressScaleVelocity += pressAccel * dt;
    this.pressScale         += this.pressScaleVelocity * dt;

    const stretchX = (1 + drive * 0.32) * this.pressScale;
    const stretchY = (1 / Math.sqrt(1 + drive * 0.32)) * this.pressScale;

    thumb.update(dt);

    const accent = this.resolveColor(`var(--jelly-accent, var(--droplet-accent, ${PALETTE['background-accent']}))`);

    this.clearCanvas();
    this.paintTrackPass();

    this.paintBody(thumb, {
      fill:   accent,
      cx:     this.thumbX,
      scaleX: stretchX,
      scaleY: stretchY,
      ring:   this.focusRing(),
    });

    const settled =
      thumb.isResting() &&
      Math.abs(this.thumbTarget - this.thumbX) < 0.2 &&
      Math.abs(this.thumbXVelocity) < 0.5 &&
      Math.abs(this.pressScale - 1) < 0.001 &&
      Math.abs(this.pressScaleVelocity) < 0.001;

    return !settled || this.dragging;
  }

  // A throwing paintTrack is caught and disables only the track painter
  paintTrackPass (ctx: CanvasRenderingContext2D = this.ctx): void {
    const body = this.body;

    if (!this.canPaint || !body || this.trackPainterFailed) {
      return;
    }

    const cx = this.cssW / 2;
    const cy = this.cssH / 2;

    // The shipped paintTrack ignores points, so only an override pays for them
    const custom = this.paintTrack !== DropletSlider.prototype.paintTrack;

    // Canvas space, so frame.path lands on the track
    const points = custom ? body.getSurfacePoints().map((point) => {
      const projected = body.projectPoint(point);

      return { ...projected, x: projected.x + cx, y: projected.y + cy };
    }) : [];

    const frame = buildFrame({
      ctx,
      points,
      resting: body.isResting(),
      dpr:     this.dpr,
      width:   this.cssW,
      height:  this.cssH,
    });

    ctx.save();

    try {
      this.paintTrack(frame);
    } catch (error) {
      this.trackPainterFailed = true;
      console.error(`${LOG_PREFIX} painter error`, error);
    } finally {
      ctx.restore();
    }

    if (this.trackPainterFailed) {
      return;
    }

    const trackH = this.trackH || this.sizeConfig.track;

    this.shadeTrack(ctx, cx - this.trackW / 2, cy - trackH / 2, this.trackW, trackH, this.trackColor(), (target) => {
      if (this.trackPainterFailed) return;

      target.save();

      try {
        this.paintTrack(Object.freeze({ ...frame, ctx: target }));
      } catch (error) {
        this.trackPainterFailed = true;
        console.error(`${LOG_PREFIX} painter error`, error);
      } finally {
        target.restore();
      }
    });
  }

  trackColor (): string {
    return this.resolveColor(`var(--jelly-track, var(--droplet-track, ${PALETTE['background-neutral']}))`);
  }

  // Overridable painter slot; ctx is canvas space
  paintTrack (frame: PainterFrame): void {
    const ctx    = frame.ctx;
    const cx     = frame.width / 2;
    const cy     = frame.height / 2;
    const tW     = this.trackW;
    const trackH = this.trackH || this.sizeConfig.track;
    const track  = this.trackColor();
    const accent = this.resolveColor(`var(--jelly-accent, var(--droplet-accent, ${PALETTE['background-accent']}))`);

    ctx.beginPath();
    ctx.roundRect(cx - tW / 2, cy - trackH / 2, tW, trackH, trackH / 2);
    ctx.fillStyle = track;
    ctx.fill();
    ctx.clip();
    ctx.fillStyle = accent;

    const from  = this.originX();
    const left  = Math.min(from, this.thumbX);
    const right = Math.max(from, this.thumbX);

    ctx.fillRect(cx + left, cy - trackH / 2, right - left, trackH);
  }

  attributeChangedCallback (name: string): void {
    if (this.axisAttributeChanged(name) || this.formAttributeChanged(name)) {
      return;
    }

    if (name === 'size') {
      canonicalizeSize(this);
    }

    if (this.input) {
      this.sync(name, this.getAttribute(name));
    }
  }

  sync (name: string, value: string | null): void {
    switch (name) {
      case 'value':
        this.storedValue = value ?? '50';
        this.input.value = this.storedValue;
        break;

      case 'min':
        this.input.min = value ?? '0';
        break;

      case 'max':
        this.input.max = value ?? '100';
        break;

      case 'step':
        this.input.step = value ?? '1';
        break;

      case 'label':
        this.syncLabel();
        break;

      case 'disabled':
        this.syncDisabled();
        break;

      case 'size':
        this.applyShape();
        break;

      case 'origin':
        this.requestFrame();
        break;
    }

    this.updateFromInput();
  }

  get value (): string {
    return this.input ? this.input.value : this.getAttribute('value') || this.storedValue || '50';
  }

  set value (v: string) {
    this.storedValue = String(v);

    if (this.input) {
      this.input.value = this.storedValue;
      this.updateFromInput();
    }
  }

  get origin (): string {
    const raw = (this.getAttribute('origin') ?? '').trim().toLowerCase();

    if (raw === 'center' || raw === 'end') {
      return raw;
    }

    return raw !== '' && Number.isFinite(Number(raw)) ? String(Number(raw)) : 'start';
  }

  set origin (value: string | number | null) {
    if (value === null || value === undefined) {
      this.removeAttribute('origin');
    } else {
      this.setAttribute('origin', String(value));
    }
  }

  override focus (options?: FocusOptions): void {
    this.input?.focus(options);
  }

  override formAnchor (): HTMLElement | null {
    return this.input ?? null;
  }

  // The value attribute is the authored default
  override formReset (): void {
    this.value = this.getAttribute('value') ?? '50';
  }

  override formRestore (state: RestoreState): void {
    if (typeof state === 'string') {
      this.value = state;
    }
  }

  override syncDisabled (): void {
    if (!this.input) {
      return;
    }

    this.input.disabled = this.isDisabled;
    this.syncA11y();
  }

  // A reconnect retries a failed painter; the base resets only the surface flag
  override connectedCallback (): void {
    this.trackPainterFailed = false;

    super.connectedCallback();
  }

  override disconnectedCallback (): void {
    super.disconnectedCallback();

    this.clearDragging();
  }

}

export function defineSlider (options: DefineOptions = {}): DefineResult {
  return defineStrict([[TAGS.slider, DropletSlider]], options);
}

declare global {
  interface HTMLElementTagNameMap {
    'droplet-slider': DropletSlider;
  }
}
