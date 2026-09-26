/*
 * A click-triggered floating jelly panel: non-modal, anchored to its
 * trigger, dismissed by Escape or clicking outside. Focus moves into the
 * panel on open and returns to the trigger on close.
 *
 *   <jelly-popover placement="bottom" label="Options">
 *     <jelly-button slot="trigger">Options</jelly-button>
 *     <div slot="content">Anything…</div>
 *   </jelly-popover>
 */

import { placeAnchored }     from '../../anchor/index.js';
import { trackAnchor }       from '../../anchor/index.js';
import { springIn }          from '../../anchor/index.js';
import { springOut }         from '../../anchor/index.js';
import type { Placement }    from '../../anchor/index.js';

import { emit }              from '../../utilities/index.js';
import { canonicalizeSize }  from '../../utilities/index.js';

import { ensureThemeTokens } from '../../theme/index.js';

import popoverStyles         from './popover.css?inline';

/**
 * A click-triggered, non-modal floating panel anchored to its trigger.
 *
 * @element jelly-popover
 *
 * @slot trigger - The element that toggles the panel.
 * @slot content - The panel's content.
 *
 * @attr {"top"|"bottom"|"left"|"right"|"start"|"end"} placement - Preferred side.
 * @attr {"small"|"medium"|"large"} size - Panel size.
 * @attr {string} label - Accessible name for the panel.
 *
 * @fires open - When the panel opens.
 * @fires close - When the panel closes.
 *
 * @csspart panel - The floating panel.
 */
export class JellyPopover extends HTMLElement {

  built = false;
  isOpen = false;

  // Populated in connectedCallback()
  panel!: HTMLElement;

  untrack: (() => void) | null = null;

  // Document-level dismissal, attached only while open
  onDocumentPointer = (event: PointerEvent): void => {
    if (this.isOpen && !event.composedPath().includes(this)) {
      this.close();
    }
  };

  onDocumentKey = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && !event.defaultPrevented) {
      // Mark it handled so an enclosing dialog/drawer doesn't also close
      event.preventDefault();
      this.close();
    }
  };

  // Tells the browser to trigger attributeChangedCallback when these attributes change
  static get observedAttributes (): string[] {
    return ['placement', 'size', 'label'];
  }

  // Lifecycle method: Called automatically when the element is appended to the DOM
  connectedCallback (): void {
    ensureThemeTokens();
    canonicalizeSize(this);

    if (this.built) {
      return;
    }

    this.built = true;

    // Encapsulate styles and markup inside a Shadow DOM so they don't leak out
    this.attachShadow({ mode: 'open', delegatesFocus: true });

    this.shadowRoot!.innerHTML = `
      <style>${popoverStyles}</style>

      <slot name="trigger"></slot>

      <div class="panel" part="panel" role="dialog" aria-modal="false" tabindex="-1"><slot name="content"></slot></div>
    `;

    this.panel = this.shadowRoot!.querySelector('.panel')!;

    const triggerSlot = this.shadowRoot!.querySelector('slot[name="trigger"]')!;

    triggerSlot.addEventListener('click', () => this.toggle());
    triggerSlot.addEventListener('slotchange', () => this.reflectTrigger());
    this.reflectTrigger();

    this.syncLabel();
  }

  // Lifecycle method: Called automatically when the element leaves the DOM
  disconnectedCallback (): void {
    if (this.isOpen) {
      this.isOpen = false;
      this.reflectTrigger();
      this.untrack?.();
      this.untrack = null;

      document.removeEventListener('pointerdown', this.onDocumentPointer, true);
      document.removeEventListener('keydown', this.onDocumentKey);

      this.panel?.removeAttribute('data-open');
    }
  }

  // Lifecycle method: Fires when observed HTML attributes change dynamically
  attributeChangedCallback (name: string): void {
    switch (name) {
      case 'size':
        canonicalizeSize(this);
        break;

      case 'label':
        this.syncLabel();
        break;
    }

    if (this.isOpen) {
      this.place();
    }
  }

  // The panel's accessible name comes from the label attribute
  syncLabel (): void {
    const label = this.getAttribute('label');

    if (label) {
      this.panel?.setAttribute('aria-label', label);
    } else {
      this.panel?.removeAttribute('aria-label');
    }
  }

  // The current trigger, resolved live from the slot (never stale)
  get trigger (): HTMLElement {
    const slot = this.shadowRoot?.querySelector('slot[name="trigger"]') as HTMLSlotElement | null;

    return (slot?.assignedElements()[0] as HTMLElement | undefined) || this;
  }

  // Mark the trigger as opening a dialog and mirror the open state onto it
  reflectTrigger (): void {
    const trigger = this.trigger;

    if (!trigger || trigger === this) {
      return;
    }

    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.setAttribute('aria-expanded', this.isOpen ? 'true' : 'false');
  }

  // Flip between open and closed
  toggle (): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  // Open the panel, move focus into it and start following the trigger
  open (): void {
    if (this.isOpen) {
      return;
    }

    this.isOpen = true;
    this.reflectTrigger();

    this.panel.setAttribute('data-open', '');
    this.place();

    springIn(this.panel, 'top center');

    document.addEventListener('pointerdown', this.onDocumentPointer, true);
    document.addEventListener('keydown', this.onDocumentKey);

    // Focus lands on the first focusable content, else the panel itself
    const focusable = this.querySelector<HTMLElement>(
      '[slot="content"] a, [slot="content"] button, [slot="content"] input, [slot="content"] [tabindex]',
    );

    (focusable || this.panel).focus({ preventScroll: true });

    emit(this, 'open');
  }

  // Anchor the panel to the trigger and keep it pinned on scroll
  place (): void {
    if (!this.panel) {
      return;
    }

    const placement = (this.getAttribute('placement') as Placement | null) || 'bottom';
    const anchor    = this.trigger;

    placeAnchored(anchor, this.panel, placement, 8);

    this.untrack?.();
    // Close on scroll-out WITHOUT returning focus - focusing the trigger would
    // scroll it back into view and undo the very dismissal we just triggered.
    this.untrack = trackAnchor(anchor, this.panel, placement, 8, () => this.close({ returnFocus: false }));
  }

  // Close the panel. Hands focus back to the trigger for a user-driven close
  // (Escape, click-outside, selection); scroll-out closes pass returnFocus:
  // false so the page doesn't jump back to the now-off-screen trigger.
  close ({ returnFocus = true }: { returnFocus?: boolean } = {}): void {
    if (!this.isOpen) {
      return;
    }

    this.isOpen = false;
    this.reflectTrigger();

    this.untrack?.();
    this.untrack = null;

    document.removeEventListener('pointerdown', this.onDocumentPointer, true);
    document.removeEventListener('keydown', this.onDocumentKey);

    springOut(this.panel, () => this.panel.removeAttribute('data-open'));

    if (returnFocus) {
      this.trigger?.focus?.();
    }

    emit(this, 'close');
  }

  // Route programmatic host focus onto the trigger
  override focus (options?: FocusOptions): void {
    this.trigger?.focus?.(options);
  }

}

// Register the custom element
customElements.define('jelly-popover', JellyPopover);

declare global {
  interface HTMLElementTagNameMap {
    'jelly-popover': JellyPopover;
  }
}
