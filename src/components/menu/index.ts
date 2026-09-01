/*
 * A dropdown action menu with real roving focus: arrows move between
 * items, Home/End jump, Enter/Space picks, Escape closes and returns
 * focus to the trigger. Items are declarative light-DOM children and can
 * be added or removed at any time.
 *
 *   <jelly-menu>
 *     <jelly-button slot="trigger">Actions</jelly-button>
 *     <jelly-menu-item value="edit">Edit</jelly-menu-item>
 *     <jelly-menu-item value="del" danger>Delete</jelly-menu-item>
 *   </jelly-menu>
 */

import { placeAnchored }     from '../../anchor/index.js';
import { trackAnchor }       from '../../anchor/index.js';
import { springIn }          from '../../anchor/index.js';
import { springOut }         from '../../anchor/index.js';
import type { Placement }    from '../../anchor/index.js';

import { emit }              from '../../utilities/index.js';
import { canonicalizeSize }  from '../../utilities/index.js';

import { ensureThemeTokens } from '../../theme/index.js';

import menuStyles            from './menu.css?inline';

/**
 * One declarative menu entry (value, disabled, danger). Rendered by the parent.
 *
 * @element jelly-menu-item
 *
 * @slot - The item's label content.
 *
 * @attr {string} value - Value reported in the select event (defaults to the text).
 * @attr {boolean} disabled - Whether this item cannot be picked.
 * @attr {boolean} danger - Style the item as a destructive action.
 */
export class JellyMenuItem extends HTMLElement {

  // The value reported in the select event (falls back to the text)
  get value (): string {
    return this.getAttribute('value') ?? (this.textContent ?? '').trim();
  }

  // True when this item cannot be picked
  get disabled (): boolean {
    return this.hasAttribute('disabled');
  }

}

/**
 * A dropdown action menu with roving focus.
 *
 * @element jelly-menu
 *
 * @slot trigger - The menu button.
 * @slot - The `<jelly-menu-item>` entries.
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
export class JellyMenu extends HTMLElement {

  built = false;
  isOpen = false;
  active = 0;

  // Populated in connectedCallback() / open()
  menu!: HTMLElement;
  items: JellyMenuItem[] = [];

  untrack: (() => void) | null = null;

  // Document-level dismissal, attached only while open
  onDocumentPointer = (event: PointerEvent): void => {
    if (this.isOpen && !event.composedPath().includes(this)) {
      this.close();
    }
  };

  // Tells the browser to trigger attributeChangedCallback when these attributes change
  static get observedAttributes (): string[] {
    return ['placement', 'size'];
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
      <style>${menuStyles}</style>

      <slot name="trigger"></slot>

      <div class="source"><slot></slot></div>

      <div class="menu" part="menu" role="menu"></div>
    `;

    this.menu = this.shadowRoot!.querySelector('.menu')!;

    const triggerSlot = this.shadowRoot!.querySelector('slot[name="trigger"]')!;

    triggerSlot.addEventListener('click', () => this.toggle());
    // Keep the trigger's menu-button ARIA correct as it (re)assigns
    triggerSlot.addEventListener('slotchange', () => this.reflectTrigger());
    this.reflectTrigger();

    this.menu.addEventListener('click', (event) => this.pick(this.rowFrom(event)));
    this.menu.addEventListener('pointermove', (event) => this.highlight(this.rowFrom(event)));
    this.menu.addEventListener('keydown', (event) => this.onKey(event as KeyboardEvent));
  }

  // Lifecycle method: Called automatically when the element leaves the DOM
  disconnectedCallback (): void {
    if (this.isOpen) {
      this.isOpen = false;
      this.untrack?.();
      this.untrack = null;

      document.removeEventListener('pointerdown', this.onDocumentPointer, true);

      this.menu?.removeAttribute('data-open');
    }
  }

  // Lifecycle method: Fires when observed HTML attributes change dynamically
  attributeChangedCallback (name: string): void {
    if (name === 'size') {
      canonicalizeSize(this);
    }

    if (this.isOpen) {
      this.place();
    }
  }

  // The nearest rendered row for an event target, or null
  rowFrom (event: Event): HTMLElement | null {
    return (event.target as HTMLElement).closest('.item');
  }

  // The current trigger, resolved live from the slot
  get trigger (): HTMLElement {
    const slot = this.shadowRoot?.querySelector('slot[name="trigger"]') as HTMLSlotElement | null;

    return (slot?.assignedElements()[0] as HTMLElement | undefined) || this;
  }

  // Mark the trigger as a menu button and mirror the open state onto it, so
  // screen readers announce that it opens a menu and whether it is expanded
  reflectTrigger (): void {
    const trigger = this.trigger;

    if (!trigger || trigger === this) {
      return;
    }

    trigger.setAttribute('aria-haspopup', 'menu');
    trigger.setAttribute('aria-expanded', this.isOpen ? 'true' : 'false');
  }

  // The rendered rows currently in the menu
  rows (): HTMLElement[] {
    return [...this.menu.querySelectorAll<HTMLElement>('.item')];
  }

  // Flip between open and closed
  toggle (): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  /*
   * Open the menu: re-read the live light-DOM items (so dynamically added
   * entries always appear), render them as focusable rows, anchor to the
   * trigger and move focus to the first enabled row.
   */
  open (): void {
    if (this.isOpen) {
      return;
    }

    this.isOpen = true;
    this.reflectTrigger();
    this.items = [...this.querySelectorAll('jelly-menu-item')];

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

  // Anchor the menu to the trigger and keep it pinned on scroll
  place (): void {
    if (!this.menu) {
      return;
    }

    const anchor    = this.trigger;
    const placement = (this.getAttribute('placement') as Placement | null) || 'bottom';

    placeAnchored(anchor, this.menu, placement, 8);

    this.untrack?.();
    // Close on scroll-out WITHOUT returning focus - focusing the trigger would
    // scroll it back into view and undo the very dismissal we just triggered.
    this.untrack = trackAnchor(anchor, this.menu, placement, 8, () => this.close({ returnFocus: false }));
  }

  // Close the menu. Hands focus back to the trigger for a user-driven close
  // (Escape, click-outside, selection); scroll-out closes pass returnFocus:
  // false so the page doesn't jump back to the now-off-screen trigger.
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

  // Pointer hover mirrors the roving focus onto the hovered row
  highlight (row: HTMLElement | null): void {
    if (!row || row.getAttribute('aria-disabled') === 'true') {
      return;
    }

    this.active = Number(row.dataset.i);

    row.focus({ preventScroll: true });
  }

  // Pick a row: announce the selection and close
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

  // Menu keyboard: arrows rove, Home/End jump, Enter/Space picks, Escape/Tab close
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

  // Move the roving focus by delta (skipping disabled rows), wrapping around
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

  // Route programmatic host focus onto the trigger
  override focus (options?: FocusOptions): void {
    this.trigger?.focus?.(options);
  }

}

// Register the custom elements
customElements.define('jelly-menu-item', JellyMenuItem);
customElements.define('jelly-menu', JellyMenu);

declare global {
  interface HTMLElementTagNameMap {
    'jelly-menu-item': JellyMenuItem;
    'jelly-menu': JellyMenu;
  }
}
