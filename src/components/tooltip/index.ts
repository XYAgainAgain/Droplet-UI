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

  bubble!: HTMLElement;
  contentSlot!: HTMLSlotElement;

  untrack: (() => void) | null = null;

  // Escape dismisses without moving the pointer (WCAG 2.2 SC 1.4.13)
  onDocumentKey = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      this.hide();
    }
  };

  static get observedAttributes (): string[] {
    return ['text', 'size'];
  }

  connectedCallback (): void {
    ensureThemeTokens();
    canonicalizeSize(this);

    if (this.built) {
      return;
    }

    this.built = true;

    const id = uniqueId('droplet-tooltip');

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

    this.shadowRoot!.querySelector('slot:not([name])')!
      .addEventListener('slotchange', () => this.syncDescription());

    this.syncDescription();
  }

  disconnectedCallback (): void {
    this.hide();
  }

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

  syncText (): void {
    if (this.contentSlot) {
      this.contentSlot.textContent = this.getAttribute('text') || '';
    }
  }

  reposition (): void {
    if (!this.bubble?.hasAttribute('data-show')) {
      return;
    }

    const placement = (this.getAttribute('placement') as Placement | null) || 'top';

    placeAnchored(this, this.bubble, placement, 8);
  }

  // aria-describedby can't reach into this shadow root, so ARIA reflection sets it on the trigger
  syncDescription (): void {
    const trigger = this.querySelector(':scope > :not([slot])') || this.firstElementChild;

    if (trigger && 'ariaDescription' in trigger) {
      (trigger as HTMLElement).ariaDescription = this.getAttribute('text') || '';
    }
  }

  show (): void {
    const placement = (this.getAttribute('placement') as Placement | null) || 'top';
    const bubble    = this.bubble;

    bubble.setAttribute('data-show', '');

    placeAnchored(this, bubble, placement, 8);

    this.untrack?.();
    this.untrack = trackAnchor(this, bubble, placement, 8);

    document.addEventListener('keydown', this.onDocumentKey);

    springIn(bubble, 'center');
  }

  hide (): void {
    this.untrack?.();
    this.untrack = null;

    document.removeEventListener('keydown', this.onDocumentKey);

    this.bubble?.removeAttribute('data-show');
  }

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
