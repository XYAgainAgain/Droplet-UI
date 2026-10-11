/*
 * A floating slide-in sheet with a springy overshoot. `side` accepts the
 * logical end (default) / start - which follow the reading direction -
 * plus physical right / left / bottom. The sheet sits inset from the
 * edges (so it reads as a floating panel) and wobbles into place.
 *
 *   <jelly-drawer id="d" side="end"><nav>…</nav></jelly-drawer>
 *   document.getElementById('d').open = true;
 */

import { lockScroll }           from '../../anchor/index.js';
import { unlockScroll }         from '../../anchor/index.js';
import { inertOutside }         from '../../anchor/index.js';
import { portalToBody }         from '../../anchor/index.js';

import { emit }                 from '../../utilities/index.js';
import { isRTL }                from '../../utilities/index.js';
import { prefersReducedMotion } from '../../utilities/index.js';

import { ensureThemeTokens }    from '../../theme/index.js';
import { HTMLElementBase }      from '../../element/base.js';
import { defineStrict, TAGS }   from '../../registry/index.js';
import type { DefineOptions, DefineResult } from '../../registry/index.js';

import drawerStyles             from './drawer.css?inline';

// Off-screen / overshoot / rest transforms for a physical side
interface SlideFrames {
  off: string;
  over: string;
  rest: string;
}

/**
 * A floating, modal slide-in drawer with a springy entrance.
 *
 * @element jelly-drawer
 *
 * @slot - The drawer's content.
 *
 * @attr {boolean} open - Whether the drawer is shown.
 * @attr {"end"|"start"|"right"|"left"|"bottom"} side - Which edge it slides from.
 * @attr {string} label - Accessible name (else the first heading is used).
 *
 * @fires open - When the drawer opens.
 * @fires close - When the drawer closes.
 *
 * @csspart backdrop - The dimmed backdrop.
 * @csspart sheet - The drawer surface.
 * @csspart close - The close button.
 *
 * @cssprop [--jelly-drawer-padding=22px] - Inner padding.
 * @cssprop [--jelly-drawer-radius=24px] - Corner radius.
 */
export class JellyDrawer extends HTMLElementBase {

  static define (options?: DefineOptions): DefineResult {
    return defineDrawer(options);
  }

  built = false;
  closing = false;
  modalActive = false;

  // Populated in connectedCallback()
  sheet!: HTMLElement;

  prevFocus: Element | null = null;
  restorePortal: (() => void) | null = null;
  restoreInert: (() => void) | null = null;

  onDocumentKey = (event: KeyboardEvent): void => {
    // An inner overlay that handled Escape first marks it defaultPrevented;
    // don't tear the drawer down in the same press
    if (event.key === 'Escape' && !event.defaultPrevented) {
      this.open = false;
    }
  };

  // Tells the browser to trigger attributeChangedCallback when these attributes change
  static get observedAttributes (): string[] {
    return ['open', 'label'];
  }

  // Lifecycle method: Called automatically when the element is appended to the DOM
  connectedCallback (): void {
    ensureThemeTokens();

    if (this.built) {
      return;
    }

    this.built = true;

    if (!this.hasAttribute('side')) {
      this.setAttribute('side', 'end');
    }

    // Encapsulate styles and markup inside a Shadow DOM so they don't leak out
    this.attachShadow({ mode: 'open', delegatesFocus: true });

    this.shadowRoot!.innerHTML = `
      <style>${drawerStyles}</style>

      <div class="backdrop" part="backdrop"></div>

      <div class="sheet" part="sheet" role="dialog" aria-modal="true" tabindex="-1">
        <button class="close" part="close" aria-label="Close">✕</button>
        <slot></slot>
      </div>
    `;

    this.sheet = this.shadowRoot!.querySelector('.sheet')!;

    this.shadowRoot!.querySelector('.backdrop')!.addEventListener('click', () => {
      this.open = false;
    });

    this.shadowRoot!.querySelector('.close')!.addEventListener('click', () => {
      this.open = false;
    });
  }

  // Lifecycle method: Called automatically when the element leaves the DOM
  disconnectedCallback (): void {
    // Portaling to <body> disconnects and reconnects synchronously, so only
    // clean up when the drawer is truly gone from the document while open
    queueMicrotask(() => {
      if (!this.isConnected && this.modalActive) {
        this.teardownModal();
      }
    });
  }

