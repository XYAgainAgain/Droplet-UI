/*
 * A single-value range slider whose thumb is a squishy jelly body. A hidden
 * native <input type="range"> owns the value, form participation and
 * assistive-technology semantics, while the accent-tinted thumb squishes
 * when grabbed, leans into its travel and shows a soft focus ring on
 * keyboard focus. Direction-aware: in RTL layouts the value origin, the
 * painted accent fill and the arrow keys all mirror like a native range input
 */

import { JellyElement }         from '../../element/index.js';
import type { PainterFrame }    from '../../element/index.js';
import type { Shape }           from '../../element/index.js';

import { buildFrame }           from '../../element/painter.js';
import { canonicalizeQualityAttribute } from '../../element/configure.js';

import { defineElements }       from '../../registry/index.js';
import { TAGS }                 from '../../registry/index.js';
import type { DefineOptions }   from '../../registry/index.js';
import type { DefineResult }    from '../../registry/index.js';

import type { Resolved }        from '../../resolve/index.js';

import { JellyBody }        from '../../core/index.js';
import type { JellyConfig } from '../../core/index.js';

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

// Host geometry per size: footprint, thumb diameter, track height
const SLIDER_SIZES: Record<Size, SliderSize> = {
  small:  { width: 200, height: 30, thumb: 24, track: 9 },
  medium: { width: 240, height: 36, thumb: 28, track: 12 },
  large:  { width: 300, height: 44, thumb: 34, track: 14 },
};

// The thumb body's component profile: a small, tight drop that stays lively
// under drag. Resolved through the same feel / quality axes as the track.
export const THUMB_CONFIG: Partial<JellyConfig> = {
  membraneSpring:          82,
  membraneDamping:         14,
  waveCoupling:            170,
  pressure:                700,
  volumeCorrection:        0.14,
  insideLocalBulgeImpulse: 330,
  rippleWidth:             10,
};

/**
 * A single-value range slider with a squishy jelly thumb.
 *
 * @element jelly-slider
 *
 * @attr {number} value - Current value (defaults to 50).
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
 * @fires input - Continuously as the value changes (drag / arrow keys).
 * @fires change - When the value is committed.
 *
 * @csspart wrap - The positioning wrapper.
 * @csspart track - The track drag surface.
 * @csspart input - The visually-hidden native range input.
 *
 * @cssprop [--jelly-accent] - Filled-track and thumb color.
 * @cssprop [--jelly-track] - Empty-track color.
 */
export class JellySlider extends JellyElement implements EventListenerObject {

  // Participate in native form submission through ElementInternals
  static formAssociated = true;

  // Opt in to the base class's feel / quality / resolver half
  static override usesResolver = true;

  // A value assigned before upgrade has to survive to the first build
  static override REPLAYED: readonly string[] = ['value', 'feel', 'quality'];

  internals: ElementInternals;

  // Populated in onBuilt() / onShape()
  input!: HTMLInputElement;
  track!: HTMLElement;
  thumbBody: JellyBody | null = null;

  thumbRecord: Resolved | undefined = undefined;

  // The value as last set, so a write before build is not lost (Sol M12)
  storedValue: string | null = null;

  // The value at the last committed change, so a no-op commit stays silent
  committedValue: string | null = null;

  thumbX = 0;
  thumbXVelocity = 0;
  thumbTarget = 0;
  dragging = false;
  pointerId: number | null = null;
  statePointerId: number | null = null;

  // The track pass owns its own failure flag: a thrown paintSurface must not
  // take the track down with it (painter.md isolation)
  trackPainterFailed = false;
  pressScale = 1;
  pressScaleVelocity = 0;
  trackW = 0;
  trackH = 0;

  // Tells the browser to trigger attributeChangedCallback when these attributes change
  static get observedAttributes (): string[] {
    return ['value', 'min', 'max', 'step', 'label', 'disabled', 'size', 'feel', 'quality'];
  }

