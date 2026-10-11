/*
 * A hairline separator. Horizontal by default; use direction="vertical"
 * for a column rule, or put text inside for a labelled divider
 */

import { canonicalizeSize }  from '../../utilities/index.js';
import { escapeHTML }        from '../../utilities/index.js';

import { ensureThemeTokens } from '../../theme/index.js';
import { HTMLElementBase }   from '../../element/base.js';
import { defineStrict, TAGS } from '../../registry/index.js';
import type { DefineOptions, DefineResult } from '../../registry/index.js';

import dividerStyles         from './divider.css?inline';

/**
 * A hairline separator, optionally labelled.
 *
 * @element droplet-divider
 *
 * @slot - Optional label text shown in the middle of the rule.
 *
 * @attr {"horizontal"|"vertical"} direction - Orientation of the rule.
 * @attr {string} content - Label text (alternative to slotted text).
 * @attr {"small"|"medium"|"large"} size - Label typography scale.
 *
 * @cssprop [--droplet-divider] - Line color.
 */
export class DropletDivider extends HTMLElementBase {

  static define (options?: DefineOptions): DefineResult {
    return defineDivider(options);
  }

  built = false;

  // Tells the browser to trigger attributeChangedCallback when these attributes change
  static get observedAttributes (): string[] {
    return ['direction', 'content', 'size'];
  }

  // Lifecycle method: Called automatically when the element is appended to the DOM
  connectedCallback (): void {
    ensureThemeTokens();
    canonicalizeSize(this);

    if (this.built) {
      return;
    }

    this.built = true;

    this.setAttribute('role', 'separator');

    // Encapsulate styles and markup inside a Shadow DOM so they don't leak out
    this.attachShadow({ mode: 'open' });

    this.render();
  }

  // Lifecycle method: Fires when observed HTML attributes change dynamically
  attributeChangedCallback (name: string): void {
    if (name === 'size') {
      canonicalizeSize(this);
    }

    if (this.built) {
      this.render();
    }
  }

  // The optional visible text: the content attribute, falling back to slotted
  // text. Exposed as `content` (matching the attribute); `label` stays as an
  // alias, though across the rest of the library `label` means the aria-label.
  get content (): string {
    return this.getAttribute('content') ?? (this.textContent ?? '').trim();
  }

  get label (): string {
    return this.content;
  }

  // Rebuild the line (or labelled line) for the current attributes
  render (): void {
    const vertical = this.getAttribute('direction') === 'vertical';
    const label    = this.label;

    if (vertical) {
      this.setAttribute('aria-orientation', 'vertical');
    } else {
      this.removeAttribute('aria-orientation');
    }

    this.shadowRoot!.innerHTML = `
      <style>${dividerStyles}</style>

      ${label
        ? `<div class="labelled${vertical ? ' vertical' : ''}"><span class="label">${escapeHTML(label)}</span></div>`
        : `<div class="line"></div>`}
    `;
  }

}

export function defineDivider (options: DefineOptions = {}): DefineResult {
  return defineStrict([[TAGS.divider, DropletDivider]], options);
}

declare global {
  interface HTMLElementTagNameMap {
    'droplet-divider': DropletDivider;
  }
}
