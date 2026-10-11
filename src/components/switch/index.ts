/*
 * A real switch - a capsule track with a sliding thumb - with a jello twist:
 * the thumb stretches along its travel like a liquid drop, squishes when it
 * lands and the track jiggles and crossfades between the off and on colors.
 * The thumb can be tapped or dragged and "on" always travels toward the
 * inline end, so right-to-left pages mirror correctly
 */

import { DropletElement }    from '../../element/index.js';
import type { Shape }      from '../../element/index.js';

import { DropletBody }       from '../../core/index.js';

import { clamp }           from '../../utilities/index.js';
import { emit }            from '../../utilities/index.js';
import { isRTL }           from '../../utilities/index.js';
import { sizeName }        from '../../utilities/index.js';
import type { Size }       from '../../utilities/index.js';
import { triggerHaptic }   from '../../utilities/index.js';
import { integrateSpring } from '../../utilities/index.js';

import { variantColors }   from '../../theme/index.js';
import { defineStrict, TAGS } from '../../registry/index.js';
import type { DefineOptions, DefineResult } from '../../registry/index.js';

import switchStyles        from './switch.css?inline';

interface SwitchSize {
  width: number;
  height: number;
  inset: number;
  gap: number;
  font: string;
}

// Track geometry and label sizing for each size on the documented scale
const SWITCH_SIZES: Record<Size, SwitchSize> = {
  small:  { width: 50, height: 28, inset: 4, gap: 10, font: '14px' },
  medium: { width: 62, height: 34, inset: 5, gap: 12, font: '15.5px' },
  large:  { width: 74, height: 40, inset: 6, gap: 14, font: '16.5px' },
};

/**
 * A draggable, form-associated switch with a soft-body thumb and track.
 *
 * @element jelly-switch
 *
 * @slot - The label text shown beside the switch.
 *
 * @attr {boolean} checked - Whether the switch is on.
 * @attr {boolean} disabled - Disable the control and remove it from the tab order.
 * @attr {string} label - Accessible name when there is no slotted label.
 * @attr {string} value - Form value submitted while on (defaults to "on").
 * @attr {string} name - Form field name submitted with the value.
 * @attr {"small"|"medium"|"large"} size - Control size.
 * @attr {"white"|"rose"|"amber"|"azure"|"mint"|"platinum"|"graphite"} variant - On-state track hue.
 * @attr {string} feel - Registered feel preset driving the physics; inherits from a `data-droplet-feel` scope.
 * @attr {"low"|"medium"|"high"} quality - Caps physics cost (med/lo/hi aliases accepted); inherits from a `data-droplet-quality` scope.
 *
 * @fires change - When the on/off state changes through user interaction.
 *
 * @csspart wrap - The label wrapper.
 * @csspart track - The capsule track drag surface.
 * @csspart input - The visually-hidden native checkbox (role="switch").
 *
 * @cssprop [--jelly-on] - On-state track color.
 * @cssprop [--jelly-off] - Off-state track color.
 * @cssprop [--jelly-switch-thumb-on] - Thumb color when on.
 */
export class DropletSwitch extends DropletElement {

  static define (options?: DefineOptions): DefineResult {
    return defineSwitch(options);
  }

  static override usesResolver = true;

  // Participate in native <form> submission through ElementInternals
  static formAssociated = true;

  internals: ElementInternals;

  // Populated in onBuilt() / onShape()
  input!: HTMLInputElement;
  track!: HTMLElement;
  thumbBody: DropletBody | null = null;

  // Thumb slide spring (position, velocity, target) plus drag bookkeeping
  thumbX = 0;
  thumbXVelocity = 0;
  thumbTarget = 0;
  dragging = false;
  pointerId: number | null = null;
  downX = 0;

  // Tells the browser to trigger attributeChangedCallback when these attributes change
  static get observedAttributes (): string[] {
    return ['checked', 'disabled', 'label', 'size', 'value', ...DropletElement.AXIS_ATTRIBUTES];
  }

  constructor () {
    super();

    this.internals = this.attachInternals();
  }

  // Component styles layered over the shared jelly base styles
  override styles (): string {
    return switchStyles + variantColors({ color: '--jelly-on', on: '--jelly-switch-thumb-on' });
  }

  // The interactive markup that sits above the canvas
  override content (): string {
    return `
      <label class="wrap" part="wrap">
        <input type="checkbox" role="switch" part="input" />
        <span class="track" data-jelly-box part="track" aria-hidden="true"></span>
        <span class="label"><slot></slot></span>
      </label>`;
  }

  // The capsule the physics body takes - the track region, not the label
  override shape (width: number = this.sizeConfig.width, height: number = this.sizeConfig.height): Shape {
    return { width, height, radius: height / 2 };
  }

  // The canonical size name, accepting the sm / md / lg aliases
  get sizeKey (): Size {
    return sizeName(this);
  }

  // The geometry row for the current size
  get sizeConfig (): SwitchSize {
    return SWITCH_SIZES[this.sizeKey];
  }

