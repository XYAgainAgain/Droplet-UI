import { placeAnchored }     from '../../anchor/index.js';
import { trackAnchor }       from '../../anchor/index.js';
import { springIn }          from '../../anchor/index.js';
import { springOut }         from '../../anchor/index.js';
import type { Placement }    from '../../anchor/index.js';

import { emit }              from '../../utilities/index.js';
import { canonicalizeSize }  from '../../utilities/index.js';

import { ensureThemeTokens } from '../../theme/index.js';
import { HTMLElementBase }   from '../../element/base.js';
import { defineStrict, TAGS } from '../../registry/index.js';
import type { DefineOptions, DefineResult } from '../../registry/index.js';

import popoverStyles         from './popover.css?inline';

/**
 * A click-triggered, non-modal floating panel anchored to its trigger.
 *
 * @element droplet-popover
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
export class DropletPopover extends HTMLElementBase {

  static define (options?: DefineOptions): DefineResult {
    return definePopover(options);
  }

  built = false;
  isOpen = false;

  panel!: HTMLElement;

  untrack: (() => void) | null = null;

  onDocumentPointer = (event: PointerEvent): void => {
    if (this.isOpen && !event.composedPath().includes(this)) {
      this.close();
    }
  };

  onDocumentKey = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && !event.defaultPrevented) {
      // Marks it handled so an enclosing dialog or drawer stays open
      event.preventDefault();
      this.close();
    }
  };

  static get observedAttributes (): string[] {
    return ['placement', 'size', 'label'];
  }

  connectedCallback (): void {
    ensureThemeTokens();
    canonicalizeSize(this);

    if (this.built) {
      return;
    }

    this.built = true;

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

  syncLabel (): void {
    const label = this.getAttribute('label');

    if (label) {
      this.panel?.setAttribute('aria-label', label);
    } else {
      this.panel?.removeAttribute('aria-label');
    }
  }

  get trigger (): HTMLElement {
    const slot = this.shadowRoot?.querySelector('slot[name="trigger"]') as HTMLSlotElement | null;

    return (slot?.assignedElements()[0] as HTMLElement | undefined) || this;
  }

  reflectTrigger (): void {
    const trigger = this.trigger;

    if (!trigger || trigger === this) {
      return;
    }

    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.setAttribute('aria-expanded', this.isOpen ? 'true' : 'false');
  }

  toggle (): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

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

    const focusable = this.querySelector<HTMLElement>(
      '[slot="content"] a, [slot="content"] button, [slot="content"] input, [slot="content"] [tabindex]',
    );

    (focusable || this.panel).focus({ preventScroll: true });

    emit(this, 'open');
  }

  place (): void {
    if (!this.panel) {
      return;
    }

    const placement = (this.getAttribute('placement') as Placement | null) || 'bottom';
    const anchor    = this.trigger;

    placeAnchored(anchor, this.panel, placement, 8);

    this.untrack?.();
    this.untrack = trackAnchor(anchor, this.panel, placement, 8, () => this.close({ returnFocus: false }));
  }

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

  override focus (options?: FocusOptions): void {
    this.trigger?.focus?.(options);
  }

}

export function definePopover (options: DefineOptions = {}): DefineResult {
  return defineStrict([[TAGS.popover, DropletPopover]], options);
}

declare global {
  interface HTMLElementTagNameMap {
    'droplet-popover': DropletPopover;
  }
}
