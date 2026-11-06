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

  dialog!: HTMLElement;
  wrap!: HTMLElement;

  prevFocus: Element | null = null;
  restorePortal: (() => void) | null = null;
  restoreInert: (() => void) | null = null;

  onDocumentKey = (event: KeyboardEvent): void => {
    // An inner overlay that handled Escape marks it defaultPrevented
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
    // Portaling disconnects and reconnects synchronously; only a real removal tears down
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

  // Mirrors the heading into aria-label because IDREFs can't cross the shadow boundary
  syncLabel (): void {
    const label   = this.getAttribute('label');
    const heading = this.querySelector('h1, h2, h3, [data-dialog-title]');

    if (label) {
      this.dialog.setAttribute('aria-label', label);
    } else if (heading) {
      this.dialog.setAttribute('aria-label', (heading.textContent ?? '').trim());
    }
  }

  afterOpen (): void {
    this.closing = false;

    this.dialog.getAnimations?.().forEach((animation) => animation.cancel());
    this.dialog.style.opacity   = '';
    this.dialog.style.transform = '';

    // Captured before portaling, which can collapse activeElement to <body>
    this.prevFocus     = document.activeElement;
    this.restorePortal = portalToBody(this);
    this.modalActive   = true;

    document.addEventListener('keydown', this.onDocumentKey);

    lockScroll();
    this.restoreInert = inertOutside(this);

    this.syncLabel();

    if (!prefersReducedMotion() && this.dialog.animate) {
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

  afterClose (): void {
    if (this.closing) {
      return;
    }

    this.teardownModal();
    (this.prevFocus as HTMLElement | null)?.focus?.();

    emit(this, 'close');
  }

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