  // The live track dimensions (physics body if built, size table otherwise)
  get trackSize (): { width: number; height: number } {
    return {
      width:  this.body?.width || this.sizeConfig.width,
      height: this.body?.height || this.sizeConfig.height,
    };
  }

  // How far the thumb center travels between its two resting points
  get travel (): number {
    const { width, height } = this.trackSize;

    return width - height;
  }

  // The thumb's resting offset for a checked state - "on" sits at the inline end
  targetFor (checked: boolean): number {
    const sign = isRTL(this) ? -1 : 1;

    return (checked ? 1 : -1) * sign * (this.travel / 2);
  }

  // Normalized travel from the visual off edge (0) to the on edge (1)
  slideProgress (): number {
    const half = Math.max(this.travel / 2, 1);
    const sign = isRTL(this) ? -1 : 1;

    return clamp(((this.thumbX * sign) / half + 1) / 2, 0, 1);
  }

  /*
   * The track color for the current thumb position. The off / on endpoints
   * are re-resolved through the live theme tokens on every paint - so theme
   * flips, variant changes and token overrides (including rgb() and named
   * colors) recolor the track mid-slide - then blended by the thumb's
   * progress toward the "on" end, which is the inline end in both directions.
   */
  trackFill (): string {
    return this.mixColor(
      'var(--jelly-off)',
      'var(--jelly-on)',
      this.slideProgress(),
    );
  }

  // The thumb stays white as it slides (off and on both default to the white
  // token), like a physical knob, so it reads consistently across themes and
  // accents. Variants can still override --jelly-switch-thumb-on for contrast.
  thumbFill (): string {
    return this.mixColor(
      'var(--jelly-switch-thumb-off)',
      'var(--jelly-switch-thumb-on)',
      this.slideProgress(),
    );
  }

  // Called once after the shadow DOM and canvas exist. Wire events here.
  override onBuilt (): void {
    this.input = this.shadowRoot!.querySelector('input')!;
    this.track = this.shadowRoot!.querySelector('.track')!;

    this.sync('checked');
    this.sync('disabled');
    this.sync('label');

    this.useHostFocusTarget(this.input);
    this.trackFocus(this.input);

    // The pointer handlers below own the toggle; the native click must not flip it
    this.input.addEventListener('click', (event) => event.preventDefault());

    // Clicking the label text toggles too, like a native checkbox label
    this.shadowRoot!.querySelector('.label')!.addEventListener('click', () => {
      if (!this.hasAttribute('disabled')) {
        this.setChecked(!this.checked, true);
      }
    });

    this.input.addEventListener('keydown', (event) => {
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        this.setChecked(!this.checked, true);
      }
    });

