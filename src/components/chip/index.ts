/*
 * A small soft-body capsule. Static by default; `selectable` makes it a
 * toggle and `removable` adds a ✕ that pops it out. Selecting bulges
 * outward; deselecting or removing sucks inward.
 */

import { DropletElement }  from '../../element/index.js';
import type { Shape }    from '../../element/index.js';

import { emit }          from '../../utilities/index.js';
import { triggerHaptic } from '../../utilities/index.js';

import { variantColors } from '../../theme/index.js';
import { defineStrict, TAGS } from '../../registry/index.js';
import type { DefineOptions, DefineResult } from '../../registry/index.js';
import { readToken } from '../../theme/token-read.js';

import chipStyles        from './chip.css?inline';

/**
 * A small soft-body capsule or tag, optionally selectable or removable.
 *
 * @element droplet-chip
 *
 * @slot - The chip label.
 *
 * @attr {boolean} selectable - Make the chip a toggle button.
 * @attr {boolean} selected - Selected state (for selectable chips).
 * @attr {boolean} removable - Show a ✕ button that removes the chip.
 * @attr {boolean} disabled - Disable interaction.
 * @attr {"pill"|"square"} shape - Full pill (default) or rounded-square.
 * @attr {"small"|"medium"|"large"} size - Chip size.
 * @attr {"white"|"rose"|"amber"|"azure"|"mint"|"platinum"|"graphite"} variant - Selected fill hue.
 * @attr {string} feel - Registered feel preset driving the physics; inherits from a `data-droplet-feel` scope.
 * @attr {"low"|"medium"|"high"} quality - Caps physics cost (med/lo/hi aliases accepted); inherits from a `data-droplet-quality` scope.
 *
 * @fires change - When a selectable chip toggles.
 * @fires remove - Cancelable; fires before a removable chip animates out.
 *
 * @csspart chip - The capsule.
 * @csspart main - The label or toggle button.
 * @csspart remove - The ✕ remove button.
 */
export class DropletChip extends DropletElement {

  static define (options?: DefineOptions): DefineResult {
    return defineChip(options);
  }

  static override usesResolver = true;

  // Theme flips repaint so the crossfade re-resolves against the new tokens
  onThemeFlip = (): void => {
    this.requestFrame();
  };

  // Populated in onBuilt()
  main!: HTMLElement;
  removeButton: HTMLElement | null = null;
  selectTarget: number | null = null;

  static get observedAttributes (): string[] {
    return ['selected', 'disabled', 'selectable', 'removable', 'variant', 'shape', ...DropletElement.AXIS_ATTRIBUTES];
  }

  override connectedCallback (): void {
    super.connectedCallback();
    window.addEventListener('droplet-theme-change', this.onThemeFlip);
  }

  override disconnectedCallback (): void {
    super.disconnectedCallback();
    window.removeEventListener('droplet-theme-change', this.onThemeFlip);
  }

  override styles (): string {
    return chipStyles + variantColors({ color: '--droplet-on', on: '--droplet-label-on' });
  }

  override content (): string {
    const selectable = this.hasAttribute('selectable');
    const removable  = this.hasAttribute('removable');
    const disabled   = this.hasAttribute('disabled') ? ' disabled' : '';

    const main = selectable
      ? `<button class="main" part="main" aria-pressed="${this.hasAttribute('selected')}"${disabled}><slot></slot></button>`
      : `<span class="main" part="main"><slot></slot></span>`;

    const remove = removable
      ? `<button class="remove" part="remove" aria-label="Remove"${disabled}>
           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true">
             <path d="M6 6l12 12M18 6L6 18" />
           </svg>
         </button>`
      : '';

    return `<div class="chip" part="chip">${main}${remove}</div>`;
  }

  // The capsule (or, with shape="square", rounded rectangle) the physics body
  // takes, inset so the wobble stays inside
  override shape (width: number, height: number): Shape {
    const w      = width - 6;
    const h      = height - 6;
    const square = this.getAttribute('shape') === 'square';

    // A plain-px --droplet-chip-radius override reaches the painted surface; the
    // 999px pill default falls through to the ratio
    const declared = parseFloat(readToken(getComputedStyle(this), 'chip-radius'));
    const radius   = Number.isFinite(declared) && declared < 900 ? Math.min(declared, h / 2) : (square ? h * 0.32 : h / 2);

    return { width: w, height: h, radius };
  }

  // The current fill along the off → on crossfade
  override fill (): string {
    return this.mixFill(this.hasAttribute('selected') ? 1 : 0);
  }

  // Blend the off → on fills at t (0–1). Both ends re-resolve every paint, so a runtime --droplet-on
  // or --droplet-fill override (or its legacy --jelly-* name) recolors the chip; nothing is cached.
  mixFill (t: number): string {
    return this.mixColor('var(--jelly-fill, var(--droplet-fill))', 'var(--jelly-on, var(--droplet-on))', t);
  }

  // Ease the selection factor so the fill fades between tones instead of flipping.
  // Runs whenever `selected` changes or the body is still moving.
  override frame (dt: number): boolean {
    const body = this.body;

    if (!body) {
      return false;
    }

    const target = this.hasAttribute('selected') ? 1 : 0;

    if (this.selectTarget == null) {
      this.selectTarget = target;
    }

    this.selectTarget += (target - this.selectTarget) * Math.min(1, dt * 11);

    if (Math.abs(target - this.selectTarget) < 0.004) {
      this.selectTarget = target;
    }

    body.update(dt);
    this.clearCanvas();
    this.paintBody(body, { fill: this.mixFill(this.selectTarget), ring: this.focusRing() });

    return Math.abs(target - this.selectTarget) > 0.001 || !body.isResting();
  }

