/*
 * A modal dialog that springs in with a jello pop. While open it locks
 * the page scroll, inerts everything behind it, and returns focus where
 * it came from on close. Portaled to <body> so no ancestor can clip it.
 *
 *   <droplet-dialog id="d" label="Confirm"><h2>Title</h2><p>…</p></droplet-dialog>
 *   document.getElementById('d').open = true;   // or .showModal()
 */

import { lockScroll }           from '../../anchor/index.js';
import { unlockScroll }         from '../../anchor/index.js';
import { inertOutside }         from '../../anchor/index.js';
import { portalToBody }         from '../../anchor/index.js';
import { springOut }            from '../../anchor/index.js';

import { emit }                 from '../../utilities/index.js';
import { prefersReducedMotion } from '../../utilities/index.js';

import { ensureThemeTokens }    from '../../theme/index.js';
import { HTMLElementBase }      from '../../element/base.js';
import { defineStrict, TAGS }   from '../../registry/index.js';
import type { DefineOptions, DefineResult } from '../../registry/index.js';

import dialogStyles             from './dialog.css?inline';

/**
 * A modal dialog with scroll lock, focus trapping, and a spring-in entrance.
 *
 * @element droplet-dialog
 *
 * @slot - The dialog's content.
 *
 * @attr {boolean} open - Whether the dialog is shown.
 * @attr {string} label - Accessible name (else the first heading is used).
 *
 * @fires open - When the dialog opens.
 * @fires close - When the dialog closes.
 *
 * @csspart backdrop - The dimmed backdrop.
 * @csspart dialog - The dialog surface.
 *
 * @cssprop [--droplet-dialog-width=min(460px, 100%)] - Dialog width.
 * @cssprop [--droplet-dialog-radius=24px] - Corner radius.
 * @cssprop [--droplet-dialog-padding=26px] - Inner padding.
 */
export class DropletDialog extends HTMLElementBase {

  static define (options?: DefineOptions): DefineResult {
    return defineDialog(options);
  }

  built = false;
  closing = false;
  modalActive = false;

  // Populated in connectedCallback()
  dialog!: HTMLElement;
  wrap!: HTMLElement;

  prevFocus: Element | null = null;
  restorePortal: (() => void) | null = null;
  restoreInert: (() => void) | null = null;

  onDocumentKey = (event: KeyboardEvent): void => {
    // An inner overlay (select, menu, or popover) that handled Escape first
    // marks it defaultPrevented; don't tear the dialog down in the same press
    if (event.key === 'Escape' && !event.defaultPrevented) {
      this.open = false;
    }
  };

  static get observedAttributes (): string[] {
    return ['open', 'label'];
  }

  connectedCallback (): void {
    ensureThemeTokens();

    if (this.built) {
      return;
    }

    this.built = true;

    this.attachShadow({ mode: 'open', delegatesFocus: true });

    this.shadowRoot!.innerHTML = `
      <style>${dialogStyles}</style>

      <div class="backdrop" part="backdrop"></div>

      <div class="wrap">
        <div class="dialog" part="dialog" role="dialog" aria-modal="true" tabindex="-1">
          <button class="close" aria-label="Close">✕</button>
          <slot></slot>
        </div>
      </div>
    `;

    this.dialog = this.shadowRoot!.querySelector('.dialog')!;
    this.wrap   = this.shadowRoot!.querySelector('.wrap')!;

    // A click on the backdrop area (outside the dialog itself) dismisses
    this.wrap.addEventListener('click', (event) => {
      if (event.target === this.wrap) {
        this.open = false;
      }
    });

    this.shadowRoot!.querySelector('.close')!.addEventListener('click', () => {
      this.open = false;
    });
  }

  disconnectedCallback (): void {
    // Portaling to <body> disconnects and reconnects synchronously, so only
    // clean up when the dialog is truly gone from the document while open
    queueMicrotask(() => {
      if (!this.isConnected && this.modalActive) {
        this.teardownModal();
      }
    });
  }