    this.track.addEventListener('pointerdown', (event) => this.onDown(event));
    this.track.addEventListener('pointermove', (event) => this.onMove(event));
    this.track.addEventListener('pointerup', (event) => this.onUp(event));
    this.track.addEventListener('pointercancel', (event) => this.onUp(event));
    this.track.addEventListener('lostpointercapture', (event) => this.onUp(event));
  }

  // Called whenever the shape (re)builds: size the thumb and seat it in place
  override onShape (): void {
    const { height } = this.trackSize;
    const size       = height - this.sizeConfig.inset * 2;

    if (!this.thumbBody) {
      this.thumbBody = this.createBody({ width: size, height: size, radius: size / 2 });
    } else {
      this.thumbBody.resize(size, size, size / 2);
    }

    this.thumbTarget    = this.targetFor(this.checked);
    this.thumbX         = this.thumbTarget;
    this.thumbXVelocity = 0;

    this.requestFrame();
  }

  // Press: capture the pointer and dent the track where the finger lands
  onDown (event: PointerEvent): void {
    if (this.hasAttribute('disabled')) {
      return;
    }

    this.pointerId = event.pointerId;
    this.dragging  = false;
    this.downX     = event.clientX;

    try {
      this.track.setPointerCapture(event.pointerId);
    } catch {
      // Capture can fail if the pointer is already gone; the press still works
    }

    this.pressAt(event.clientX, event.clientY, 0.8);
    this.requestFrame();
  }

  // Drag: after a small slop the thumb follows the finger along the track
  onMove (event: PointerEvent): void {
    if (this.pointerId !== event.pointerId) {
      return;
    }

    if (Math.abs(event.clientX - this.downX) > 4) {
      this.dragging = true;
    }

    if (!this.dragging) {
      return;
    }

    const local = this.toLocal(event.clientX, event.clientY);
    const half  = this.travel / 2;

    this.thumbTarget = clamp(local.x, -half, half);

    this.requestFrame();
  }

  // Release: a drag settles to whichever side the thumb is on; a tap toggles
  onUp (event: PointerEvent): void {
    if (this.pointerId !== event.pointerId) {
      return;
    }

    this.pointerId = null;

    try {
      this.track.releasePointerCapture(event.pointerId);
    } catch {
      // The capture may already be gone; the release still applies
    }

    this.releaseBody();

    // The "on" side is the inline end, so the decision mirrors on RTL pages
    const onSide = isRTL(this) ? this.thumbX < 0 : this.thumbX > 0;
    const next   = this.dragging ? onSide : !this.checked;

    this.setChecked(next, true);

    this.dragging = false;
  }

  // Move to a checked state, animating and emitting only on real user changes
  setChecked (value: boolean, fromUser = false): void {
    const changed = value !== this.checked;

    this.checked     = value;
    this.thumbTarget = this.targetFor(value);

    if (fromUser && changed) {
      if (!this.reducedMotion && this.thumbBody) {
        // Stretch toward the direction of travel - the inline end when turning on
        const sign = isRTL(this) ? -1 : 1;

        this.thumbBody.stretchAlong((value ? 1 : -1) * sign, 0, 0.9);
      }

      triggerHaptic();
      emit(this, 'change');
    }

    this.requestFrame();
  }

  // One animation step: slide the thumb, advance both bodies, repaint
  override frame (dt: number): boolean {
    const track = this.body;
    const thumb = this.thumbBody;

    if (!track || !thumb) {
      return false;
    }

    const prevX = this.thumbX;

    // Reduced motion snaps the thumb straight to its target instead of gliding
    if (this.reducedMotion) {
      this.thumbX         = this.thumbTarget;
      this.thumbXVelocity = 0;
    } else {
      [this.thumbX, this.thumbXVelocity] = integrateSpring(this.thumbX, this.thumbXVelocity, this.thumbTarget, 300, 26, dt);
    }

    // Organic lean: the thumb bulges toward its direction of travel and tucks the
    // trailing side in (a teardrop), relaxing to round as it lands - no flat oval.
    const speed = Math.abs(this.thumbXVelocity);

    if (speed > 6) {
      thumb.lean = Math.sign(this.thumbXVelocity);
    }

    thumb.leanAmount = this.reducedMotion ? 0 : Math.min(thumb.height * 0.34, speed * 0.014);

    // A little "plop" ripple in the track as the thumb passes
    if (!this.reducedMotion && Math.abs(this.thumbX - prevX) > 0.01) {
      track.pulseAt(this.thumbX, -this.trackSize.height / 2, 0.02 * Math.min(3, speed / 120));
    }

    track.update(dt);
    thumb.update(dt);

    this.clearCanvas();
    this.paintBody(track, { fill: this.trackFill(), ring: this.focusRing(), easeKey: 'track' });
    this.paintBody(thumb, {
      fill:    this.thumbFill(),
      cx:      this.thumbX,
      easeKey: 'thumb',
    });

    const slideSettled = Math.abs(this.thumbTarget - this.thumbX) < 0.2 && Math.abs(this.thumbXVelocity) < 0.5;

    return !(track.isResting() && thumb.isResting() && slideSettled) || this.pointerId != null;
  }

  // Lifecycle method: Fires when observed HTML attributes change dynamically
  attributeChangedCallback (name: string): void {
    if (this.axisAttributeChanged(name)) {
      return;
    }

    if (name === 'size') {
      if (this.built) {
        this.applyShape();
      }
      return;
    }

    if (this.input) {
      this.sync(name);
    }
  }

  // Push one observed attribute into the hidden native input
  sync (name: string): void {
    switch (name) {
      case 'checked':
        this.input.checked = this.checked;
        this.input.setAttribute('aria-checked', String(this.checked));
        this.internals.setFormValue(this.checked ? this.value : null);
        this.thumbTarget = this.targetFor(this.checked);
        this.requestFrame();
        break;

      case 'value':
        this.internals.setFormValue(this.checked ? this.value : null);
        break;

      case 'disabled':
        this.input.disabled = this.hasAttribute('disabled');
        this.syncHostFocusTarget();
        break;

      case 'label': {
        const label = this.getAttribute('label');

        if (label) {
          this.input.setAttribute('aria-label', label);
        } else {
          this.input.removeAttribute('aria-label');
        }
        break;
      }
    }
  }

  // Whether the switch is currently on (reflects the attribute)
  get checked (): boolean {
    return this.hasAttribute('checked');
  }

  set checked (value: boolean) {
    this.toggleAttribute('checked', Boolean(value));
  }

  // The form value submitted while on (defaults to "on", like native)
  get value (): string {
    return this.getAttribute('value') || 'on';
  }

  set value (value: string) {
    this.setAttribute('value', String(value));
  }

  // Route programmatic host focus into the hidden native input
  override focus (options?: FocusOptions): void {
    this.input?.focus(options);
  }

}

export function defineSwitch (options: DefineOptions = {}): DefineResult {
  return defineStrict([[TAGS.switch, DropletSwitch]], options);
}

declare global {
  interface HTMLElementTagNameMap {
    'droplet-switch': DropletSwitch;
  }
}
