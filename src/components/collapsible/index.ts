/*
 * A bouncy disclosure section: a header button that springs its panel
 * open and closed, with proper expand/collapse semantics for assistive
 * technology and exactly one toggle event per state change
 */

import { canonicalizeSize }  from '../../utilities/index.js';
import { emit }              from '../../utilities/index.js';
import { uniqueId }          from '../../utilities/index.js';

import { ensureThemeTokens } from '../../theme/index.js';

import { HTMLElementBase }   from '../../element/base.js';

import collapsibleStyles     from './collapsible.css?inline';

/**
 * A bouncy disclosure section with a springy expand / collapse.
 *
 * @element jelly-collapsible
 *
 * @slot header - The clickable header content.
 * @slot - The collapsible panel content.
 *
 * @attr {boolean} open - Whether the panel is expanded.
 * @attr {"small"|"medium"|"large"} size - Padding / typography scale.
 *
 * @fires toggle - When the open state changes.
 *
 * @csspart header - The header button.
 */
export class JellyCollapsible extends HTMLElementBase {

  built = false;

  // Populated in connectedCallback()
  head!: HTMLButtonElement;

  // Tells the browser to trigger attributeChangedCallback when these attributes change
  static get observedAttributes (): string[] {
    return ['open', 'size'];
  }

  // Lifecycle method: Called automatically when the element is appended to the DOM
  connectedCallback (): void {
    ensureThemeTokens(this.ownerDocument);
    canonicalizeSize(this);

    if (this.built) {
      return;
    }

    this.built = true;

    const id = uniqueId('jelly-collapsible');

    // Encapsulate styles and markup inside a Shadow DOM so they don't leak out
    this.attachShadow({ mode: 'open', delegatesFocus: true });

    this.shadowRoot!.innerHTML = `
      <style>${collapsibleStyles}</style>

      <button class="head" part="header" id="${id}-header" aria-expanded="${this.hasAttribute('open')}" aria-controls="${id}-panel">
        <span class="label"><slot name="header">Details</slot></span>
        <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>
      </button>

      <div class="wrap">
        <div class="content" id="${id}-panel" role="region" aria-labelledby="${id}-header">
          <div class="inner"><slot></slot></div>
        </div>
      </div>
    `;

    this.head = this.shadowRoot!.querySelector('.head')!;
    this.head.addEventListener('click', () => this.toggle());
  }

  // Lifecycle method: Fires when observed HTML attributes change dynamically
  attributeChangedCallback (name: string): void {
    if (name === 'size') {
      canonicalizeSize(this);
      return;
    }

    this.head?.setAttribute('aria-expanded', String(this.hasAttribute('open')));
  }

  // Flip (or force) the open state; fires exactly one toggle per real change
  toggle (force?: boolean): void {
    const was  = this.hasAttribute('open');
    const next = force ?? !was;

    if (next === was) {
      return;
    }

    this.toggleAttribute('open', next);

    emit(this, 'toggle');
  }

  // The open state as a property
  get open (): boolean {
    return this.hasAttribute('open');
  }

  set open (value: boolean) {
    this.toggle(!!value);
  }

  // Route programmatic host focus onto the header button
  override focus (options?: FocusOptions): void {
    this.head?.focus(options);
  }

}

declare global {
  interface HTMLElementTagNameMap {
    'jelly-collapsible': JellyCollapsible;
  }
}
