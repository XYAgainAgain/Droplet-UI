/*
 * A progress bar with a jelly fill. The leading edge wobbles as the
 * value advances; add `indeterminate` for a blob that travels the track,
 * leaning into its motion and splatting softly against each wall
 */

import { JellyElement } from '../../element/index.js';
import type { Shape }   from '../../element/index.js';

import { JellyBody }    from '../../core/index.js';

import { clamp }        from '../../utilities/index.js';
import { isRTL }        from '../../utilities/index.js';

import { PALETTE }      from '../../theme/index.js';
import { variantColors } from '../../theme/index.js';

import progressStyles   from './progress.css?inline';

interface ProgressSize {
  width: number;
  track: number;
}

// Track geometry for each size on the documented scale
const PROGRESS_SIZES: Record<string, ProgressSize> = {
  small:  { width: 200, track: 10 },
  medium: { width: 240, track: 14 },
  large:  { width: 300, track: 18 },
};

/**
 * A progress bar with a wobbling jelly fill, or a travelling blob when
 * indeterminate.
 *
 * @element jelly-progress
 *
 * @attr {number} value - Current value.
 * @attr {number} max - Maximum value (defaults to 100).
 * @attr {boolean} indeterminate - Show a busy blob instead of a value.
 * @attr {string} label - Accessible name for the bar.
 * @attr {"small"|"medium"|"large"} size - Bar size.
 * @attr {"white"|"rose"|"amber"|"azure"|"mint"|"platinum"|"graphite"} variant - Fill hue.
 *
 * @cssprop [--jelly-accent] - Fill color.
 * @cssprop [--jelly-track] - Empty-track color.
 */
export class JellyProgress extends JellyElement {

  fraction = 0;
  shownFrac = 0;
  phase = 0;
  trackW = 0;
  trackH = 0;
  blob: JellyBody | null = null;
  blobW = 0;
  blobH = 0;
  wall = false;
  rip = 0;

  // Tells the browser to trigger attributeChangedCallback when these attributes change
  static get observedAttributes (): string[] {
    return ['value', 'max', 'indeterminate', 'size', 'label'];
  }

  // Component styles layered over the shared jelly base styles
  override styles (): string {
    return progressStyles + variantColors({ color: '--jelly-accent' });
  }

  // No interactive content - the bar is pure canvas
  override content (): string {
    return '';
  }

  // The full track is the physics body; the fill is painted clipped
  override shape (width: number, height: number): Shape {
    const trackH = height || this.sizeConfig.track;

    return { width, height: trackH, radius: trackH / 2 };
  }

  // Geometry for the current (canonicalized) size attribute
  get sizeConfig (): ProgressSize {
    return PROGRESS_SIZES[this.getAttribute('size') ?? ''] ?? PROGRESS_SIZES.medium!;
  }

  // Called once after the shadow DOM and canvas exist. Wire ARIA here.
  override onBuilt (): void {
    this.setAttribute('role', 'progressbar');
    this.readValue();
  }

  // Cache the track box whenever the shape (re)builds
  override onShape (): void {
    this.trackW = this.body ? this.body.width : this.getBoundingClientRect().width;
    this.trackH = this.body ? this.body.height : this.sizeConfig.track;
  }

  // True while the bar shows busy-without-a-value
  get indeterminate (): boolean {
    return this.hasAttribute('indeterminate');
  }

  set indeterminate (value: boolean) {
    this.toggleAttribute('indeterminate', Boolean(value));
  }

  // Parse value / max and mirror them into the progressbar ARIA
  readValue (): void {
    const max   = parseFloat(this.getAttribute('max') ?? '') || 100;
    const value = parseFloat(this.getAttribute('value') ?? '') || 0;

    this.fraction = clamp(value / max, 0, 1);

    if (this.indeterminate) {
      this.setAttribute('aria-valuetext', 'Loading…');
      this.removeAttribute('aria-valuenow');
    } else {
      this.setAttribute('aria-valuemin', '0');
      this.setAttribute('aria-valuemax', String(max));
      this.setAttribute('aria-valuenow', String(value));
      this.removeAttribute('aria-valuetext');
    }

    const label = this.getAttribute('label');

    if (label) {
      this.setAttribute('aria-label', label);
    }

    this.requestFrame();
  }

  // Clip the drawing context to a rounded track segment
  roundedClip (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    ctx.beginPath();
    ctx.roundRect(x, y, Math.max(0, w), h, Math.min(r, Math.max(0, w) / 2, h / 2));
    ctx.clip();
  }

