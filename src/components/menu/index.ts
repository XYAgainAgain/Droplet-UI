import { placeAnchored }     from '../../anchor/index.js';
import { trackAnchor }       from '../../anchor/index.js';
import { springIn }          from '../../anchor/index.js';
import { springOut }         from '../../anchor/index.js';
import type { Placement }    from '../../anchor/index.js';

import { emit }              from '../../utilities/index.js';
import { canonicalizeSize }  from '../../utilities/index.js';

import { ensureThemeTokens } from '../../theme/index.js';
import { HTMLElementBase }   from '../../element/base.js';
import { anyTag, defineStrict, TAGS } from '../../registry/index.js';
import type { DefineOptions, DefineResult } from '../../registry/index.js';

import menuStyles            from './menu.css?inline';

/**
 * One declarative menu entry (value, disabled, danger). Rendered by the parent.
 *
 * @element droplet-menu-item
 *
 * @slot - The item's label content.
 *
 * @attr {string} value - Value reported in the select event (defaults to the text).
 * @attr {boolean} disabled - Whether this item cannot be picked.
 * @attr {boolean} danger - Style the item as a destructive action.
 */
export class DropletMenuItem extends HTMLElementBase {

  static define (options?: DefineOptions): DefineResult {
    return defineMenuItem(options);
  }

  get value (): string {
    return this.getAttribute('value') ?? (this.textContent ?? '').trim();
  }

  get disabled (): boolean {
    return this.hasAttribute('disabled');
  }

}

/**
 * A dropdown action menu with roving focus.
 *
 * @element droplet-menu
 *
 * @slot trigger - The menu button.
 * @slot - The `<droplet-menu-item>` entries.
 *
 * @attr {"top"|"bottom"|"left"|"right"|"start"|"end"} placement - Preferred side.
 * @attr {"small"|"medium"|"large"} size - Menu size.
 *
 * @fires open - When the menu opens.
 * @fires close - When the menu closes.
 * @fires select - With `detail.value` and `detail.item` when an item is picked.
 *
 * @csspart menu - The floating menu surface.
 */
export class DropletMenu extends HTMLElementBase {

  static define (options?: DefineOptions): DefineResult {
    return defineMenu(options);
  }

  built = false;
  isOpen = false;
  active = 0;

  menu!: HTMLElement;
  items: DropletMenuItem[] = [];

  untrack: (() => void) | null = null;

  onDocumentPointer = (event: PointerEvent): void => {
    if (this.isOpen && !event.composedPath().includes(this)) {
      this.close();
    }
  };

