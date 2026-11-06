import { canonicalizeSize }  from '../../utilities/index.js';
import { emit }              from '../../utilities/index.js';
import { uniqueId }          from '../../utilities/index.js';

import { ensureThemeTokens } from '../../theme/index.js';

import { installScopeBridge }                 from '../../cascade/index.js';
import { defineStrict, TAGS }                 from '../../registry/index.js';
import type { DefineOptions, DefineResult }   from '../../registry/index.js';
import type { Quality }                       from '../../resolve/index.js';

import { HTMLElementBase }   from '../../element/base.js';

import { canonicalizeQualityAttribute } from '../../element/configure.js';
import { readNamedAxis }                from '../../element/configure.js';
import { readQuality }                  from '../../element/configure.js';
import { replayProperties }             from '../../element/configure.js';
import { writeNamedAxis }               from '../../element/configure.js';
import { writeQuality }                 from '../../element/configure.js';

import collapsibleStyles     from './collapsible.css?inline';

const REPLAYED = ['open', 'quality', 'palette', 'material'] as const;

/**
 * A bouncy disclosure section with a springy expand/collapse.
 *
 * @element droplet-collapsible
 *
 * @slot header - The clickable header content.
 * @slot - The collapsible panel content.
 *
 * @attr {boolean} open - Whether the panel is expanded.
 * @attr {"small"|"medium"|"large"} size - Padding and typography scale.
 * @attr {"low"|"medium"|"high"} quality - Rendering budget; inherited from `data-droplet-quality`.
 *
 * @fires toggle - Every time the panel actually opens or closes.
 *
 * @csspart header - The header button.
 */
export class DropletCollapsible extends HTMLElementBase {

  built = false;

  head!: HTMLButtonElement;

  readonly #internals: ElementInternals;

  // An `open` present at upgrade is initial state and fires no toggle, like <details>
  #upgradedOpen: boolean;

  constructor () {
    super();
    this.#internals = this.attachInternals();
    this.#upgradedOpen = this.hasAttribute('open');
  }

  static get observedAttributes (): string[] {
    return ['open', 'size', 'quality'];
  }

  static define (options?: DefineOptions): DefineResult {
    return defineCollapsible(options);
  }

  connectedCallback (): void {
    replayProperties(this, REPLAYED);

    ensureThemeTokens(this.ownerDocument);
    installScopeBridge(this.ownerDocument);
    canonicalizeSize(this);
    canonicalizeQualityAttribute(this);

    if (!this.built) {
      this.built = true;
      this.#build();
    }

    this.#syncOpen();
  }

  disconnectedCallback (): void {
    this.#internals.states.delete('open');
  }

  adoptedCallback (): void {
    ensureThemeTokens(this.ownerDocument);
  }

  attributeChangedCallback (name: string, previous: string | null, next: string | null): void {
    if (name === 'size') {
      canonicalizeSize(this);
      return;
    }

    if (name === 'quality') {
      canonicalizeQualityAttribute(this);
      return;
    }

    // Only presence changes are transitions
    if ((previous === null) === (next === null)) {
      return;
    }

    const initial = this.#upgradedOpen;
    this.#upgradedOpen = false;

    this.#syncOpen();

    if (!initial) {
      emit(this, 'toggle', { open: next !== null });
    }
  }

  toggle (force?: boolean): void {
    this.toggleAttribute('open', force ?? !this.open);
  }

  get open (): boolean {
    return this.hasAttribute('open');
  }

  set open (value: boolean) {
    this.toggleAttribute('open', !!value);
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

  override focus (options?: FocusOptions): void {
    this.head?.focus(options);
  }

  #build (): void {
    const id = uniqueId('droplet-collapsible');

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

  #syncOpen (): void {
    const open = this.hasAttribute('open');

    this.head?.setAttribute('aria-expanded', String(open));

    if (open) {
      this.#internals.states.add('open');
    } else {
      this.#internals.states.delete('open');
    }
  }

}

export function defineCollapsible (options: DefineOptions = {}): DefineResult {
  return defineStrict([[TAGS.collapsible, DropletCollapsible]], options);
}

declare global {
  interface HTMLElementTagNameMap {
    'droplet-collapsible': DropletCollapsible;
  }
}
