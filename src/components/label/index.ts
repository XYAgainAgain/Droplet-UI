import { canonicalizeSize }  from '../../utilities/index.js';

import { ensureThemeTokens } from '../../theme/index.js';
import { HTMLElementBase }   from '../../element/base.js';
import { defineStrict, isLibraryTag, TAGS } from '../../registry/index.js';
import type { DefineOptions, DefineResult } from '../../registry/index.js';

import labelStyles           from './label.css?inline';

/**
 * A form label that focuses its `for` target and gives it an accessible
 * name across shadow roots.
 *
 * @element droplet-label
 *
 * @slot - The label text.
 *
 * @attr {string} for - Id of the control this label names.
 * @attr {boolean} required - Show a required marker and set aria-required.
 * @attr {"small"|"medium"|"large"} size - Label typography scale.
 *
 * @csspart label - The label element.
 */
export class DropletLabel extends HTMLElementBase {

  static define (options?: DefineOptions): DefineResult {
    return defineLabel(options);
  }

  built = false;

  label!: HTMLLabelElement;

  static get observedAttributes (): string[] {
    return ['for', 'required', 'size'];
  }

  connectedCallback (): void {
    ensureThemeTokens();
    canonicalizeSize(this);

    if (this.built) {
      return;
    }

    this.built = true;

    this.attachShadow({ mode: 'open' });

    this.shadowRoot!.innerHTML = `
      <style>${labelStyles}</style>

      <label part="label">
        <slot></slot>
        <span class="required" aria-hidden="true">*</span>
        <span class="sr-required">(required)</span>
      </label>
    `;

    this.label = this.shadowRoot!.querySelector('label')!;

    this.label.addEventListener('click', () => this.focusTarget());

    // Late-slotted text should still reach the target's accessible name
    this.shadowRoot!.querySelector('slot')!.addEventListener('slotchange', () => this.sync());

    this.sync();
  }

  attributeChangedCallback (name: string): void {
    if (name === 'size') {
      canonicalizeSize(this);
    }

    if (this.built) {
      this.sync();
    }
  }

  // Resolve the `for` target in this label's own document/shadow root
  get target (): HTMLElement | null {
    const id = this.getAttribute('for');

    if (!id) {
      return null;
    }

    const root = this.getRootNode() as Document | ShadowRoot;

    return root.getElementById?.(id) ?? document.getElementById(id);
  }

  focusTarget (): void {
    this.target?.focus?.();
  }

  // Droplet form controls map `label` to an inner aria-label, which works across
  // shadow roots where aria-labelledby idrefs cannot
  sync (): void {
    const target = this.target;

    if (!target) {
      return;
    }

    const text = (this.textContent ?? '').trim();

    if (text && isLibraryTag(target.localName) && !target.hasAttribute('label')) {
      target.setAttribute('label', text);
    }

    if (this.hasAttribute('required')) {
      target.ariaRequired = 'true';
    }
  }

}

export function defineLabel (options: DefineOptions = {}): DefineResult {
  return defineStrict([[TAGS.label, DropletLabel]], options);
}

declare global {
  interface HTMLElementTagNameMap {
    'droplet-label': DropletLabel;
  }
}