  constructor () {
    super();

    // Once, in the constructor: attachInternals() throws on a second call
    this.internals = this.attachInternals();
  }

  static define (options?: DefineOptions): DefineResult {
    return defineSlider(options);
  }

  // The thumb's resolved physics record, on its own track from the main body
  get thumbConfig (): Readonly<JellyConfig> {
    return (this.thumbRecord ?? this.resolveThumb()).config;
  }

  // Both membranes re-resolve together, so a scope, attribute or config change
  // can never leave the thumb on a stale record
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

  // Component styles layered over the shared jelly base styles
  override styles (): string {
    return sliderStyles + variantColors({ color: '--jelly-accent' });
  }

  // The interactive markup that sits above the canvas
  override content (): string {
    return `
      <div class="wrap" part="wrap">
        <input type="range" part="input" />
        <span class="track" part="track" data-jelly-box aria-hidden="true"></span>
      </div>`;
  }

  // The base jelly body is the track capsule; the thumb body rides on top
  override shape (width: number, height: number): Shape {
    const trackH = height || this.sizeConfig.track;

    return { width, height: trackH, radius: trackH / 2 };
  }

  // The canonical size name, defaulting to medium
  get sizeKey (): Size {
    const size = (this.getAttribute('size') || 'medium').toLowerCase();

    return size === 'small' || size === 'large' ? size : 'medium';
  }

  // The geometry record for the current size
  get sizeConfig (): SliderSize {
    return SLIDER_SIZES[this.sizeKey];
  }

  // Called once after the shadow DOM and canvas exist. Wire events here.
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

  // Route the inner-control events registered with `this` as the listener
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

  // The hidden input's own composed events would surface beside ours, so stop
  // them at the boundary and re-emit one of each (state-and-reflection.md)
  onNativeInput (event: Event): void {
    event.stopPropagation();

    this.updateFromInput();
    emit(this, 'input');
  }

  // Firefox's range fires change for a Page key at a bound even though nothing
  // moved; a commit that changed nothing is not a change (state-and-reflection.md)
  onNativeChange (event: Event): void {
    event.stopPropagation();

    if (this.input.value === this.committedValue) {
      return;
    }

    this.committedValue = this.input.value;
    emit(this, 'change');
  }

  // Pointer capture retargets the rest of the drag, so the state clears from
  // the host, where every ending path still arrives (state-and-reflection.md)
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

  // Every ending path lands here, including the ones with no pointerup at all,
  // so the drag flags clear where the visual state does (state-and-reflection.md)
  clearDragging (): void {
    this.dragging       = false;
    this.pointerId      = null;
    this.statePointerId = null;
    this.internals.states.delete('dragging');
  }

  // Rebuild the thumb body whenever the track shape (re)builds
  override onShape (): void {
    this.trackW = this.body ? this.body.width : this.getBoundingClientRect().width;
    this.trackH = this.body ? this.body.height : this.sizeConfig.track;

    const thumb = this.sizeConfig.thumb;

    if (!this.thumbBody) {
      // Born with its resolved record, so the first shape never rebuilds it
      const record = this.thumbRecord ?? this.resolveThumb();

      this.thumbBody = new JellyBody({ width: thumb, height: thumb, radius: thumb / 2, config: { ...record.config } });
      this.seedResolved(this.thumbBody, record);
    } else {
      this.thumbBody.resize(thumb, thumb, thumb / 2);
    }

    this.thumbTarget    = this.valueToX();
    this.thumbX         = this.thumbTarget;
    this.thumbXVelocity = 0;
  }

  // How far the thumb center can travel along the track, in pixels
  get travel (): number {
    return Math.max(0, this.trackW - this.sizeConfig.thumb);
  }

  // The current value as a 0..1 fraction of the min → max span
  fraction (): number {
    const min  = +this.input.min;
    const max  = +this.input.max;
    const span = max - min || 1;

    return (this.input.valueAsNumber - min) / span;
  }