  attributeChangedCallback (name: string, was: string | null, now: string | null): void {
    if (was === now || !this.dialog) {
      return;
    }

    if (name === 'label') {
      this.syncLabel();
      return;
    }

    if (this.hasAttribute('open')) {
      this.afterOpen();
    } else {
      this.afterClose();
    }
  }

  // An explicit label attribute wins; otherwise the first heading's text is mirrored
  // onto aria-label, since IDREFs can't cross the shadow boundary to slotted content
  syncLabel (): void {
    const label   = this.getAttribute('label');
    const heading = this.querySelector('h1, h2, h3, [data-dialog-title]');

    if (label) {
      this.dialog.setAttribute('aria-label', label);
    } else if (heading) {
      this.dialog.setAttribute('aria-label', (heading.textContent ?? '').trim());
    }
  }

  // Everything that happens when the open attribute arrives
  afterOpen (): void {
    this.closing = false;

    this.dialog.getAnimations?.().forEach((animation) => animation.cancel());
    this.dialog.style.opacity   = '';
    this.dialog.style.transform = '';

    // Capture the trigger before portaling; moving the host disconnects it
    // briefly and can otherwise collapse document.activeElement to <body>.
    this.prevFocus     = document.activeElement;
    this.restorePortal = portalToBody(this);
    this.modalActive   = true;

    document.addEventListener('keydown', this.onDocumentKey);

    // Trap focus: freeze the page scroll and make everything behind inert so
    // the tab order and screen readers stay inside the dialog
    lockScroll();
    this.restoreInert = inertOutside(this);

    this.syncLabel();

    if (!prefersReducedMotion() && this.dialog.animate) {
      // Rise gently while fading in, with a barely-there settle instead of a hard pop from tiny
      this.dialog.animate(
        [
          { opacity: 0, transform: 'translateY(12px) scale(0.97)' },
          { opacity: 1, offset: 0.55 },
          { transform: 'translateY(0) scale(1.004)', offset: 0.78 },
          { transform: 'translateY(0) scale(1)' },
        ],
        { duration: 500, easing: 'cubic-bezier(.16,.82,.28,1)' },
      );
    }

    this.dialog.focus();

    emit(this, 'open');
  }

  // Everything that happens when the open attribute drops
  afterClose (): void {
    if (this.closing) {
      return;
    }

    this.teardownModal();
    (this.prevFocus as HTMLElement | null)?.focus?.();

    emit(this, 'close');
  }

  // Release every page-level effect the open dialog holds (idempotent)
  teardownModal (): void {
    if (!this.modalActive) {
      return;
    }

    this.modalActive = false;

    document.removeEventListener('keydown', this.onDocumentKey);

    this.restoreInert?.();
    this.restoreInert = null;

    unlockScroll();

    this.restorePortal?.();
    this.restorePortal = null;
  }

  // Open the dialog (mirrors the native dialog API)
  showModal (): void {
    this.open = true;
  }

  override focus (options?: FocusOptions): void {
    this.dialog?.focus(options);
  }

  get open (): boolean {
    return this.hasAttribute('open');
  }

  set open (value: boolean) {
    if (value) {
      if (!this.hasAttribute('open')) {
        this.setAttribute('open', '');
      }
      return;
    }

    if (!this.hasAttribute('open')) {
      return;
    }

    // Animate the dialog out, then hide (the backdrop fades via CSS meanwhile)
    this.closing = true;

    springOut(this.dialog, () => {
      if (!this.closing) {
        return;
      }

      this.closing = false;
      this.removeAttribute('open');
    });
  }

}

export function defineDialog (options: DefineOptions = {}): DefineResult {
  return defineStrict([[TAGS.dialog, DropletDialog]], options);
}

declare global {
  interface HTMLElementTagNameMap {
    'droplet-dialog': DropletDialog;
  }
}
