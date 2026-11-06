import { canonicalizeSize }    from '../../utilities/index.js';
import { propagateSize }       from '../../utilities/index.js';

import { ensureThemeTokens }   from '../../theme/index.js';

import { DropletCollapsible }      from '../collapsible/index.js';
import { HTMLElementBase }     from '../../element/base.js';
import { anyTag, defineStrict, TAGS }  from '../../registry/index.js';
import type { DefineOptions, DefineResult } from '../../registry/index.js';

import accordionStyles         from './accordion.css?inline';

/**
 * A group controller for `<droplet-collapsible>` items.
 *
 * @element droplet-accordion
 *
 * @slot - The `<droplet-collapsible>` items.
 *
 * @attr {boolean} single - Opening one item closes the others.
 * @attr {"small"|"medium"|"large"} size - Size propagated to the items.
 *
 * @fires toggle - Bubbles up from a child collapsible when it opens or closes.
 */
export class DropletAccordion extends HTMLElementBase {

  static define (options?: DefineOptions): DefineResult {
    return defineAccordion(options);
  }

  built = false;

  static get observedAttributes (): string[] {
    return ['single', 'size'];
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
      <style>${accordionStyles}</style>

      <slot></slot>
    `;

    this.shadowRoot!.querySelector('slot')!.addEventListener('slotchange', () => {
      propagateSize(this, anyTag('collapsible'));
    });

    propagateSize(this, anyTag('collapsible'));

    this.addEventListener('toggle', (event) => {
      if (!this.hasAttribute('single')) {
        return;
      }

      const target = event.target as DropletCollapsible | null;

      if (!target || !target.matches(anyTag('collapsible')) || !target.open) {
        return;
      }

      for (const item of this.querySelectorAll<DropletCollapsible>(anyTag('collapsible'))) {
        if (item !== target && item.open) {
          item.toggle(false);
        }
      }
    });
  }

  attributeChangedCallback (name: string): void {
    if (name === 'size') {
      canonicalizeSize(this);
      propagateSize(this, anyTag('collapsible'));
    }

    // Turning single on closes all but the first open item at once
    if (name === 'single' && this.built && this.hasAttribute('single')) {
      let keptOpen = false;

      for (const item of this.querySelectorAll<DropletCollapsible>(anyTag('collapsible'))) {
        if (!item.open) {
          continue;
        }

        if (keptOpen) {
          item.toggle(false);
        } else {
          keptOpen = true;
        }
      }
    }
  }

  override focus (options?: FocusOptions): void {
    this.querySelector<DropletCollapsible>(anyTag('collapsible'))?.focus(options);
  }

}

export function defineAccordion (options: DefineOptions = {}): DefineResult {
  return defineStrict([[TAGS.collapsible, DropletCollapsible], [TAGS.accordion, DropletAccordion]], options);
}

declare global {
  interface HTMLElementTagNameMap {
    'droplet-accordion': DropletAccordion;
  }
}
