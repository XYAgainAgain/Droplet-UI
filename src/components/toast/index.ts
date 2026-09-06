/*
 * Toasts - bubbly notifications that pop in from the inline-end and
 * drift away. A <jelly-toaster> host is created automatically; place one
 * yourself (optionally with position="bottom") to control stacking.
 *
 *   import { jellyToast } from './src/jelly.js';
 *   jellyToast('Saved!', { tone: 'success' });
 */

import { toastIn }           from '../../anchor/index.js';
import { toastOut }          from '../../anchor/index.js';

import { jellyIcon }         from '../../icons/index.js';

import { ensureThemeTokens } from '../../theme/index.js';

import { installScopeBridge }               from '../../cascade/index.js';
import { defineElements, TAGS }             from '../../registry/index.js';
import type { DefineOptions, DefineResult } from '../../registry/index.js';
import type { Quality }                     from '../../resolve/index.js';

import { HTMLElementBase }   from '../../element/base.js';
import { PALETTE }           from '../../theme/index.js';

import { canonicalizeQualityAttribute } from '../../element/configure.js';
import { readQuality }                  from '../../element/configure.js';
import { replayProperties }             from '../../element/configure.js';
import { writeQuality }                 from '../../element/configure.js';

import toastStyles           from './toast.css?inline';

// The notification tones a toast can carry
export type ToastTone = 'info' | 'success' | 'warning' | 'danger';

// Options accepted by push() / jellyToast()
export interface ToastOptions {
  tone?: ToastTone;
  duration?: number;
}

const REPLAYED = ['quality'] as const;

// Dot color and spoken prefix for each tone (color is never the only signal)
const TONES: Record<ToastTone, { color: string; spoken: string }> = {
  info:    { color: `var(--jelly-color-background-azure, ${PALETTE['background-azure']})`, spoken: 'Info' },
  success: { color: `var(--jelly-color-background-mint,  ${PALETTE['background-mint']})`,  spoken: 'Success' },
  warning: { color: `var(--jelly-color-background-amber, ${PALETTE['background-amber']})`, spoken: 'Warning' },
  danger:  { color: `var(--jelly-color-background-rose,  ${PALETTE['background-rose']})`,  spoken: 'Error' },
};

/**
 * The toast host: stacks and animates transient notifications.
 *
 * @element jelly-toaster
 *
 * @attr {"top"|"bottom"} position - Which edge toasts stack from.
 * @attr {"low"|"medium"|"high"} quality - Rendering budget; inherited from `data-droplet-quality`.
 *
 * @csspart toast - A single toast.
 * @csspart dot - The tone indicator dot.
 * @csspart close - The dismiss button.
 */
export class JellyToaster extends HTMLElementBase {

  built = false;

  // Cancel functions for the toasts still counting down, keyed by toast element
  readonly #timers = new Map<Element, () => void>();

  #removals: MutationObserver | null = null;

  static get observedAttributes (): string[] {
    return ['quality'];
  }

  static define (options?: DefineOptions): DefineResult {
    return defineToaster(options);
  }

