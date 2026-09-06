/*
 * A group controller for <jelly-collapsible> items. Add `single` so
 * opening one item bounces the others closed; `size` propagates to every
 * item that hasn't chosen its own
 */

import { canonicalizeSize }    from '../../utilities/index.js';
import { propagateSize }       from '../../utilities/index.js';

import { ensureThemeTokens }   from '../../theme/index.js';

import { defineElements, TAGS }  from '../../registry/index.js';
import { JellyCollapsible }      from '../collapsible/index.js';

import accordionStyles         from './accordion.css?inline';

/**
 * A group controller for `<jelly-collapsible>` items.
 *
 * @element jelly-accordion
 *
 * @slot - The `<jelly-collapsible>` items.
 *
 * @attr {boolean} single - Opening one item closes the others.
 * @attr {"small"|"medium"|"large"} size - Size propagated to the items.
 *
 * @fires toggle - Bubbles up from a child collapsible when it opens or closes.
 */
export class JellyAccordion extends HTMLElement {

  built = false;

  // Tells the browser to trigger attributeChangedCallback when these attributes change
  static get observedAttributes (): string[] {
    return ['single', 'size'];
  }

  // Lifecycle method: Called automatically when the element is appended to the DOM
  connectedCallback (): void {
    ensureThemeTokens();
    canonicalizeSize(this);

    if (this.built) {
      return;
    }

    this.built = true;

    // Encapsulate styles and markup inside a Shadow DOM so they don't leak out
    this.attachShadow({ mode: 'open', delegatesFocus: true });

    this.shadowRoot!.innerHTML = `
      <style>${accordionStyles}</style>

      <slot></slot>
    `;

    // Newly slotted items pick up the group size
    this.shadowRoot!.querySelector('slot')!.addEventListener('slotchange', () => {
      propagateSize(this, 'jelly-collapsible');
    });

    propagateSize(this, 'jelly-collapsible');

    // In single mode, opening one item closes its siblings
    this.addEventListener('toggle', (event) => {
      if (!this.hasAttribute('single')) {
        return;
      }

      const target = event.target as JellyCollapsible | null;

      if (!target || !target.matches('jelly-collapsible') || !target.open) {
        return;
      }

      for (const item of this.querySelectorAll('jelly-collapsible')) {
        if (item !== target && item.open) {
          item.toggle(false);
        }
      }
    });
  }

  // Lifecycle method: Fires when observed HTML attributes change dynamically
  attributeChangedCallback (name: string): void {
    if (name === 'size') {
      canonicalizeSize(this);
      propagateSize(this, 'jelly-collapsible');
    }

    // Turning single mode on collapses all but the first already-open item, so
    // the invariant holds immediately, not only on the next toggle
    if (name === 'single' && this.built && this.hasAttribute('single')) {
      let keptOpen = false;

      for (const item of this.querySelectorAll('jelly-collapsible')) {
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

  // Route programmatic host focus onto the first item
  override focus (options?: FocusOptions): void {
    this.querySelector('jelly-collapsible')?.focus(options);
  }

}

// Register the custom element
// The collapsible pilot no longer defines itself, and this component's markup needs it
defineElements([[TAGS.collapsible, JellyCollapsible]], { strict: false });

customElements.define('jelly-accordion', JellyAccordion);

declare global {
  interface HTMLElementTagNameMap {
    'jelly-accordion': JellyAccordion;
  }
}