  override onBuilt (): void {
    this.main         = this.shadowRoot!.querySelector('.main')!;
    this.removeButton = this.shadowRoot!.querySelector('.remove');

    // Seed the fade factor to the initial state so the first toggle always
    // eases (rather than depending on a frame having run while mounted)
    this.selectTarget = this.hasAttribute('selected') ? 1 : 0;

    const interactive = this.hasAttribute('selectable') || this.hasAttribute('removable');

    if (interactive) {
      const focusTarget = this.hasAttribute('selectable') ? this.main : this.removeButton;
      this.useHostFocusTarget(focusTarget);
    }

    // Presses are wired by hand (not wirePress): capturing the pointer on
    // the chip would retarget pointerup away from the ✕ button and swallow
    // its click, so the press releases on pointerleave instead
    const chip = this.shadowRoot!.querySelector('.chip') as HTMLElement;

    chip.addEventListener('pointerdown', (event) => {
      if (this.hasAttribute('disabled')) {
        return;
      }
      this.pressAt(event.clientX, event.clientY, interactive ? 1 : 0.7);
    });

    const release = (): void => this.releaseBody();

    chip.addEventListener('pointerup', release);
    chip.addEventListener('pointercancel', release);
    chip.addEventListener('pointerleave', release);

    if (this.hasAttribute('selectable')) {
      this.trackFocus(this.main);

      this.main.addEventListener('click', () => this.toggleSelected());
      this.main.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') {
          return;
        }

        // Route keyboard activation through the same click path as pointer
        // activation so composed click listeners observe both consistently.
        event.preventDefault();

        if (event.repeat || this.hasAttribute('disabled')) {
          return;
        }

        this.main.click();
      });
    }

    if (this.removeButton) {
      this.removeButton.addEventListener('click', (event) => {
        event.stopPropagation();
        this.removeChip();
      });
    }
  }

  // Flip the selection, pop the soft body, and notify listeners
  toggleSelected (): void {
    const next = !this.hasAttribute('selected');

    this.toggleAttribute('selected', next);
    this.main.setAttribute('aria-pressed', String(next));

    this.centerPop(next ? 1.05 : -0.85);
    triggerHaptic();

    emit(this, 'change');
  }

  // Fire the cancelable remove event, then collapse out of the layout
  removeChip (): void {
    if (emit(this, 'remove', null, { cancelable: true }) === false) {
      return;
    }

    this.centerPop(-1.1);
    triggerHaptic();

    if (this.reducedMotion) {
      this.remove();
      return;
    }

    // Freeze the width, then collapse it to 0 with the scale and fade so the row closes up instead
    // of jumping; a negative margin swallows one flex gap so neighbors are in place when it leaves.
    const gap = parseFloat(getComputedStyle(this.parentElement || this).columnGap) || 0;
    const w   = this.getBoundingClientRect().width;

    this.style.width = `${w}px`;
    void this.offsetWidth; // reflow so the width transition has a start value

    this.classList.add('removing');
    this.style.width = '0px';

    if (gap) {
      this.style.marginInlineEnd = `-${gap}px`;
    }

    let done = false;

    const finish = (): void => {
      if (done) {
        return;
      }
      done = true;
      this.remove();
    };

    this.addEventListener('transitionend', (event) => {
      if (event.propertyName === 'width') {
        finish();
      }
    });

    setTimeout(finish, 480);
  }

  attributeChangedCallback (name: string): void {
    if (this.axisAttributeChanged(name)) {
      return;
    }

    if (!this.built) {
      return;
    }

    switch (name) {
      case 'selectable':
      case 'removable':
        // These decide whether the ✕ and toggle buttons exist, so re-render the
        // interactive markup (the canvas and body are untouched siblings)
        this.rebuildContent();
        break;

      case 'variant':
        // A new variant swaps --droplet-on via CSS; repaint so the fill
        // re-resolves (a resting body won't on its own)
        this.requestFrame();
        break;

      case 'selected':
        if (this.main?.tagName === 'BUTTON') {
          this.main.setAttribute('aria-pressed', String(this.hasAttribute('selected')));
        }
        this.requestFrame();
        break;

      case 'disabled':
        if (this.main?.tagName === 'BUTTON') {
          (this.main as HTMLButtonElement).disabled = this.hasAttribute('disabled');
        }
        if (this.removeButton) {
          (this.removeButton as HTMLButtonElement).disabled = this.hasAttribute('disabled');
        }
        this.syncHostFocusTarget();
        break;

      case 'shape':
        this.reshapeMembrane();
        break;
    }
  }

  // Re-render the chip's interactive markup in place and re-wire it
  rebuildContent (): void {
    const content = this.shadowRoot!.querySelector('.droplet-content');

    if (!content) {
      return;
    }

    content.innerHTML = this.content();
    this.onBuilt();
    this.requestFrame();
  }

  get selected (): boolean {
    return this.hasAttribute('selected');
  }

  set selected (value: boolean) {
    this.toggleAttribute('selected', !!value);
  }

  override focus (options?: FocusOptions): void {
    (this.main || this.removeButton)?.focus(options);
  }

}

export function defineChip (options: DefineOptions = {}): DefineResult {
  return defineStrict([[TAGS.chip, DropletChip]], options);
}

declare global {
  interface HTMLElementTagNameMap {
    'droplet-chip': DropletChip;
  }
}