  // Lifecycle method: Called automatically when the element is appended to the DOM
  connectedCallback (): void {
    replayProperties(this, REPLAYED);

    ensureThemeTokens(this.ownerDocument);
    installScopeBridge(this.ownerDocument);
    canonicalizeQualityAttribute(this);

    if (this.built) {
      return;
    }

    this.built = true;

    // Encapsulate styles and markup inside a Shadow DOM so they don't leak out
    this.attachShadow({ mode: 'open' });

    this.shadowRoot!.innerHTML = `
      <style>${toastStyles}</style>

      <div class="rail" aria-live="polite"></div>
    `;

    // A toast the page removes itself must not leave a live timeout holding it
    this.#removals = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.removedNodes) {
          this.#cancelTimer(node as Element);
        }
      }
    });

    this.#removals.observe(this.shadowRoot!.querySelector('.rail')!, { childList: true });
  }

  adoptedCallback (): void {
    ensureThemeTokens(this.ownerDocument);
  }

  attributeChangedCallback (name: string): void {
    if (name === 'quality') {
      canonicalizeQualityAttribute(this);
    }
  }

  // The effective rendering budget: the element attribute beats any ancestor
  // scope. Phase 1 only reports it; nothing acts on it yet.
  get quality (): Quality {
    return readQuality(this);
  }

  set quality (value: Quality | string | null | undefined) {
    writeQuality(this, value);
  }

  // Add one toast; returns its element (click or timeout removes it)
  push (message: string, { tone = 'info', duration = 3500 }: ToastOptions = {}): HTMLElement {
    const toneInfo = TONES[tone] || TONES.info;
    const doc      = this.ownerDocument;
    const el       = doc.createElement('div');

    el.className = 'toast';
    el.setAttribute('part', 'toast');
    el.setAttribute('role', 'status');

    const dot = doc.createElement('span');

    dot.className        = 'dot';
    dot.setAttribute('part', 'dot');
    dot.style.background = toneInfo.color;
    dot.setAttribute('aria-hidden', 'true');

    const spoken = doc.createElement('span');

    spoken.className   = 'sr-tone';
    spoken.textContent = `${toneInfo.spoken}:`;

    const text = doc.createElement('span');

    text.className   = 'toast-text';
    text.textContent = String(message);

    const close = doc.createElement('button');

    close.className = 'close';
    close.setAttribute('part', 'close');
    close.setAttribute('aria-label', 'Dismiss');
    close.innerHTML = jellyIcon('dismiss', { size: 13 });

    el.append(dot, spoken, text, close);

    this.shadowRoot!.querySelector('.rail')!.appendChild(el);

    toastIn(el);

    const remove = (): void => {
      this.#cancelTimer(el);
      toastOut(el, () => el.remove());
    };

    if (duration > 0) {
      this.#armTimer(el, duration, remove);
    }

    // Click anywhere dismisses; the close button does too (and stops the click
    // from double-firing). Keyboard users tab to the button and press it.
    el.addEventListener('click', remove);
    close.addEventListener('click', (event) => { event.stopPropagation(); remove(); });

    return el;
  }

  // Auto-dismiss that holds still while the reader is on it: hover or focus
  // inside banks the remaining time, leaving both spends it again.
  #armTimer (el: HTMLElement, duration: number, expire: () => void): void {
    let remaining = duration;
    let startedAt = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let hovered = false;
    let focused = false;
    let settled = false;

    // Once the toast has expired or been dismissed its cancel handle is gone
    // from #timers, so a re-armed timeout would be unreachable and leak it.
    const start = (): void => {
      if (settled || timer !== undefined || hovered || focused) {
        return;
      }

      startedAt = performance.now();
      timer = setTimeout(() => {
        timer   = undefined;
        settled = true;
        expire();
      }, remaining);
    };

    const pause = (): void => {
      if (timer === undefined) {
        return;
      }

      remaining = Math.max(0, remaining - (performance.now() - startedAt));
      clearTimeout(timer);
      timer = undefined;
    };

    const resume = (): void => {
      if (!hovered && !focused && el.isConnected) {
        start();
      }
    };

    this.#timers.set(el, () => {
      settled = true;

      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }

      this.#timers.delete(el);
    });

    el.addEventListener('pointerenter', () => { hovered = true; pause(); });
    el.addEventListener('pointerleave', () => { hovered = false; resume(); });
    el.addEventListener('focusin', () => { focused = true; pause(); });

    el.addEventListener('focusout', (event) => {
      // Focus moving between the toast's own children is not a departure
      if (el.contains((event as FocusEvent).relatedTarget as Node | null)) {
        return;
      }

      focused = false;
      resume();
    });

    start();
  }

  #cancelTimer (el: Element): void {
    this.#timers.get(el)?.();
  }

}

export function defineToaster (options: DefineOptions = {}): DefineResult {
  return defineElements([[TAGS.toaster, JellyToaster]], { ...options, strict: options.strict ?? true });
}

// Show a toast, creating the shared toaster host on first use. The lookup is
// against the global document; per-document hosts are a Phase 7 iframe item.
export function jellyToast (message: string, options?: ToastOptions): HTMLElement {
  // Importing this module defines no tag, so the host is registered on use;
  // strict: false keeps a foreign owner of the tag from throwing out of a toast.
  if (typeof customElements !== 'undefined' && !customElements.get(TAGS.toaster)) {
    defineToaster({ strict: false });
  }

  let toaster = document.querySelector('jelly-toaster') as JellyToaster | null;

  if (!toaster) {
    toaster = document.createElement('jelly-toaster') as JellyToaster;
    document.body.appendChild(toaster);
  }

  return toaster.push(message, options);
}

// Convenience global so inline handlers can fire toasts
if (typeof window !== 'undefined') {
  window.jellyToast = jellyToast;
}

declare global {
  interface HTMLElementTagNameMap {
    'jelly-toaster': JellyToaster;
  }

  interface Window {
    jellyToast: typeof jellyToast;
  }
}
