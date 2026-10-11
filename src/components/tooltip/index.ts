/*
 * A lightweight, accessible tooltip that anchors a themed bubble over
 * its trigger element on hover or keyboard focus. Escape dismisses it
 * without moving the pointer (WCAG 1.4.13).
 *
 *   <droplet-tooltip text="Copy link" placement="top">
 *     <droplet-icon-button label="Copy">🔗</droplet-icon-button>
 *   </droplet-tooltip>
 */

import { placeAnchored }     from '../../anchor/index.js';
import { trackAnchor }       from '../../anchor/index.js';
import { springIn }          from '../../anchor/index.js';
import type { Placement }    from '../../anchor/index.js';

import { uniqueId }          from '../../utilities/index.js';
import { canonicalizeSize }  from '../../utilities/index.js';

import { ensureThemeTokens } from '../../theme/index.js';
import { HTMLElementBase }   from '../../element/base.js';
import { defineStrict, TAGS } from '../../registry/index.js';
import type { DefineOptions, DefineResult } from '../../registry/index.js';

import tooltipStyles         from './tooltip.css?inline';

/**
 * An accessible tooltip that anchors a bubble over its trigger.
 *
 * @element droplet-tooltip
 *
 * @slot - The trigger element the tooltip describes.
 * @slot content - Rich tooltip content (an alternative to the text attribute).
 *
 * @attr {string} text - The tooltip text.
 * @attr {"top"|"bottom"|"left"|"right"|"start"|"end"} placement - Preferred side.
 * @attr {"small"|"medium"|"large"} size - Bubble size.
 */
export class DropletTooltip extends HTMLElementBase {

  static define (options?: DefineOptions): DefineResult {
    return defineTooltip(options);
  }

  built = false;

  // Populated in connectedCallback()
  bubble!: HTMLElement;
  contentSlot!: HTMLSlotElement;

  untrack: (() => void) | null = null;

  // Escape dismisses the tooltip without moving the pointer (WCAG 1.4.13)
  onDocumentKey = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      this.hide();
    }
  };

  // Tells the browser to trigger attributeChangedCallback when these attributes change
  static get observedAttributes (): string[] {
    return ['text', 'size'];
  }

  // Lifecycle method: Called automatically when the element is appended to the DOM
  connectedCallback (): void {
    ensureThemeTokens();
    canonicalizeSize(this);

    if (this.built) {
      return;
    }

    this.built = true;

    const id = uniqueId('droplet-tooltip');

    // Encapsulate styles and markup inside a Shadow DOM so they don't leak out
    this.attachShadow({ mode: 'open' });

    this.shadowRoot!.innerHTML = `
      <style>${tooltipStyles}</style>

      <slot></slot>

      <div class="bubble" role="tooltip" id="${id}"><slot name="content"></slot></div>
    `;

    this.bubble      = this.shadowRoot!.querySelector('.bubble')!;
    this.contentSlot = this.shadowRoot!.querySelector('slot[name="content"]')!;

    this.syncText();

    this.addEventListener('pointerenter', this);
    this.addEventListener('pointerleave', this);
    this.addEventListener('focusin', this);
    this.addEventListener('focusout', this);

    // The description lands on the slotted trigger when it (re)arrives
    this.shadowRoot!.querySelector('slot:not([name])')!
      .addEventListener('slotchange', () => this.syncDescription());

    this.syncDescription();
  }

  // Lifecycle method: Called automatically when the element leaves the DOM
  disconnectedCallback (): void {
    this.hide();
  }

  // Lifecycle method: Fires when observed HTML attributes change dynamically
  attributeChangedCallback (name: string): void {
    switch (name) {
      case 'size':
        canonicalizeSize(this);
        this.reposition();
        break;

      case 'text':
        this.syncText();
        this.syncDescription();
        this.reposition();
        break;
    }
  }

  // Copy the text attribute into the bubble's content slot
  syncText (): void {
    if (this.contentSlot) {
      this.contentSlot.textContent = this.getAttribute('text') || '';
    }
  }

  // Content and size changes alter the bubble's dimensions. Re-anchor an
  // already-visible tooltip immediately instead of waiting for the next
  // pointer movement, scroll, or resize event.
  reposition (): void {
    if (!this.bubble?.hasAttribute('data-show')) {
      return;
    }

    const placement = (this.getAttribute('placement') as Placement | null) || 'top';

    placeAnchored(this, this.bubble, placement, 8);
  }

  /*
   * Expose the tooltip text as the trigger's accessible description.
   * An aria-describedby idref cannot point into this shadow root from the
   * light-DOM trigger, so the description is set via ARIA reflection
   * directly on the slotted element (skipped gracefully where unsupported).
   */
  syncDescription (): void {
    const trigger = this.querySelector(':scope > :not([slot])') || this.firstElementChild;

    if (trigger && 'ariaDescription' in trigger) {
      (trigger as HTMLElement).ariaDescription = this.getAttribute('text') || '';
    }
  }

  // Position the bubble over the trigger and fade it in
  show (): void {
    const placement = (this.getAttribute('placement') as Placement | null) || 'top';
    const bubble    = this.bubble;

    bubble.setAttribute('data-show', '');

    placeAnchored(this, bubble, placement, 8);

    this.untrack?.();
    this.untrack = trackAnchor(this, bubble, placement, 8); // follow the trigger on scroll

    document.addEventListener('keydown', this.onDocumentKey);

    springIn(bubble, 'center');
  }

  // Hide the bubble and stop tracking the trigger
  hide (): void {
    this.untrack?.();
    this.untrack = null;

    document.removeEventListener('keydown', this.onDocumentKey);

    this.bubble?.removeAttribute('data-show');
  }

  // Handle callback events
  handleEvent (event: Event): void {
    switch (event.type) {
      case 'pointerenter': this.show(); break;
      case 'focusin':      this.show(); break;
      case 'pointerleave': this.hide(); break;
      case 'focusout':     this.hide(); break;
    }
  }

}

export function defineTooltip (options: DefineOptions = {}): DefineResult {
  return defineStrict([[TAGS.tooltip, DropletTooltip]], options);
}

declare global {
  interface HTMLElementTagNameMap {
    'droplet-tooltip': DropletTooltip;
  }
}
