/*
 * A labeled container for <droplet-radio> items. The radios still group by
 * their shared `name`; this adds the radiogroup semantics, a legend linked
 * as the group's accessible name, the flow layout and size propagation to
 * the child radios. direction="vertical" stacks the items (the default is
 * horizontal)
 */

import { canonicalizeSize }  from '../../utilities/index.js';
import { propagateSize }     from '../../utilities/index.js';
import { uniqueId }          from '../../utilities/index.js';

import { ensureThemeTokens } from '../../theme/index.js';
import { HTMLElementBase }   from '../../element/base.js';
import { anyTag, defineStrict, TAGS } from '../../registry/index.js';
import type { DefineOptions, DefineResult } from '../../registry/index.js';
import { DropletRadio }        from '../radio/index.js';

import radioGroupStyles      from './radio-group.css?inline';

/**
 * A labelled container that gives its `<droplet-radio>` children radiogroup
 * semantics, a legend and shared sizing.
 *
 * @element droplet-radio-group
 *
 * @slot - The `<droplet-radio>` items.
 *
 * @attr {string} label - The group's legend / accessible name.
 * @attr {"horizontal"|"vertical"} direction - Item flow direction.
 * @attr {"small"|"medium"|"large"} size - Size propagated to the radios.
 *
 * @csspart legend - The legend text.
 * @csspart items - The radiogroup container.
 */
export class DropletRadioGroup extends HTMLElementBase {

  static define (options?: DefineOptions): DefineResult {
    return defineRadioGroup(options);
  }

  built = false;
  legendId = '';

  // Populated in build()
  legend!: HTMLElement;
  items!: HTMLElement;
  slotEl!: HTMLSlotElement;

  // Tells the browser to trigger attributeChangedCallback when these attributes change
  static get observedAttributes (): string[] {
    return ['label', 'direction', 'size'];
  }

  // Lifecycle method: Called automatically when the element is appended to the DOM
  connectedCallback (): void {
    ensureThemeTokens();
    canonicalizeSize(this);

    if (!this.built) {
      this.build();
    }

    this.syncLabel();
    propagateSize(this, anyTag('radio'));
  }

  // Render the shadow DOM once
  build (): void {
    this.built    = true;
    this.legendId = uniqueId('droplet-radio-group-legend');

    this.attachShadow({ mode: 'open' });

    this.shadowRoot!.innerHTML = `
      <style>${radioGroupStyles}</style>
      <div class="legend" part="legend" id="${this.legendId}"></div>
      <div class="items" part="items" role="radiogroup"><slot></slot></div>`;

    this.legend = this.shadowRoot!.querySelector('.legend')!;
    this.items  = this.shadowRoot!.querySelector('.items')!;
    this.slotEl = this.shadowRoot!.querySelector('slot')!;

    // Radios slotted in later still pick up the group's size
    this.slotEl.addEventListener('slotchange', () => propagateSize(this, anyTag('radio')));
  }

  // Lifecycle method: Fires when observed HTML attributes change dynamically
  attributeChangedCallback (name: string): void {
    if (!this.built) {
      return;
    }

    if (name === 'label') {
      this.syncLabel();
    } else if (name === 'size') {
      canonicalizeSize(this);
      propagateSize(this, anyTag('radio'));
    }
  }

  // Show the legend text and link it to the group as its accessible name
  syncLabel (): void {
    const label = this.getAttribute('label') || '';

    this.legend.textContent = label;

    if (label) {
      this.items.setAttribute('aria-labelledby', this.legendId);
    } else {
      this.items.removeAttribute('aria-labelledby');
    }
  }

}

export function defineRadioGroup (options: DefineOptions = {}): DefineResult {
  return defineStrict([[TAGS.radio, DropletRadio], [TAGS.radioGroup, DropletRadioGroup]], options);
}

declare global {
  interface HTMLElementTagNameMap {
    'droplet-radio-group': DropletRadioGroup;
  }
}
