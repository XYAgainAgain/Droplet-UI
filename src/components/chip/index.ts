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

  // A resting body never repaints, so a token change needs a frame
  onThemeFlip = (): void => {
    this.requestFrame();
  };

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

  override shape (width: number, height: number): Shape {
    const w      = width - 6;
    const h      = height - 6;
    const square = this.getAttribute('shape') === 'square';

    // A px radius token wins; the 999px pill default takes the ratio
    const declared = parseFloat(readToken(getComputedStyle(this), 'chip-radius'));
    const radius   = Number.isFinite(declared) && declared < 900 ? Math.min(declared, h / 2) : (square ? h * 0.32 : h / 2);

    return { width: w, height: h, radius };
  }

  override fill (): string {
    return this.mixFill(this.hasAttribute('selected') ? 1 : 0);
  }

  // Resolved every paint so runtime token overrides recolor the chip; don't cache
  mixFill (t: number): string {
    return this.mixColor('var(--jelly-fill, var(--droplet-fill))', 'var(--jelly-on, var(--droplet-on))', t);
  }

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

    // Seeded so the first toggle eases even if no frame has run
    this.selectTarget = this.hasAttribute('selected') ? 1 : 0;

    const interactive = this.hasAttribute('selectable') || this.hasAttribute('removable');

    if (interactive) {
      const focusTarget = this.hasAttribute('selectable') ? this.main : this.removeButton;
      this.useHostFocusTarget(focusTarget);
    }

    // Not wirePress: pointer capture on the chip swallows the ✕ button's click
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

        // Keyboard takes the pointer's click path, so click listeners see both alike
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

  toggleSelected (): void {
    const next = !this.hasAttribute('selected');

    this.toggleAttribute('selected', next);
    this.main.setAttribute('aria-pressed', String(next));

    this.centerPop(next ? 1.05 : -0.85);
    triggerHaptic();

    emit(this, 'change');
  }

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

    // The negative margin swallows one flex gap so neighbors land in place
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
        this.rebuildContent();
        break;

      case 'variant':
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

  // The canvas and body are siblings of the content and survive this
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