  // The thumb's physical canvas x for the current value - mirrored in RTL,
  // where the value origin sits at the right edge
  valueToX (): number {
    const x = -this.travel / 2 + this.fraction() * this.travel;

    return isRTL(this) ? -x : x;
  }

  // Reflect the input's value into the thumb target, ARIA and the form
  updateFromInput (): void {
    this.thumbTarget = this.valueToX();

    this.syncA11y();
    this.internals.setFormValue(this.input.value);
    this.requestFrame();
  }

  // Map the label attribute onto the hidden input's accessible name
  syncLabel (): void {
    const label = this.getAttribute('label');

    if (label) {
      this.input.setAttribute('aria-label', label);
    } else {
      this.input.removeAttribute('aria-label');
    }
  }

  // Keep the hidden input's tab order and ARIA value state in sync
  syncA11y (): void {
    const disabled = this.hasAttribute('disabled');

    this.input.tabIndex = disabled ? -1 : 0;
    this.removeAttribute('tabindex');

    this.input.setAttribute('aria-valuemin', this.input.min);
    this.input.setAttribute('aria-valuemax', this.input.max);
    this.input.setAttribute('aria-valuenow', this.input.value);
    this.input.setAttribute('aria-disabled', String(disabled));
  }

  // Set the value from a pointer position, honoring reading direction
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

  // Step the value by direction × step (× the Shift multiplier), clamped
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

  // Keyboard stepping: arrows follow reading direction, Shift ×10, Home / End jump
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

  // Begin a drag on the track: capture the pointer and jump to the press point
  onDown (event: PointerEvent): void {
    // One pointer at a time, like the base class's press wiring: a second
    // finger must not steal the membrane mid-drag
    if (this.hasAttribute('disabled') || this.pointerId !== null) {
      return;
    }

    this.dragging       = true;
    this.pointerId      = event.pointerId;
    this.statePointerId = event.pointerId;

    this.internals.states.add('dragging');

    try {
      this.track.setPointerCapture(event.pointerId);
    } catch {
      // Capture can fail if the pointer is already gone; the drag still works
    }

    this.setFromClientX(event.clientX);

    if (!this.reducedMotion && this.thumbBody) {
      this.thumbBody.centerPop(1);
    }

    triggerHaptic();
  }

  // Follow the captured pointer while a drag is active
  onMove (event: PointerEvent): void {
    if (!this.dragging || this.pointerId !== event.pointerId) {
      return;
    }

    this.setFromClientX(event.clientX);
  }

  // End the drag: release capture, let the thumb settle, commit the change
  onUp (event: PointerEvent): void {
    if (this.pointerId !== event.pointerId) {
      return;
    }

    this.clearDragging();

    try {
      this.track.releasePointerCapture(event.pointerId);
    } catch {
      // The capture may already be gone; releasing is best-effort
    }

    this.thumbBody?.release();
    this.requestFrame();
    emit(this, 'change');
  }