  // One animation step: paint the track, then the fill or the travelling blob
  override frame (dt: number): boolean {
    const body = this.body;

    if (!body) {
      return false;
    }

    const ctx    = this.ctx;
    const cy     = this.cssH / 2;
    const tW     = this.trackW;
    const left   = this.cssW / 2 - tW / 2;
    const rtl    = isRTL(this);
    const track  = getComputedStyle(this).getPropertyValue('--jelly-track').trim() || PALETTE['background-neutral']!;
    const accent = getComputedStyle(this).getPropertyValue('--jelly-accent').trim() || PALETTE['background-accent']!;

    body.update(dt);
    this.clearCanvas();

    // Track base
    const trackH = this.trackH || this.sizeConfig.track;

    ctx.beginPath();
    ctx.roundRect(left, cy - trackH / 2, tW, trackH, trackH / 2);
    ctx.fillStyle = track;
    ctx.fill();

    let keepAnimating = false;

    if (this.indeterminate) {
      // A single blob of jelly bounces wall to wall: it leans into its travel
      // (teardrop), eases to a stop at each end and splats against the wall
      // before springing back - far livelier than a pill sliding on a rail.
      const blobW = Math.max(trackH * 1.8, tW * 0.24);

      if (!this.blob) {
        this.blob = new JellyBody({ width: blobW, height: trackH, radius: trackH / 2 });
      } else if (this.blobW !== blobW || this.blobH !== trackH) {
        this.blob.resize(blobW, trackH, trackH / 2);
      }

      this.blobW = blobW;
      this.blobH = trackH;

      const blob = this.blob;

      if (this.reducedMotion) {
        // Static centered blob - signals "busy" without any motion
        blob.leanAmount = 0;
        blob.update(dt);
        this.paintBody(blob, { fill: accent, cx: 0 });
        return false;
      }

      // Sinusoidal travel → fast through the middle, easing to rest at each wall
      const travel = Math.max(0, tW - blobW);

      this.phase += dt * 2.0;

      const s     = Math.sin(this.phase);
      const bx    = s * (travel / 2);
      const vel   = Math.cos(this.phase);
      const speed = Math.abs(vel);

      // Elongate along travel with rounded ends (a soft, flowing tail) plus
      // only a gentle forward lean - pushing past the end radius would tuck
      // the trailing tip into a sharp point. Both relax at the turnarounds.
      const stretch = speed * 0.34;

      if (speed > 0.06) {
        blob.lean = Math.sign(vel);
      }
      blob.leanAmount = speed * (trackH / 2) * 0.4;

      // A soft splat against the wall each time it turns around
      if (Math.abs(s) > 0.985) {
        if (!this.wall) {
          this.wall = true;
          blob.stretchAlong(Math.sign(bx) || 1, 0, 0.6);
        }
      } else if (Math.abs(s) < 0.9) {
        this.wall = false;
      }

      blob.update(dt);
      this.paintBody(blob, {
        fill:   accent,
        cx:     bx,
        scaleX: 1 + stretch,
        scaleY: 1 - stretch * 0.5,
      });

      keepAnimating = true;
    } else {
      // Ease the fill length smoothly toward the target - no overshoot on the
      // length itself (a bouncing edge reads as a clunk, not a wobble)
      this.shownFrac += (this.fraction - this.shownFrac) * Math.min(1, dt * 9);

      const remaining = Math.abs(this.fraction - this.shownFrac);

      if (remaining < 0.0004) {
        this.shownFrac = this.fraction;
      }

      // The fill grows from the inline-start edge, so mirror in RTL
      const lx = rtl
        ? clamp(tW / 2 - this.shownFrac * tW, -tW / 2, tW / 2)
        : clamp(-tW / 2 + this.shownFrac * tW, -tW / 2, tW / 2);

      // One soft ripple rolls along the leading edge while it advances -
      // throttled so pulses don't pile up into a jittery wobble
      this.rip += dt;

      if (!this.reducedMotion && remaining > 0.003 && this.rip > 0.13) {
        this.rip = 0;
        body.pulseAt(lx, -trackH / 2, 0.28);
        body.pulseAt(lx, trackH / 2, 0.28);
      }

      const fillW = this.shownFrac * tW;
      const fillX = rtl ? left + tW - fillW : left;

      ctx.save();
      this.roundedClip(ctx, fillX, cy - trackH / 2, fillW, trackH, trackH / 2);
      this.paintBody(body, { fill: accent });
      ctx.restore();

      keepAnimating = remaining > 0.0004 || !body.isResting();
    }

    return keepAnimating;
  }

  // Lifecycle method: Fires when observed HTML attributes change dynamically.
  // Guard on built-state (not body, which only exists after the first
  // nonzero-size layout) so value changes land even before the first paint.
  attributeChangedCallback (name: string): void {
    if (!this.built) {
      return;
    }

    if (name === 'size') {
      this.applyShape();
    }

    this.readValue();
  }

  // The current value as a number
  get value (): number {
    return parseFloat(this.getAttribute('value') ?? '') || 0;
  }

  set value (value: number) {
    this.setAttribute('value', String(value));
  }

}

// Register the custom element
customElements.define('jelly-progress', JellyProgress);

declare global {
  interface HTMLElementTagNameMap {
    'jelly-progress': JellyProgress;
  }
}