  static get observedAttributes (): string[] {
    return ['placement', 'size'];
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
      <style>${menuStyles}</style>

      <slot name="trigger"></slot>

      <div class="source"><slot></slot></div>

      <div class="menu" part="menu" role="menu"></div>
    `;

    this.menu = this.shadowRoot!.querySelector('.menu')!;

    const triggerSlot = this.shadowRoot!.querySelector('slot[name="trigger"]')!;

    triggerSlot.addEventListener('click', () => this.toggle());
    triggerSlot.addEventListener('slotchange', () => this.reflectTrigger());
    this.reflectTrigger();

    this.menu.addEventListener('click', (event) => this.pick(this.rowFrom(event)));
    this.menu.addEventListener('pointermove', (event) => this.highlight(this.rowFrom(event)));
    this.menu.addEventListener('keydown', (event) => this.onKey(event as KeyboardEvent));
  }

  disconnectedCallback (): void {
    if (this.isOpen) {
      this.isOpen = false;
      this.untrack?.();
      this.untrack = null;

      document.removeEventListener('pointerdown', this.onDocumentPointer, true);

      this.menu?.removeAttribute('data-open');
    }
  }

  attributeChangedCallback (name: string): void {
    if (name === 'size') {
      canonicalizeSize(this);
    }

    if (this.isOpen) {
      this.place();
    }
  }

  rowFrom (event: Event): HTMLElement | null {
    return (event.target as HTMLElement).closest('.item');
  }

  get trigger (): HTMLElement {
    const slot = this.shadowRoot?.querySelector('slot[name="trigger"]') as HTMLSlotElement | null;

    return (slot?.assignedElements()[0] as HTMLElement | undefined) || this;
  }

  reflectTrigger (): void {
    const trigger = this.trigger;

    if (!trigger || trigger === this) {
      return;
    }

    trigger.setAttribute('aria-haspopup', 'menu');
    trigger.setAttribute('aria-expanded', this.isOpen ? 'true' : 'false');
  }

  rows (): HTMLElement[] {
    return [...this.menu.querySelectorAll<HTMLElement>('.item')];
  }

  toggle (): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  // Re-reads items each open so added or removed entries show
  open (): void {
    if (this.isOpen) {
      return;
    }

    this.isOpen = true;
    this.reflectTrigger();
    this.items = [...this.querySelectorAll<DropletMenuItem>(anyTag('menuItem'))];

    this.menu.innerHTML = this.items
      .map((item, i) => `<div class="item" role="menuitem" tabindex="-1" data-i="${i}"
        ${item.disabled ? 'aria-disabled="true"' : ''} ${item.hasAttribute('danger') ? 'data-danger' : ''}>${item.innerHTML}</div>`)
      .join('');

    this.menu.setAttribute('data-open', '');

    this.place();
    springIn(this.menu, 'top center');

    document.addEventListener('pointerdown', this.onDocumentPointer, true);

    const rows  = this.rows();
    const first = rows.findIndex((row) => row.getAttribute('aria-disabled') !== 'true');

    this.active = Math.max(0, first);

    rows[this.active]?.focus({ preventScroll: true });

    emit(this, 'open');
  }

  place (): void {
    if (!this.menu) {
      return;
    }

    const anchor    = this.trigger;
    const placement = (this.getAttribute('placement') as Placement | null) || 'bottom';

    placeAnchored(anchor, this.menu, placement, 8);

    this.untrack?.();
    this.untrack = trackAnchor(anchor, this.menu, placement, 8, () => this.close({ returnFocus: false }));
  }

  close ({ returnFocus = true }: { returnFocus?: boolean } = {}): void {
    if (!this.isOpen) {
      return;
    }

    this.isOpen = false;
    this.reflectTrigger();

    this.untrack?.();
    this.untrack = null;

    document.removeEventListener('pointerdown', this.onDocumentPointer, true);

    springOut(this.menu, () => this.menu.removeAttribute('data-open'));

    if (returnFocus) {
      this.trigger?.focus?.();
    }

    emit(this, 'close');
  }

  highlight (row: HTMLElement | null): void {
    if (!row || row.getAttribute('aria-disabled') === 'true') {
      return;
    }

    this.active = Number(row.dataset.i);

    row.focus({ preventScroll: true });
  }

  pick (row: HTMLElement | null): void {
    if (!row || row.getAttribute('aria-disabled') === 'true') {
      return;
    }

    const item = this.items[Number(row.dataset.i)];

    if (!item) {
      return;
    }

    emit(this, 'select', { value: item.value, item });

    this.close();
  }

  onKey (event: KeyboardEvent): void {
    const rows = this.rows();

    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        this.close();
        break;

      case 'Tab':
        this.close();
        break;

      case 'ArrowDown':
        event.preventDefault();
        this.step(1);
        break;

      case 'ArrowUp':
        event.preventDefault();
        this.step(-1);
        break;

      case 'Home':
        event.preventDefault();
        this.step(1, -1);
        break;

      case 'End':
        event.preventDefault();
        this.step(-1, rows.length);
        break;

      case 'Enter':
      case ' ':
        event.preventDefault();
        this.pick(rows[this.active] ?? null);
        break;
    }
  }

  step (delta: number, from = this.active): void {
    const rows = this.rows();

    if (!rows.length) {
      return;
    }

    let i = from;

    for (let s = 0; s < rows.length; s++) {
      i = (i + delta + rows.length) % rows.length;

      if (rows[i]?.getAttribute('aria-disabled') !== 'true') {
        break;
      }
    }

    this.active = i;

    rows[i]?.focus({ preventScroll: true });
  }

  override focus (options?: FocusOptions): void {
    this.trigger?.focus?.(options);
  }

}

export function defineMenuItem (options: DefineOptions = {}): DefineResult {
  return defineStrict([[TAGS.menuItem, DropletMenuItem]], options);
}

export function defineMenu (options: DefineOptions = {}): DefineResult {
  return defineStrict([[TAGS.menuItem, DropletMenuItem], [TAGS.menu, DropletMenu]], options);
}

declare global {
  interface HTMLElementTagNameMap {
    'droplet-menu-item': DropletMenuItem;
    'droplet-menu': DropletMenu;
  }
}