  // One animation step: advance the travel spring, repaint track, fill and thumb
  override frame (dt: number): boolean {
    const thumb = this.thumbBody;

    if (!thumb) {
      return false;
    }

    // Soft travel spring: enough follow-through to feel alive, without snapping.
    // Reduced motion snaps the thumb straight to its value instead.
    if (this.reducedMotion) {
      this.thumbX         = this.thumbTarget;
      this.thumbXVelocity = 0;
    } else {
      [this.thumbX, this.thumbXVelocity] = integrateSpring(this.thumbX, this.thumbXVelocity, this.thumbTarget, 310, 22, dt);
    }

    // Shape the thumb into a soft, even stretch as it travels. Keep this
    // symmetric so dragging feels like jello instead of forming a pointy tail.
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

    // Resolve the theme token at paint time so a mode flip recolors live
    const accent = this.resolveColor(`var(--jelly-accent, ${PALETTE['background-accent']})`);

    this.clearCanvas();
    this.paintTrackPass();

    // The focus ring is painted from the same deformed surface as the thumb,
    // so it wobbles and travels in perfect lockstep with it - the shared soft
    // accent halo every other component shows on keyboard focus.
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

  // Isolated exactly like paintSurface: a built frame, save/restore, and one
  // console.error that disables a painter which would corrupt the thumb
  paintTrackPass (ctx: CanvasRenderingContext2D = this.ctx): void {
    const body = this.body;

    if (!this.canPaint || !body || this.trackPainterFailed) {
      return;
    }

    const cx = this.cssW / 2;
    const cy = this.cssH / 2;

    // The shipped paintTrack reads only width / height, so projecting and
    // tracing every surface point is wasted work unless the slot is overridden
    const custom = this.paintTrack !== JellySlider.prototype.paintTrack;

    // Canvas-space points, so a painter drawing frame.path lands on the track
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
      console.error('Jelly UI painter error', error);
    } finally {
      ctx.restore();
    }
  }

  // Track base, then the accent fill from the value origin (the inline-start
  // edge, so the right one in RTL). Phase 6 slot preview; ctx is canvas space.
  paintTrack (frame: PainterFrame): void {
    const ctx    = frame.ctx;
    const cx     = frame.width / 2;
    const cy     = frame.height / 2;
    const tW     = this.trackW;
    const trackH = this.trackH || this.sizeConfig.track;
    const track  = this.resolveColor(`var(--jelly-track, ${PALETTE['background-neutral']})`);
    const accent = this.resolveColor(`var(--jelly-accent, ${PALETTE['background-accent']})`);

    ctx.beginPath();
    ctx.roundRect(cx - tW / 2, cy - trackH / 2, tW, trackH, trackH / 2);
    ctx.fillStyle = track;
    ctx.fill();
    ctx.clip();
    ctx.fillStyle = accent;

    if (isRTL(this)) {
      ctx.fillRect(cx + this.thumbX, cy - trackH / 2, tW / 2 - this.thumbX, trackH);
    } else {
      ctx.fillRect(cx - tW / 2, cy - trackH / 2, this.thumbX + tW / 2, trackH);
    }
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

    if (name === 'size') {
      canonicalizeSize(this);
    }

    if (this.input) {
      this.sync(name, this.getAttribute(name));
    }
  }

  // Push one observed attribute into the hidden native input, then re-sync
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
        this.input.disabled = this.hasAttribute('disabled');
        break;

      case 'size':
        this.applyShape();
        break;
    }

    this.updateFromInput();
  }

  // The current value (read live from the inner control once built)
  get value (): string {
    return this.input ? this.input.value : this.getAttribute('value') || this.storedValue || '50';
  }

  // Set the value and reflect it into the thumb, ARIA and the form. A write
  // before build is kept and applied in onBuilt(), never dropped (Sol M12).
  set value (v: string) {
    this.storedValue = String(v);

    if (this.input) {
      this.input.value = this.storedValue;
      this.updateFromInput();
    }
  }

  // Route programmatic host focus into the hidden native input
  override focus (options?: FocusOptions): void {
    this.input?.focus(options);
  }

  // painter.md: a reconnect gives a disabled painter one more chance, and the
  // base class only resets its own surface slot
  override connectedCallback (): void {
    this.trackPainterFailed = false;

    super.connectedCallback();
  }

  override disconnectedCallback (): void {
    super.disconnectedCallback();

    this.clearDragging();
  }

}

// Explicit helper, so strict is the default: a foreign jelly-slider throws
// rather than being warned past (registration.md)
export function defineSlider (options: DefineOptions = {}): DefineResult {
  return defineElements([[TAGS.slider, JellySlider]], { ...options, strict: options.strict ?? true });
}

declare global {
  interface HTMLElementTagNameMap {
    'jelly-slider': JellySlider;
  }
}
