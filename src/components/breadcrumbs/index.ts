/*
 * A breadcrumb trail. Light-DOM children provide the items (text +
 * optional href); the last one is the current page. Links give a little
 * bounce on hover and the trail rebuilds itself when items change
 */

import { canonicalizeSize }  from '../../utilities/index.js';
import { escapeHTML }        from '../../utilities/index.js';

import { ensureThemeTokens } from '../../theme/index.js';
import { HTMLElementBase }   from '../../element/base.js';
import { defineStrict, TAGS } from '../../registry/index.js';
import type { DefineOptions, DefineResult } from '../../registry/index.js';

import breadcrumbsStyles     from './breadcrumbs.css?inline';

/**
 * A breadcrumb trail built from light-DOM `<a>` / `<span>` children.
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

  // Tells the browser to trigger attributeChangedCallback when these attributes change
  static get observedAttributes (): string[] {
    return ['size'];
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

    this.render();

    // Rebuild when the light-DOM items change (added, removed, renamed)
    this.mutationObserver = new MutationObserver(() => this.render());
    this.mutationObserver.observe(this, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['href'] });
  }

  // Lifecycle method: Called automatically when the element leaves the DOM
  disconnectedCallback (): void {
    this.mutationObserver?.disconnect();
    this.mutationObserver = null;
  }

  // Lifecycle method: Fires when observed HTML attributes change dynamically
  attributeChangedCallback (name: string): void {
    if (name === 'size') {
      canonicalizeSize(this);
    }
  }

  // Rebuild the trail from the current light-DOM children
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
