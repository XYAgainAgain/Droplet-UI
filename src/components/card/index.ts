import { DropletElement } from '../../element/index.js';
import type { Shape }   from '../../element/index.js';
import type { Border }  from '../../element/index.js';

import { emit }          from '../../utilities/index.js';
import { triggerHaptic } from '../../utilities/index.js';

import { PALETTE }       from '../../theme/index.js';
import { defineStrict, TAGS } from '../../registry/index.js';
import type { DefineOptions, DefineResult } from '../../registry/index.js';
import { readToken } from '../../theme/token-read.js';

import cardStyles        from './card.css?inline';

/**
 * A soft-body surface container. With `squish` it presses in like a
 * cushion and behaves as a button.
 *
 * @element droplet-card
 *
 * @slot - The card's content.
 *
 * @attr {boolean} squish - Make the card pressable (acts as a button).
 * @attr {"small"|"medium"|"large"} size - Padding/radius scale.
 * @attr {string} feel - Registered feel preset driving the physics; inherits from a `data-droplet-feel` scope.
 * @attr {"low"|"medium"|"high"} quality - Caps physics cost (med/lo/hi aliases accepted); inherits from a `data-droplet-quality` scope.
 *
 * @fires click - When a squish card is activated by keyboard: Enter on keydown, Space on keyup.
 *
 * @csspart card - The padded content surface.
 *
 * @cssprop [--droplet-fill] - Surface fill.
 * @cssprop [--droplet-radius=22px] - Corner radius of the painted surface.
 */
export class DropletCard extends DropletElement {

  static define (options?: DefineOptions): DefineResult {
    return defineCard(options);
  }

  static override usesResolver = true;

  // Populated in onBuilt()
  card!: HTMLElement;
  pressing = false;
  squishWired = false;
  enterHeld = false;
  spaceArmed = false;

  static get observedAttributes (): string[] {
    return ['squish', ...DropletElement.AXIS_ATTRIBUTES];
  }

  override styles (): string {
    return cardStyles;
  }

  override content (): string {
    const squish = this.hasAttribute('squish');
    const attrs  = squish ? `tabindex="0" role="button"` : '';

    return `<div class="card" part="card" ${attrs}><slot></slot></div>`;
  }

  // The rounded surface the physics body takes (radius follows the token)
  override shape (width: number, height: number): Shape {
    const radius = parseFloat(readToken(getComputedStyle(this), 'radius')) || 22;

    return { width, height, radius: Math.min(radius, Math.min(width, height) / 2) };
  }

  override surfaceBorder (): Border {
    return {
      color: this.resolveColor(`var(--jelly-color-border-default, var(--droplet-color-border-default, ${PALETTE['border-default']}))`),
      width: 1,
    };
  }

  override onBuilt (): void {
    this.card = this.shadowRoot!.querySelector('.card')!;

    if (!this.reducedMotion) {
      requestAnimationFrame(() => this.centerPop(0.7));
    }

    this.syncSquish();
  }

  // Wire (or unwire) button behavior for squish mode. The card is a div with role="button",
  // so Space/Enter need preventDefault by hand; the shared wirePress helper would let Space scroll.
  syncSquish (): void {
    if (!this.card) {
      return;
    }

    const squish = this.hasAttribute('squish');

    if (squish) {
      this.card.setAttribute('tabindex', '0');
      this.card.setAttribute('role', 'button');
    } else {
      this.card.removeAttribute('tabindex');
      this.card.removeAttribute('role');
      this.pressing = false;
      this.enterHeld = false;
      this.spaceArmed = false;
      this.releaseBody();
    }

    if (!squish || this.squishWired) {
      return;
    }

    this.squishWired = true;

    this.useHostFocusTarget(this.card);
    this.trackFocus(this.card);

    this.card.addEventListener('pointerdown', (event) => {
      if (!this.hasAttribute('squish')) {
        return;
      }

      try {
        this.card.setPointerCapture(event.pointerId);
      } catch {
        // Capture can fail if the pointer is already gone; the press still works
      }

      this.pressing = true;
      this.pressAt(event.clientX, event.clientY, 1);
      triggerHaptic();
    });

    this.card.addEventListener('pointermove', (event) => {
      if (this.pressing) {
        this.moveAt(event.clientX, event.clientY);
      }
    });

    const endPress = (): void => {
      if (this.pressing) {
        this.pressing = false;
        this.releaseBody();
      }
    };

    this.card.addEventListener('pointerup', endPress);
    this.card.addEventListener('pointercancel', endPress);

    // Native button timing: Enter clicks on keydown, Space on its own keyup. The target
    // check skips keys bubbling up from focusable slotted content.
    this.card.addEventListener('keydown', (event) => {
      if (!this.hasAttribute('squish') || event.target !== this.card || (event.key !== 'Enter' && event.key !== ' ')) {
        return;
      }

      event.preventDefault();

      if (event.repeat) {
        return;
      }

      if (event.key === 'Enter') {
        this.enterHeld = true;
        this.centerPulse();
        emit(this, 'click');
      } else if (!this.spaceArmed) {
        this.spaceArmed = true;
        this.centerPulse();
      }
    });

    this.card.addEventListener('keyup', (event) => {
      if (event.key === 'Enter' && this.enterHeld) {
        this.enterHeld = false;
        this.settleKeyPress();
      } else if (event.key === ' ' && this.spaceArmed) {
        this.spaceArmed = false;
        this.settleKeyPress();
        emit(this, 'click');
      }
    });

    // A Space press interrupted by focus loss is canceled, as on a native button
    this.card.addEventListener('blur', () => {
      if (this.enterHeld || this.spaceArmed) {
        this.enterHeld = false;
        this.spaceArmed = false;
        this.settleKeyPress();
      }
    });
  }

  // Let the surface spring back once no key or pointer is still holding it down
  settleKeyPress (): void {
    if (!this.enterHeld && !this.spaceArmed && !this.pressing) {
      this.releaseBody();
    }
  }

  attributeChangedCallback (name: string): void {
    if (this.axisAttributeChanged(name)) {
      return;
    }

    if (name === 'squish') {
      this.syncSquish();
    }
  }

  override focus (options?: FocusOptions): void {
    this.card?.focus(options);
  }

}

export function defineCard (options: DefineOptions = {}): DefineResult {
  return defineStrict([[TAGS.card, DropletCard]], options);
}

declare global {
  interface HTMLElementTagNameMap {
    'droplet-card': DropletCard;
  }
}
