import { DropletElement } from '../../element/index.js';
import type { Shape }   from '../../element/index.js';

import { DropletBody }    from '../../core/index.js';

import { clamp }        from '../../utilities/index.js';
import { isRTL }        from '../../utilities/index.js';

import { PALETTE }      from '../../theme/index.js';
import { variantColors } from '../../theme/index.js';
import { defineStrict, TAGS } from '../../registry/index.js';
import type { DefineOptions, DefineResult } from '../../registry/index.js';
import { readToken } from '../../theme/token-read.js';

import progressStyles   from './progress.css?inline';

interface ProgressSize {
  width: number;
  track: number;
}

const PROGRESS_SIZES: Record<string, ProgressSize> = {
  small:  { width: 200, track: 10 },
  medium: { width: 240, track: 14 },
  large:  { width: 300, track: 18 },
};

/**
 * A progress bar with a wobbling soft-body fill, or a traveling blob when
 * indeterminate.
 *
 * @element droplet-progress
 *
 * @attr {number} value - Current value.
 * @attr {number} max - Maximum value (defaults to 100).
 * @attr {boolean} indeterminate - Show a busy blob instead of a value.
 * @attr {string} label - Accessible name for the bar.
 * @attr {"small"|"medium"|"large"} size - Bar size.
 * @attr {"white"|"rose"|"amber"|"azure"|"mint"|"platinum"|"graphite"} variant - Fill hue.
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
 * @cssprop [--droplet-accent] - Fill color.
 * @cssprop [--droplet-track] - Empty-track color.
 */
export class DropletProgress extends DropletElement {

  static define (options?: DefineOptions): DefineResult {
    return defineProgress(options);
  }

  static override usesResolver = true;

  static override textOnFill = false;

  fraction = 0;
  shownFrac = 0;
  phase = 0;
  trackW = 0;
  trackH = 0;
  blob: DropletBody | null = null;
  blobW = 0;
  blobH = 0;
  wall = false;
  rip = 0;

  static get observedAttributes (): string[] {
    return ['value', 'max', 'indeterminate', 'size', 'label', ...DropletElement.AXIS_ATTRIBUTES];
  }

  override styles (): string {
    return progressStyles + variantColors({ color: '--droplet-accent' });
  }

  override content (): string {
    return '';
  }

  // The whole track is the body; the fill is painted clipped to it
  override shape (width: number, height: number): Shape {
    const trackH = height || this.sizeConfig.track;

    return { width, height: trackH, radius: trackH / 2 };
  }

  get sizeConfig (): ProgressSize {
    return PROGRESS_SIZES[this.getAttribute('size') ?? ''] ?? PROGRESS_SIZES.medium!;
  }

  override onBuilt (): void {
    this.setAttribute('role', 'progressbar');
    this.readValue();
  }

  override onShape (): void {
    this.trackW = this.body ? this.body.width : this.getBoundingClientRect().width;
    this.trackH = this.body ? this.body.height : this.sizeConfig.track;
  }

  get indeterminate (): boolean {
    return this.hasAttribute('indeterminate');
  }

  set indeterminate (value: boolean) {
    this.toggleAttribute('indeterminate', Boolean(value));
  }

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

  roundedClip (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    ctx.beginPath();
    ctx.roundRect(x, y, Math.max(0, w), h, Math.min(r, Math.max(0, w) / 2, h / 2));
    ctx.clip();
  }

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
    const track  = readToken(getComputedStyle(this), 'track').trim() || PALETTE['background-neutral']!;
    const accent = readToken(getComputedStyle(this), 'accent').trim() || PALETTE['background-accent']!;

    body.update(dt);
    this.clearCanvas();

    const trackH = this.trackH || this.sizeConfig.track;

    ctx.beginPath();
    ctx.roundRect(left, cy - trackH / 2, tW, trackH, trackH / 2);
    ctx.fillStyle = track;
    ctx.fill();

    let keepAnimating = false;

    if (this.indeterminate) {
      const blobW = Math.max(trackH * 1.8, tW * 0.24);

      if (!this.blob) {
        this.blob = this.createBody({ width: blobW, height: trackH, radius: trackH / 2 });
      } else if (this.blobW !== blobW || this.blobH !== trackH) {
        this.blob.resize(blobW, trackH, trackH / 2);
      }

      this.blobW = blobW;
      this.blobH = trackH;

      const blob = this.blob;

      if (this.reducedMotion) {
        blob.leanAmount = 0;
        blob.update(dt);
        this.paintBody(blob, { fill: accent, cx: 0 });
        return false;
      }

      const travel = Math.max(0, tW - blobW);

      this.phase += dt * 2.0;

      const s     = Math.sin(this.phase);
      const bx    = s * (travel / 2);
      const vel   = Math.cos(this.phase);
      const speed = Math.abs(vel);

      // Keep the lean gentle: past the end radius the trailing tip tucks into a point
      const stretch = speed * 0.34;

      if (speed > 0.06) {
        blob.lean = Math.sign(vel);
      }
      blob.leanAmount = speed * (trackH / 2) * 0.4;

      // Re-arms only below 0.9, so each turnaround splats once
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
      // Eased, not sprung: an overshooting edge reads as a clunk
      this.shownFrac += (this.fraction - this.shownFrac) * Math.min(1, dt * 9);

      const remaining = Math.abs(this.fraction - this.shownFrac);

      if (remaining < 0.0004) {
        this.shownFrac = this.fraction;
      }

      const lx = rtl
        ? clamp(tW / 2 - this.shownFrac * tW, -tW / 2, tW / 2)
        : clamp(-tW / 2 + this.shownFrac * tW, -tW / 2, tW / 2);

      // Throttled so pulses don't pile up into jitter
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

  // Gate on built, not body: body waits for layout, and values must land before first paint
  attributeChangedCallback (name: string): void {
    if (this.axisAttributeChanged(name)) {
      return;
    }

    if (!this.built) {
      return;
    }

    if (name === 'size') {
      this.applyShape();
    }

    this.readValue();
  }

  get value (): number {
    return parseFloat(this.getAttribute('value') ?? '') || 0;
  }

  set value (value: number) {
    this.setAttribute('value', String(value));
  }

}

export function defineProgress (options: DefineOptions = {}): DefineResult {
  return defineStrict([[TAGS.progress, DropletProgress]], options);
}

declare global {
  interface HTMLElementTagNameMap {
    'droplet-progress': DropletProgress;
  }
}
