// Light-DOM children supply each item's text and optional href; the last is the current page

import { canonicalizeSize }  from '../../utilities/index.js';
import { escapeHTML }        from '../../utilities/index.js';

import { ensureThemeTokens } from '../../theme/index.js';
import { HTMLElementBase }   from '../../element/base.js';
import { defineStrict, TAGS } from '../../registry/index.js';
import type { DefineOptions, DefineResult } from '../../registry/index.js';

import breadcrumbsStyles     from './breadcrumbs.css?inline';

/**
 * A breadcrumb trail built from light-DOM `<a>` or `<span>` children.
 *
 * @element droplet-breadcrumbs
 *
 * @slot - The trail items (the last one is the current page).
 *
 * @attr {"small"|"medium"|"large"} size - Typography scale.
 */
export class DropletBreadcrumbs extends HTMLElementBase {

  static define (options?: DefineOptions): DefineResult {
    return defineBreadcrumbs(options);
  }

  built = false;
  mutationObserver: MutationObserver | null = null;

  static get observedAttributes (): string[] {
    return ['size'];
  }

  connectedCallback (): void {
    ensureThemeTokens();
    canonicalizeSize(this);

    if (this.built) {
      return;
    }

    this.built = true;

    this.attachShadow({ mode: 'open', delegatesFocus: true });

    this.render();

    this.mutationObserver = new MutationObserver(() => this.render());
    this.mutationObserver.observe(this, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['href'] });
  }

  disconnectedCallback (): void {
    this.mutationObserver?.disconnect();
    this.mutationObserver = null;
  }

  attributeChangedCallback (name: string): void {
    if (name === 'size') {
      canonicalizeSize(this);
    }
  }

  render (): void {
    const children = [...this.children] as HTMLElement[];
    const items = children.map((child) => ({
      text: (child.textContent ?? '').trim(),
      href: child.getAttribute('href'),
    }));

    this.shadowRoot!.innerHTML = `
      <style>${breadcrumbsStyles}</style>

      <nav aria-label="Breadcrumb"><ol>${items
        .map((item, i) => {
          const last = i === items.length - 1;

          const node = last
            ? `<li class="current" aria-current="page">${escapeHTML(item.text)}</li>`
            : `<li><a href="${escapeHTML(item.href || '#')}">${escapeHTML(item.text)}</a></li>`;

          const sep = last ? '' : `<li class="separator" aria-hidden="true">›</li>`;

          return node + sep;
        })
        .join('')}</ol></nav>
    `;

    // The light-DOM sources stay hidden; the shadow trail is the rendering
    for (const child of children) {
      child.hidden = true;
    }
  }

  // Route programmatic host focus onto the first link
  override focus (options?: FocusOptions): void {
    this.shadowRoot?.querySelector('a')?.focus(options);
  }

}

export function defineBreadcrumbs (options: DefineOptions = {}): DefineResult {
  return defineStrict([[TAGS.breadcrumbs, DropletBreadcrumbs]], options);
}

declare global {
  interface HTMLElementTagNameMap {
    'droplet-breadcrumbs': DropletBreadcrumbs;
  }
}