  // Lifecycle method: Fires when observed HTML attributes change dynamically
  attributeChangedCallback (name: string, was: string | null, now: string | null): void {
    if (!this.sheet || was === now) {
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

  // The accessible name: explicit label attribute, else the first heading
  syncLabel (): void {
    const label   = this.getAttribute('label');
    const heading = this.querySelector('h1, h2, h3, [data-drawer-title]');

    if (label) {
      this.sheet.setAttribute('aria-label', label);
    } else if (heading) {
      this.sheet.setAttribute('aria-label', (heading.textContent ?? '').trim());
    }
  }

  // Everything that happens when the open attribute arrives
  afterOpen (): void {
    this.closing = false;

    this.sheet.getAnimations?.().forEach((animation) => animation.cancel());
    this.sheet.style.opacity   = '';
    this.sheet.style.transform = '';

    // Capture the trigger before portaling; moving the host disconnects it
    // briefly and can otherwise collapse document.activeElement to <body>.
    this.prevFocus     = document.activeElement;
    this.restorePortal = portalToBody(this);
    this.modalActive   = true;

    document.addEventListener('keydown', this.onDocumentKey);

    // Trap focus + freeze the page behind the sheet
    lockScroll();
    this.restoreInert = inertOutside(this);

    this.syncLabel();
    this.slideIn();

    requestAnimationFrame(() => this.sheet.focus());

    emit(this, 'open');
  }

  // Everything that happens when the open attribute drops
  afterClose (): void {
    if (this.closing) {
      return;
    }

    this.teardownModal();
    (this.prevFocus as HTMLElement | null)?.focus?.(); // return focus to whatever opened it

    emit(this, 'close');
  }

  // Release every page-level effect the open drawer holds (idempotent)
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

  // The side attribute with start / end resolved against reading direction
  get resolvedSide (): 'right' | 'left' | 'bottom' {
    const side = this.getAttribute('side') || 'end';
    const rtl  = isRTL(this);

    if (side === 'start') {
      return rtl ? 'right' : 'left';
    }

    if (side === 'end') {
      return rtl ? 'left' : 'right';
    }

    return side === 'left' || side === 'bottom' ? side : 'right';
  }

  // Off-screen / overshoot transforms for the resolved physical side
  frames (): SlideFrames {
    const map: Record<'right' | 'left' | 'bottom', SlideFrames> = {
      right:  { off: 'translateX(115%)',  over: 'translateX(-1%)', rest: 'translateX(0)' },
      left:   { off: 'translateX(-115%)', over: 'translateX(1%)',  rest: 'translateX(0)' },
      bottom: { off: 'translateY(115%)',  over: 'translateY(-1%)', rest: 'translateY(0)' },
    };

    return map[this.resolvedSide] || map.right;
  }

  // Glide in and decelerate into place with a barely-there overshoot
  slideIn (): void {
    const sheet = this.sheet;

    if (prefersReducedMotion() || !sheet.animate) {
      return;
    }

    const m = this.frames();

    sheet.animate(
      [
        { transform: m.off, opacity: 0.5 },
        { transform: m.over, opacity: 1, offset: 0.78 },
        { transform: m.rest },
      ],
      { duration: 560, easing: 'cubic-bezier(.18,.84,.26,1)' },
    );
  }

  // Route programmatic host focus onto the sheet
  override focus (options?: FocusOptions): void {
    this.sheet?.focus(options);
  }

  // The open state as a property
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

    const sheet = this.sheet;

    if (prefersReducedMotion() || !sheet.animate) {
      this.removeAttribute('open');
      return;
    }

    // Let the slide-out play (the sheet stays visible until the attribute drops)
    const m = this.frames();

    this.closing = true;

    const animation = sheet.animate(
      [
        { transform: m.rest, opacity: 1 },
        { transform: m.off, opacity: 0.3 },
      ],
      { duration: 300, easing: 'cubic-bezier(.4,0,.7,.25)' },
    );

    const done = (): void => {
      if (!this.closing) {
        return;
      }

      this.closing = false;
      this.removeAttribute('open');
    };

    animation.onfinish = done;
    animation.oncancel = done;
  }

}

export function defineDrawer (options: DefineOptions = {}): DefineResult {
  return defineStrict([[TAGS.drawer, JellyDrawer]], options);
}

declare global {
  interface HTMLElementTagNameMap {
    'jelly-drawer': JellyDrawer;
  }
}
