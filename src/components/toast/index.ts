import { toastIn }           from '../../anchor/index.js';
import { toastOut }          from '../../anchor/index.js';

import { dropletIcon }         from '../../icons/index.js';

import { ensureThemeTokens } from '../../theme/index.js';

import { installScopeBridge }               from '../../cascade/index.js';
import { anyTag, defineStrict, TAGS }               from '../../registry/index.js';
import type { DefineOptions, DefineResult } from '../../registry/index.js';
import type { Quality }                     from '../../resolve/index.js';

import { HTMLElementBase }   from '../../element/base.js';
import { PALETTE }           from '../../theme/index.js';

import { canonicalizeQualityAttribute } from '../../element/configure.js';
import { readNamedAxis }                from '../../element/configure.js';
import { readQuality }                  from '../../element/configure.js';
import { replayProperties }             from '../../element/configure.js';
import { writeNamedAxis }               from '../../element/configure.js';
import { writeQuality }                 from '../../element/configure.js';

import toastStyles           from './toast.css?inline';

export type ToastTone = 'info' | 'success' | 'warning' | 'danger';

export interface ToastOptions {
  tone?: ToastTone;
  duration?: number;
}

const REPLAYED = ['quality', 'palette', 'material'] as const;

// The spoken prefix keeps color from being the only signal (WCAG 1.4.1)
const TONES: Record<ToastTone, { color: string; spoken: string }> = {
  info:    { color: `var(--jelly-color-background-azure, var(--droplet-color-background-azure, ${PALETTE['background-azure']}))`, spoken: 'Info' },
  success: { color: `var(--jelly-color-background-mint, var(--droplet-color-background-mint,  ${PALETTE['background-mint']}))`,  spoken: 'Success' },
  warning: { color: `var(--jelly-color-background-amber, var(--droplet-color-background-amber, ${PALETTE['background-amber']}))`, spoken: 'Warning' },
  danger:  { color: `var(--jelly-color-background-rose, var(--droplet-color-background-rose,  ${PALETTE['background-rose']}))`,  spoken: 'Error' },
};

/**
 * The toast host: stacks and animates transient notifications.
 *
 * @element droplet-toaster
 *
 * @attr {"top"|"bottom"} position - Which edge toasts stack from.
 * @attr {"low"|"medium"|"high"} quality - Rendering budget; inherited from `data-droplet-quality`.
 *
 * @csspart toast - A single toast.
 * @csspart dot - The tone indicator dot.
 * @csspart close - The dismiss button.
 */
export class DropletToaster extends HTMLElementBase {

  built = false;

  readonly #timers = new Map<Element, () => void>();

  #removals: MutationObserver | null = null;

  static get observedAttributes (): string[] {
    return ['quality'];
  }

  static define (options?: DefineOptions): DefineResult {
    return defineToaster(options);
  }

  connectedCallback (): void {
    replayProperties(this, REPLAYED);

    ensureThemeTokens(this.ownerDocument);
    installScopeBridge(this.ownerDocument);
    canonicalizeQualityAttribute(this);

    if (this.built) {
      return;
    }

    this.built = true;

    this.attachShadow({ mode: 'open' });

    this.shadowRoot!.innerHTML = `
      <style>${toastStyles}</style>

      <div class="rail" aria-live="polite"></div>
    `;

    // A toast the page removes must not leave a live timeout holding it
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

  get quality (): Quality {
    return readQuality(this);
  }

  set quality (value: Quality | string | null | undefined) {
    writeQuality(this, value);
  }

  get palette (): string | null {
    return readNamedAxis(this, 'palette');
  }

  set palette (value: string | null | undefined) {
    writeNamedAxis(this, 'palette', value);
  }

  get material (): string {
    return readNamedAxis(this, 'material') ?? 'matte';
  }

  set material (value: string | null | undefined) {
    writeNamedAxis(this, 'material', value);
  }

  // A click or the timeout removes the returned toast
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
    close.innerHTML = dropletIcon('dismiss', { size: 13 });

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

    el.addEventListener('click', remove);
    close.addEventListener('click', (event) => { event.stopPropagation(); remove(); });

    return el;
  }

  // Hover or focus inside banks the remaining time; leaving both spends it
  #armTimer (el: HTMLElement, duration: number, expire: () => void): void {
    let remaining = duration;
    let startedAt = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let hovered = false;
    let focused = false;
    let settled = false;

    // Once settled the cancel handle is gone, so a re-armed timeout would leak
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
  return defineStrict([[TAGS.toaster, DropletToaster]], options);
}

// Uses the global document's toaster, creating it on first use
export function dropletToast (message: string, options?: ToastOptions): HTMLElement {
  // Importing defines no tag; strict: false tolerates a foreign owner of the tag
  if (typeof customElements !== 'undefined' && !customElements.get(TAGS.toaster)) {
    defineToaster({ strict: false });
  }

  let toaster = document.querySelector(anyTag('toaster')) as DropletToaster | null;

  if (!toaster) {
    toaster = document.createElement(TAGS.toaster) as DropletToaster;
    document.body.appendChild(toaster);
  }

  return toaster.push(message, options);
}

if (typeof window !== 'undefined') {
  window.dropletToast = dropletToast;
  // Legacy Jelly UI alias
  window.jellyToast = dropletToast;
}

declare global {
  interface HTMLElementTagNameMap {
    'droplet-toaster': DropletToaster;
  }

  interface Window {
    dropletToast: typeof dropletToast;
    jellyToast: typeof dropletToast;
  }
}
