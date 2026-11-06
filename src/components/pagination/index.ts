import { canonicalizeSize }  from '../../utilities/index.js';
import { emit }              from '../../utilities/index.js';
import { isRTL }             from '../../utilities/index.js';

import { ensureThemeTokens } from '../../theme/index.js';

import { DropletButton }          from '../button/index.js';
import { HTMLElementBase }   from '../../element/base.js';
import { defineStrict, TAGS } from '../../registry/index.js';
import type { DefineOptions, DefineResult } from '../../registry/index.js';

import paginationStyles      from './pagination.css?inline';

interface PageButtonOptions {
  current?: boolean;
  disabled?: boolean;
  name?: string | null;
}

/**
 * Page navigation built from soft-body buttons, with a windowed page list.
 *
 * @element droplet-pagination
 *
 * @attr {number} total - Total page count.
 * @attr {number} page - The current page (1-based).
 * @attr {"small"|"medium"|"large"} size - Button size.
 *
 * @fires change - With `detail.page` when the page changes.
 */
export class DropletPagination extends HTMLElementBase {

  static define (options?: DefineOptions): DefineResult {
    return definePagination(options);
  }

  built = false;

  row!: HTMLElement;
  onDirectionChange: () => void = () => this.render();

  static get observedAttributes (): string[] {
    return ['total', 'page', 'size'];
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
      <style>${paginationStyles}</style>

      <div class="row" role="navigation" aria-label="Pagination"></div>
    `;

    this.row = this.shadowRoot!.querySelector('.row')!;

    // Re-renders the direction-dependent arrows on a dir flip
    window.addEventListener('droplet-theme-change', this.onDirectionChange);

    this.render();
  }

  disconnectedCallback (): void {
    window.removeEventListener('droplet-theme-change', this.onDirectionChange);
  }

  attributeChangedCallback (name: string): void {
    if (name === 'size') {
      canonicalizeSize(this);
    }

    if (this.row) {
      this.render();
    }
  }

  get total (): number {
    return Math.max(1, parseInt(this.getAttribute('total') ?? '', 10) || 1);
  }

  get page (): number {
    return Math.min(this.total, Math.max(1, parseInt(this.getAttribute('page') ?? '', 10) || 1));
  }

  set page (value: number) {
    this.setAttribute('page', String(value));
  }

  get buttonSize (): string {
    return this.getAttribute('size') || 'small';
  }

  pagesToShow (): (number | '…')[] {
    const total = this.total;
    const cur   = this.page;
    const out: (number | '…')[] = [];
    const win   = 1;

    for (let p = 1; p <= total; p++) {
      if (p === 1 || p === total || (p >= cur - win && p <= cur + win)) {
        out.push(p);
      } else if (out[out.length - 1] !== '…') {
        out.push('…');
      }
    }

    return out;
  }

  go (page: number): void {
    if (page < 1 || page > this.total || page === this.page) {
      return;
    }

    this.page = page;

    emit(this, 'change', { page });
  }

  render (): void {
    const cur = this.page;
    const rtl = isRTL(this);

    const makeButton = (label: string, page: number, { current = false, disabled = false, name = null }: PageButtonOptions = {}): HTMLElement => {
      const button = document.createElement(TAGS.button);

      button.setAttribute('size', this.buttonSize);
      button.textContent = label;

      if (current) {
        button.setAttribute('aria-current', 'page');
      }

      if (disabled) {
        button.setAttribute('disabled', '');
      }

      if (name) {
        button.setAttribute('label', name);
      }

      button.addEventListener('click', () => this.go(page));

      return button;
    };

    const prevGlyph = rtl ? '›' : '‹';
    const nextGlyph = rtl ? '‹' : '›';

    this.row.textContent = '';

    this.row.appendChild(makeButton(prevGlyph, cur - 1, { disabled: cur === 1, name: 'Previous page' }));

    for (const p of this.pagesToShow()) {
      if (p === '…') {
        const gap = document.createElement('span');

        gap.className   = 'gap';
        gap.textContent = '…';
        gap.setAttribute('aria-hidden', 'true');

        this.row.appendChild(gap);
      } else {
        this.row.appendChild(makeButton(String(p), p, { current: p === cur }));
      }
    }

    this.row.appendChild(makeButton(nextGlyph, cur + 1, { disabled: cur === this.total, name: 'Next page' }));
  }

  override focus (options?: FocusOptions): void {
    const current = this.shadowRoot!.querySelector('[aria-current]') as HTMLElement | null;
    const first   = [...this.shadowRoot!.querySelectorAll(TAGS.button)].find((b) => !b.hasAttribute('disabled'));

    (current || first)?.focus(options);
  }

}

export function definePagination (options: DefineOptions = {}): DefineResult {
  return defineStrict([[TAGS.button, DropletButton], [TAGS.pagination, DropletPagination]], options);
}

declare global {
  interface HTMLElementTagNameMap {
    'droplet-pagination': DropletPagination;
  }
}
