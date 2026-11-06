import { HTMLElementBase } from '../../element/base.js';
import { anyTag, defineStrict, TAGS } from '../../registry/index.js';
import type { DefineOptions, DefineResult } from '../../registry/index.js';

interface OptionParent extends HTMLElement {
  syncOptions?: () => void;
}

/**
 * Declarative option data for `<droplet-select>`. Hidden from layout.
 *
 * @element droplet-option
 *
 * @slot - The option's visible label.
 *
 * @attr {string} value - Submitted value (defaults to the trimmed text).
 * @attr {boolean} selected - Whether this option is initially selected.
 * @attr {boolean} disabled - Whether this option cannot be selected.
 */
export class DropletOption extends HTMLElementBase {

  static define (options?: DefineOptions): DefineResult {
    return defineOption(options);
  }

  static get observedAttributes (): string[] {
    return ['value', 'selected', 'disabled'];
  }

  get value (): string {
    return this.hasAttribute('value')
      ? this.getAttribute('value') ?? ''
      : (this.textContent ?? '').trim();
  }

  set value (value: string) {
    this.setAttribute('value', String(value));
  }

  get label (): string {
    return (this.textContent ?? '').trim();
  }

  get disabled (): boolean {
    return this.hasAttribute('disabled');
  }

  attributeChangedCallback (): void {
    (this.closest(anyTag('select')) as OptionParent | null)?.syncOptions?.();
  }

  connectedCallback (): void {
    this.style.display = 'none';
    (this.closest(anyTag('select')) as OptionParent | null)?.syncOptions?.();
  }

}

export function defineOption (options: DefineOptions = {}): DefineResult {
  return defineStrict([[TAGS.option, DropletOption]], options);
}

declare global {
  interface HTMLElementTagNameMap {
    'droplet-option': DropletOption;
  }
}
