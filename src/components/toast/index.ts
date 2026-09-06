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

import { HTMLElementBase }   from '../../element/base.js';
import { PALETTE }           from '../../theme/index.js';

import toastStyles           from './toast.css?inline';

// The notification tones a toast can carry
export type ToastTone = 'info' | 'success' | 'warning' | 'danger';

// Options accepted by push() / jellyToast()
export interface ToastOptions {
  tone?: ToastTone;
  duration?: number;
}

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
 *
 * @csspart toast - A single toast.
 * @csspart dot - The tone indicator dot.
 * @csspart close - The dismiss button.
 */
export class JellyToaster extends HTMLElementBase {

  built = false;

  // Lifecycle method: Called automatically when the element is appended to the DOM
  connectedCallback (): void {
    ensureThemeTokens(this.ownerDocument);

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
  }

  // Add one toast; returns its element (click or timeout removes it)
  push (message: string, { tone = 'info', duration = 3500 }: ToastOptions = {}): HTMLElement {
    const toneInfo = TONES[tone] || TONES.info;
    const el       = document.createElement('div');

    el.className = 'toast';
    el.setAttribute('part', 'toast');
    el.setAttribute('role', 'status');

    const dot = document.createElement('span');

    dot.className        = 'dot';
    dot.setAttribute('part', 'dot');
    dot.style.background = toneInfo.color;
    dot.setAttribute('aria-hidden', 'true');

    const spoken = document.createElement('span');

    spoken.className   = 'sr-tone';
    spoken.textContent = `${toneInfo.spoken}:`;

    const text = document.createElement('span');

    text.className   = 'toast-text';
    text.textContent = String(message);

    const close = document.createElement('button');

    close.className = 'close';
    close.setAttribute('part', 'close');
    close.setAttribute('aria-label', 'Dismiss');
    close.innerHTML = jellyIcon('dismiss', { size: 13 });

    el.append(dot, spoken, text, close);

    this.shadowRoot!.querySelector('.rail')!.appendChild(el);

    toastIn(el);

    const remove = (): void => toastOut(el, () => el.remove());

    if (duration > 0) {
      setTimeout(remove, duration);
    }

    // Click anywhere dismisses; the close button does too (and stops the click
    // from double-firing). Keyboard users tab to the button and press it.
    el.addEventListener('click', remove);
    close.addEventListener('click', (event) => { event.stopPropagation(); remove(); });

    return el;
  }

}

// Show a toast, creating the shared toaster host on first use
export function jellyToast (message: string, options?: ToastOptions): HTMLElement {
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
