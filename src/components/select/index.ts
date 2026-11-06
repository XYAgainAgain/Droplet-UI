// The open panel sits in the top layer, so clipping and scrolling ancestors can't cut it off

import { DropletElement }     from '../../element/index.js';
import { FORM_ATTRIBUTES }    from '../../element/form-control.js';
import { FormControl }        from '../../element/form-control.js';
import type { RestoreState }  from '../../element/form-control.js';
import type { Shape }       from '../../element/index.js';
import type { Ring }        from '../../element/index.js';
import type { Border }      from '../../element/index.js';

import { DropletBody }        from '../../core/index.js';

import { canonicalizeSize } from '../../utilities/index.js';
import { clamp }            from '../../utilities/index.js';
import { emit }             from '../../utilities/index.js';
import { escapeHTML }       from '../../utilities/index.js';
import { triggerHaptic }    from '../../utilities/index.js';
import { uniqueId }         from '../../utilities/index.js';

import { FOCUS_RING }       from '../../theme/index.js';
import { PALETTE }          from '../../theme/index.js';
import { variantColors }    from '../../theme/index.js';

import '../option/index.js';
import { anyTag, defineStrict, TAGS } from '../../registry/index.js';
import type { DefineOptions, DefineResult } from '../../registry/index.js';
import { DropletOption }         from '../option/index.js';
import { readToken } from '../../theme/token-read.js';

import selectStyles         from './select.css?inline';

// px, inside the option list
const PANEL_PAD = 8;

// px, trigger to panel
const PANEL_MARGIN = 10;

// px
const PANEL_RADIUS = 20;

// px
const VIEWPORT_MARGIN = 8;

/**
 * A dropdown select built on the combobox/listbox pattern.
 *
 * @element droplet-select
 *
 * @slot - The `<droplet-option>` choices.
 *
 * @attr {string} value - The selected option's value.
 * @attr {string} label - Accessible name for the trigger.
 * @attr {string} placeholder - Text shown when nothing is selected.
 * @attr {string} name - Form field name submitted with the value.
 * @attr {boolean} required - Invalid (valueMissing) until an option is chosen.
 * @attr {boolean} disabled - Disable the control.
 * @attr {boolean} open - Reflects whether the option panel is open (set by the control).
 * @attr {"small"|"medium"|"large"} size - Control size.
 * @attr {"white"|"rose"|"amber"|"azure"|"mint"|"platinum"|"graphite"} variant - Accent hue.
 * @attr {string} color - Any CSS color for the fill or accent (beats intent and variant); text or a mark on it turns white or near-black, whichever reads better.
 * @attr {"accent"|"neutral"|"info"|"success"|"warning"|"danger"|"highlight"} intent - Semantic color role (never an ARIA role); beats variant.
 * @attr {string} feel - Registered feel preset driving the physics; inherits from a `data-droplet-feel` scope.
 * @attr {"low"|"medium"|"high"} quality - Caps physics cost (med/lo/hi aliases accepted); inherits from a `data-droplet-quality` scope.
 * @attr {string} material - Registered material preset: "matte" (the default) or "gloss" (Experimental); inherits from a `data-droplet-material` scope.
 * @attr {number} gloss - Sheen sharpness 0–1 for a lit material (Experimental); defaults to the material's sharpness.
 * @attr {number} softness - Feel knob 0–1: how far the surface gives under a press; unset keeps the feel preset's setting, and 0.5 is neutral.
 * @attr {number} bounce - Feel knob 0–1: how long it keeps wobbling before it settles; unset keeps the feel preset's setting, and 0.5 is neutral.
 * @attr {number} viscosity - Feel knob 0–1: how thick and slow it moves; unset keeps the feel preset's setting, and 0.5 is neutral.
 * @attr {number} spread - Feel knob 0–1: how far a dent travels around the edge; unset keeps the feel preset's setting, and 0.5 is neutral.
 * @attr {number} depth - Feel knob 0–1: how far it presses in and tilts; unset keeps the feel preset's setting, and 0.5 is neutral.
 * @attr {number} intensity - Feel knob 0–1: master gain on every push the surface takes; unset keeps the feel preset's setting, and 0.5 is neutral.
 *
 * @fires change - When the selection changes.
 *
 * @csspart trigger - The combobox button.
 * @csspart value - The selected-value text.
 * @csspart panel - The dropdown panel.
 * @csspart panel-mask - The clipped list surface.
 */
export class DropletSelect extends FormControl(DropletElement) {

  static define (options?: DefineOptions): DefineResult {
    return defineSelect(options);
  }

  static override usesResolver = true;

  static formAssociated = true;

  override internals: ElementInternals;

  isOpen        = false;
  focused       = false;
  activeIndex   = -1;
  selectedIndex = -1;
  options: DropletOption[] = [];
  instanceId: string;
  panelSide: 'top' | 'bottom' = 'bottom';

  openT              = 0;
  openTargetVelocity = 0;
  openTarget         = 0;

  trigger!: HTMLButtonElement;
  valueEl!: HTMLElement;
  panel!: HTMLElement;
  panelMask!: HTMLElement;
  panelCanvas!: HTMLCanvasElement;
  panelCtx!: CanvasRenderingContext2D;
  list!: HTMLElement;

  panelBody: DropletBody | null = null;
  panelCssW = 0;
  panelCssH = 0;

  mutationObserver: MutationObserver | null = null;
  reflectingValue = false;

  typeaheadBuffer = '';
  typeaheadTimer: ReturnType<typeof setTimeout> | undefined;

  visibilityObserver: IntersectionObserver | null = null;
  reposition = (): void => this.placePanel();

  static get observedAttributes (): string[] {
    return ['disabled', 'label', 'placeholder', 'size', 'value', ...DropletElement.AXIS_ATTRIBUTES, ...FORM_ATTRIBUTES];
  }

  constructor () {
    super();

    this.internals  = this.attachInternals();
    this.instanceId = uniqueId('droplet-select');
  }

  override styles (): string {
    return selectStyles + variantColors({ color: '--droplet-accent' });
  }

  override content (): string {
    return `
      <button class="trigger" part="trigger" type="button" role="combobox"
              aria-haspopup="listbox" aria-expanded="false"
              aria-controls="${this.instanceId}-list">
        <span class="value placeholder" part="value"></span>
        <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      <div class="panel" part="panel" data-side="bottom" popover="manual">
        <canvas class="panel-canvas" aria-hidden="true"></canvas>
        <div class="panel-mask" part="panel-mask">
          <ul class="list" id="${this.instanceId}-list" role="listbox" tabindex="-1"></ul>
        </div>
      </div>
      <slot style="display:none"></slot>`;
  }

  // Inset so the wobble stays inside the host
  override shape (width: number, height: number): Shape {
    const w = width - 8;
    const h = height - 8;

    const declared = parseFloat(readToken(getComputedStyle(this), 'select-radius'));
    const radius   = Number.isFinite(declared) ? Math.min(declared, h / 2) : Math.min(16, h / 2);

    return { width: w, height: h, radius };
  }

  override onBuilt (): void {
    this.trigger     = this.shadowRoot!.querySelector('.trigger')!;
    this.valueEl     = this.shadowRoot!.querySelector('.value')!;
    this.panel       = this.shadowRoot!.querySelector('.panel')!;
    this.panelMask   = this.shadowRoot!.querySelector('.panel-mask')!;
    this.panelCanvas = this.shadowRoot!.querySelector('.panel-canvas')!;
    this.panelCtx    = this.panelCanvas.getContext('2d')!;
    this.list        = this.shadowRoot!.querySelector('.list')!;

    this.trigger.disabled = this.isDisabled;
    this.syncLabel();
    this.useHostFocusTarget(this.trigger);

    this.trigger.addEventListener('pointerdown',   this);
    this.trigger.addEventListener('pointerup',     this);
    this.trigger.addEventListener('pointercancel', this);
    this.trigger.addEventListener('pointerleave',  this);
    this.trigger.addEventListener('click',         this);
    this.trigger.addEventListener('keydown',       this);
    this.trigger.addEventListener('focus',         this);
    this.trigger.addEventListener('blur',          this);

    this.list.addEventListener('pointermove', this);
    this.list.addEventListener('click',       this);

    this.mutationObserver = new MutationObserver(() => this.syncOptions());
    this.mutationObserver.observe(this, { childList: true, subtree: true, characterData: true });

    this.syncOptions();
  }

  override connectedCallback (): void {
    const rebuilt = this.built;

    if (this.authoredValue === undefined) {
      this.authoredValue = this.getAttribute('value');
    }

    super.connectedCallback();

    if (rebuilt && this.mutationObserver) {
      this.mutationObserver.observe(this, { childList: true, subtree: true, characterData: true });
      this.syncOptions();
    }
  }

  override disconnectedCallback (): void {
    super.disconnectedCallback();

    this.mutationObserver?.disconnect();
    document.removeEventListener('pointerdown', this, true);
    this.unwatchViewport();

    // A re-insert starts closed
    if (this.isOpen) {
      this.isOpen             = false;
      this.openTarget         = 0;
      this.openT              = 0;
      this.openTargetVelocity = 0;

      this.removeAttribute('open');
      this.trigger?.setAttribute('aria-expanded', 'false');
      this.trigger?.removeAttribute('aria-activedescendant');
    }
  }

  handleEvent (event: Event): void {
    // The capture-phase document listener: outside presses close the panel
    if (event.currentTarget === document) {
      if (this.isOpen && !event.composedPath().includes(this)) {
        this.close();
      }

      return;
    }

    const fromList = event.currentTarget === this.list;

    switch (event.type) {
      case 'pointerdown':   this.pressTrigger(event as PointerEvent); break;
      case 'pointerup':
      case 'pointercancel':
      case 'pointerleave':  this.releaseBody();                       break;
      case 'pointermove':   this.onRowHover(event as PointerEvent);   break;
      case 'keydown':       this.onTriggerKey(event as KeyboardEvent); break;
      case 'focus':         this.setFocused(true);                    break;
      case 'blur':          this.setFocused(false);                   break;
      case 'click':
        if (fromList) this.onRowClick(event as MouseEvent);
        else          this.toggle();
        break;
    }
  }

  pressTrigger (event: PointerEvent): void {
    if (this.isDisabled) {
      return;
    }

    this.pressAt(event.clientX, event.clientY, 0.9);
  }

  setFocused (focused: boolean): void {
    this.focused = focused;
    this.requestFrame();
  }

  syncOptions (): void {
    if (!this.list) {
      return;
    }

    this.options = [...this.querySelectorAll<DropletOption>(anyTag('option'))];

    for (const option of this.options) {
      if (!this.authoredSelected.has(option)) this.authoredSelected.set(option, option.hasAttribute('selected'));
    }

    const valueAttr    = this.getAttribute('value');
    const hasValueAttr = valueAttr != null && valueAttr !== '';

    let selectedIndex = -1;

    this.options.forEach((opt, i) => {
      if (hasValueAttr ? opt.value === valueAttr : opt.hasAttribute('selected')) {
        selectedIndex = i;
      }
    });

    this.selectedIndex = selectedIndex;

    this.list.innerHTML = this.options
      .map((opt, i) => {
        const selected = i === this.selectedIndex;

        return `
          <li class="row" id="${this.instanceId}-opt${i}" role="option" data-index="${i}"
              aria-selected="${selected}" ${opt.disabled ? 'aria-disabled="true"' : ''}>
            <span class="row-label">${escapeHTML(opt.label)}</span>
            <svg class="tick" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M5 13l4 4 10-11" />
            </svg>
          </li>`;
      })
      .join('');

    this.renderValue();
    this.sizePanel();
  }

  renderValue (): void {
    const selected = this.options[this.selectedIndex];


    if (selected) {
      this.valueEl.textContent = selected.label;
      this.valueEl.classList.remove('placeholder');
      this.internals.setFormValue(selected.value);
      this.updateValidity();
    } else {
      this.valueEl.textContent = this.getAttribute('placeholder') || 'Select…';
      this.valueEl.classList.add('placeholder');
      this.internals.setFormValue(null);
      this.updateValidity();
    }
  }

  sizePanel (): void {
    const rect   = this.getBoundingClientRect();
    const width  = rect.width || 240;
    const rows   = Math.min(this.options.length, 6);
    const rowH   = this.rowHeight;
    const height = rows * rowH + PANEL_PAD * 2;

    this.panel.style.width  = `${width}px`;
    this.panel.style.height = `${height}px`;

    const pad  = 16;
    const cssW = width + pad * 2;
    const cssH = height + pad * 2;
    const dpr  = Math.min(window.devicePixelRatio || 1, 3);

    this.panelCssW = cssW;
    this.panelCssH = cssH;

    this.panelCanvas.style.width  = `${cssW}px`;
    this.panelCanvas.style.height = `${cssH}px`;
    this.panelCanvas.style.left   = `${width / 2}px`;
    this.panelCanvas.style.top    = `${height / 2}px`;
    this.panelCanvas.width        = Math.round(cssW * dpr);
    this.panelCanvas.height       = Math.round(cssH * dpr);

    this.panelCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (!this.panelBody) {
      this.panelBody = this.createBody({ width, height, radius: PANEL_RADIUS });
    } else {
      this.panelBody.resize(width, height, PANEL_RADIUS);
    }
  }

  // The panel paints on a separate canvas, so lights need its rect too
  override lightCanvases (): HTMLCanvasElement[] {
    return this.panelCanvas ? [...super.lightCanvases(), this.panelCanvas] : super.lightCanvases();
  }

  // px
  get rowHeight (): number {
    return parseFloat(readToken(getComputedStyle(this), 'select-row-height')) || 44;
  }

  // The flip rule of placeAnchored(); data-side tells the CSS and frame() which way to unfold
  placePanel (): void {
    const rect   = this.getBoundingClientRect();
    const height = parseFloat(this.panel.style.height) || this.panel.offsetHeight || 0;

    const clipsBelow = rect.bottom + PANEL_MARGIN + height > window.innerHeight - VIEWPORT_MARGIN;
    const fitsAbove  = rect.top - PANEL_MARGIN - height > 0;

    this.panelSide = clipsBelow && fitsAbove ? 'top' : 'bottom';
    this.panel.setAttribute('data-side', this.panelSide);

    // The panel moved, so any cached rect is stale
    this.lightRects.delete(this.panelCanvas);

    // The top layer is viewport-fixed, so the panel needs real coordinates
    if (this.panelInTopLayer()) {
      const top = this.panelSide === 'top' ? rect.top - PANEL_MARGIN - height : rect.bottom + PANEL_MARGIN;

      this.panel.style.left = `${rect.left}px`;
      this.panel.style.top  = `${top}px`;
    }
  }

  // Guarded: without the Popover API, :popover-open is an invalid selector
  panelInTopLayer (): boolean {
    return typeof this.panel?.showPopover === 'function' && this.panel.matches(':popover-open');
  }

  // If showing fails, dropping popover falls back to absolute positioning under the host
  showPanelLayer (): void {
    if (typeof this.panel.showPopover !== 'function' || this.panelInTopLayer()) {
      return;
    }

    try {
      this.panel.showPopover();
    } catch {
      this.panel.removeAttribute('popover');
      this.panel.style.left = '';
      this.panel.style.top  = '';
    }
  }

  hidePanelLayer (): void {
    if (this.panelInTopLayer()) {
      this.panel.hidePopover();
    }
  }

  watchViewport (): void {
    window.addEventListener('scroll', this.reposition, true);
    window.addEventListener('resize', this.reposition);

    // A clipped-away trigger has nothing to fold into, so the panel goes at once
    this.visibilityObserver = new IntersectionObserver((entries) => {
      if (this.isOpen && entries.some((entry) => !entry.isIntersecting)) {
        this.close();

        this.openT              = 0;
        this.openTargetVelocity = 0;
        this.hidePanelLayer();
      }
    });
    this.visibilityObserver.observe(this);
  }

  unwatchViewport (): void {
    window.removeEventListener('scroll', this.reposition, true);
    window.removeEventListener('resize', this.reposition);

    this.visibilityObserver?.disconnect();
    this.visibilityObserver = null;
  }

  toggle (): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.openPanel();
    }
  }

  openPanel (): void {
    if (this.isOpen || !this.options.length || !this.isConnected) {
      return;
    }

    this.sizePanel();
    this.showPanelLayer();
    this.placePanel();
    this.watchViewport();

    this.isOpen = true;
    this.setAttribute('open', '');
    this.trigger.setAttribute('aria-expanded', 'true');

    this.activeIndex = this.selectedIndex >= 0 ? this.selectedIndex : 0;
    this.renderActive();

    this.openTarget = 1;

    if (!this.reducedMotion && this.panelBody) {
      const edge = this.panelSide === 'top'
        ? this.panelBody.height / 2
        : -this.panelBody.height / 2;

      this.panelBody.centerPop(1.2);
      this.panelBody.pulseAt(0, edge, 0.8);
    }

    document.addEventListener('pointerdown', this, true);
    triggerHaptic();
    this.requestFrame();
  }

  close (): void {
    if (!this.isOpen) {
      return;
    }

    this.isOpen     = false;
    this.openTarget = 0;

    this.removeAttribute('open');
    this.trigger.setAttribute('aria-expanded', 'false');
    this.trigger.removeAttribute('aria-activedescendant');

    document.removeEventListener('pointerdown', this, true);
    this.unwatchViewport();

    // A close from scrolling away must not drag the trigger back into view
    this.trigger.focus({ preventScroll: true });
    this.requestFrame();
  }

  renderActive (): void {
    const rows = [...this.list.children] as HTMLElement[];

    rows.forEach((row, i) => row.classList.toggle('active', i === this.activeIndex));

    const active = rows[this.activeIndex];

    if (active) {
      this.trigger.setAttribute('aria-activedescendant', active.id);
      active.scrollIntoView({ block: 'nearest' });
    }
  }

  moveActive (delta: number): void {
    const n = this.options.length;

    if (!n) {
      return;
    }

    let i = this.activeIndex;

    for (let step = 0; step < n; step++) {
      i = (i + delta + n) % n;

      if (!this.options[i]?.disabled) {
        break;
      }
    }

    this.activeIndex = i;
    this.renderActive();
  }

  selectIndex (index: number): void {
    const opt = this.options[index];

    if (!opt || opt.disabled) {
      return;
    }

    this.options.forEach((o) => o.removeAttribute('selected'));
    opt.setAttribute('selected', '');

    this.selectedIndex = index;
    this.reflectValue(opt.value);

    ([...this.list.children] as HTMLElement[]).forEach((row, i) => row.setAttribute('aria-selected', String(i === index)));

    this.renderValue();
    this.close();
    triggerHaptic();
    emit(this, 'change');
  }

  reflectValue (value: string): void {
    this.reflectingValue = true;

    if (value == null || value === '') {
      this.removeAttribute('value');
    } else {
      this.setAttribute('value', value);
    }

    this.reflectingValue = false;
  }

  clearSelection (): void {
    this.options.forEach((o) => o.removeAttribute('selected'));
    this.selectedIndex = -1;
    this.reflectValue('');

    ([...this.list.children] as HTMLElement[]).forEach((row) => row.setAttribute('aria-selected', 'false'));

    this.renderValue();
    this.requestFrame();
  }

  // Unknown values are ignored
  setValue (value: string | null): void {
    const next = value == null ? '' : String(value);

    if (!next) {
      this.clearSelection();
      return;
    }

    const index = this.options.findIndex((o) => o.value === next);

    if (index < 0) {
      return;
    }

    this.options.forEach((o, i) => o.toggleAttribute('selected', i === index));
    this.selectedIndex = index;
    this.reflectValue(next);

    ([...this.list.children] as HTMLElement[]).forEach((row, i) => row.setAttribute('aria-selected', String(i === index)));

    this.renderValue();
    this.requestFrame();
  }

  onTriggerKey (event: KeyboardEvent): void {
    if (this.isDisabled) {
      return;
    }

    if (!this.isOpen) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
        event.preventDefault();
        this.openPanel();
      }

      return;
    }

    switch (event.key) {
      case 'ArrowDown': event.preventDefault(); this.moveActive(1);                         break;
      case 'ArrowUp':   event.preventDefault(); this.moveActive(-1);                        break;
      case 'Home':      event.preventDefault(); this.activeIndex = -1; this.moveActive(1);  break;
      case 'End':       event.preventDefault(); this.activeIndex = 0;  this.moveActive(-1); break;
      case 'Enter':
      case ' ':         event.preventDefault(); this.selectIndex(this.activeIndex);         break;
      case 'Escape':    event.preventDefault(); this.close();                                break;
      case 'Tab':       this.close();                                                        break;
      default:
        // Type-ahead, per the APG select-only combobox
        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
          this.typeahead(event.key);
        }
    }
  }

  typeahead (char: string): void {
    clearTimeout(this.typeaheadTimer);
    this.typeaheadTimer = setTimeout(() => { this.typeaheadBuffer = ''; }, 500);

    this.typeaheadBuffer = (this.typeaheadBuffer || '') + char.toLowerCase();

    const n = this.options.length;

    if (n === 0) {
      return;
    }

    // A fresh character skips the current row, so repeats cycle same-initial options
    const base  = this.typeaheadBuffer.length === 1 ? this.activeIndex + 1 : this.activeIndex;
    const start = ((base % n) + n) % n;

    for (let step = 0; step < n; step++) {
      const i   = (start + step) % n;
      const opt = this.options[i];

      if (opt && !opt.disabled && opt.label.toLowerCase().startsWith(this.typeaheadBuffer)) {
        this.activeIndex = i;
        this.renderActive();
        return;
      }
    }
  }

  onRowHover (event: PointerEvent): void {
    const row = (event.target as HTMLElement).closest('.row') as HTMLElement | null;

    if (!row) {
      return;
    }

    const i = Number(row.dataset.index);

    if (i !== this.activeIndex) {
      this.activeIndex = i;
      this.renderActive();
    }
  }

  onRowClick (event: MouseEvent): void {
    const row = (event.target as HTMLElement).closest('.row') as HTMLElement | null;

    if (!row) {
      return;
    }

    this.selectIndex(Number(row.dataset.index));
  }

  override fill (): string {
    if (this.hasAttribute('disabled')) {
      return this.resolveColor(`var(--jelly-color-background-neutral, var(--droplet-color-background-neutral, ${PALETTE['background-neutral']}))`);
    }

    if (this.focused || this.isOpen) {
      return this.resolveColor(`var(--jelly-color-background-surface, var(--droplet-color-background-surface, ${PALETTE['background-surface']}))`);
    }

    const custom = readToken(getComputedStyle(this), 'fill').trim();

    return custom || this.resolveColor(`var(--jelly-color-background-muted, var(--droplet-color-background-muted, ${PALETTE['background-muted']}))`);
  }

  // Any focus, pointer included, lights the ring, matching droplet-input
  override focusRing (): Ring | null {
    if (!this.focused && !this.isOpen) {
      return null;
    }

    return { color: this.ringColor(), width: FOCUS_RING.width, gap: FOCUS_RING.gap };
  }

  override surfaceBorder (): Border {
    const color = this.focused || this.isOpen
      ? this.resolveColor(`var(--jelly-accent, var(--droplet-accent, var(--jelly-color-background-accent, var(--droplet-color-background-accent, ${PALETTE['background-accent']}))))`)
      : this.resolveColor(`var(--jelly-color-background-neutral, var(--droplet-color-background-neutral, ${PALETTE['background-neutral']}))`);

    return { color, width: 1 };
  }

  override frame (dt: number): boolean {
    const trigger = this.body;

    if (!trigger) {
      return false;
    }

    trigger.update(dt);
    this.clearCanvas();
    this.paintBody(trigger, {
      fill:    this.fill(),
      ring:    this.focusRing(),
      border:  this.surfaceBorder(),
      easeKey: 'trigger',
    });

    let keep = !trigger.isResting();

    if (this.reducedMotion) {
      this.openT              = this.openTarget;
      this.openTargetVelocity = 0;
    } else {
      const a = (this.openTarget - this.openT) * 210 - this.openTargetVelocity * 16;

      this.openTargetVelocity += a * dt;
      this.openT              += this.openTargetVelocity * dt;
    }

    const t       = this.openT;
    const tc      = clamp(t, 0, 1);
    const visible = this.openTarget === 1 || t > 0.02;
    const flipped = this.panelSide === 'top';

    if (this.panel) {
      // Held in the top layer through the fold-away
      if (!visible) {
        this.hidePanelLayer();
      }

      this.panel.style.visibility = visible ? 'visible' : 'hidden';
      this.panel.style.opacity    = String(clamp(t * 2, 0, 1));

      const hidden = (1 - tc) * 100;

      this.panelMask.style.clipPath = flipped
        ? `inset(${hidden}% 0 0 0 round ${PANEL_RADIUS}px)`
        : `inset(0 0 ${hidden}% 0 round ${PANEL_RADIUS}px)`;

      const rows = this.list.children as HTMLCollectionOf<HTMLElement>;

      for (let i = 0; i < rows.length; i++) {
        const order = flipped ? rows.length - 1 - i : i;
        const p     = clamp((t - 0.12) * 1.7 - order * 0.05, 0, 1);

        const row = rows[i];

        if (!row) {
          continue;
        }

        row.style.opacity   = String(p);
        row.style.transform = `translateY(${(flipped ? -7 : 7) * (1 - p)}px)`;
      }
    }

    if (this.panelBody && visible) {
      this.panelBody.update(dt);
      this.panelCtx.clearRect(0, 0, this.panelCssW, this.panelCssH);

      const H    = this.panelBody.height;
      const sy   = Math.max(0.02, t);
      const lift = (1 - sy) * H / 2;

      this.paintBody(this.panelBody, {
        fill:    this.resolveColor(`var(--jelly-color-background-surface, var(--droplet-color-background-surface, ${PALETTE['background-surface']}))`),
        border:  { color: this.resolveColor(`var(--jelly-color-background-neutral, var(--droplet-color-background-neutral, ${PALETTE['background-neutral']}))`), width: 1 },
        ctx:     this.panelCtx,
        cssW:    this.panelCssW,
        cssH:    this.panelCssH,
        cy:      flipped ? lift : -lift,
        scaleX:  1 + (1 - tc) * 0.05,
        scaleY:  sy,
        easeKey: 'panel',
      });
    }

    const animating = Math.abs(this.openTarget - t) > 0.001 || Math.abs(this.openTargetVelocity) > 0.001;

    keep = keep || animating || (visible && this.panelBody !== null && !this.panelBody.isResting());

    return keep;
  }

  attributeChangedCallback (name: string): void {
    if (this.axisAttributeChanged(name) || this.formAttributeChanged(name)) {
      return;
    }

    if (this.reflectingValue) {
      return;
    }

    this.sync(name, this.getAttribute(name));
  }

  sync (name: string, value: string | null): void {
    switch (name) {
      case 'placeholder':
        if (this.valueEl) {
          this.renderValue();
        }
        break;

      case 'label':
        this.syncLabel();
        break;

      case 'disabled':
        this.syncDisabled();
        break;

      case 'size':
        canonicalizeSize(this);

        if (this.panel) {
          this.sizePanel();
          this.requestFrame();
        }
        break;

      case 'value':
        if (this.list) {
          this.setValue(value);
        }
        break;
    }
  }

  syncLabel (): void {
    if (!this.trigger) {
      return;
    }

    const label = this.getAttribute('label');

    if (label) {
      this.trigger.setAttribute('aria-label', label);
    } else {
      this.trigger.removeAttribute('aria-label');
    }
  }

  get value (): string {
    const opt = this.options[this.selectedIndex];

    return opt ? opt.value : '';
  }

  set value (v: string) {
    this.setValue(v);
  }

  // Reset defaults, captured before user choices rewrite value and selected
  authoredValue: string | null | undefined = undefined;
  authoredSelected = new WeakMap<Element, boolean>();

  override formAnchor (): HTMLElement | null {
    return this.trigger ?? null;
  }

  override formValueMissing (): boolean {
    return this.selectedIndex < 0;
  }

  override formReset (): void {
    const authored = this.authoredValue;

    let index = -1;

    this.options.forEach((option, i) => {
      if (authored ? option.value === authored : this.authoredSelected.get(option)) index = i;
    });

    if (index < 0) {
      this.clearSelection();
      return;
    }

    this.options.forEach((option, i) => option.toggleAttribute('selected', i === index));
    this.selectedIndex = index;
    this.reflectValue(this.options[index]!.value);

    ([...this.list.children] as HTMLElement[]).forEach((row, i) => row.setAttribute('aria-selected', String(i === index)));

    this.renderValue();
    this.requestFrame();
  }

  override formRestore (state: RestoreState): void {
    if (typeof state === 'string') {
      this.value = state;
    }
  }

  override syncDisabled (): void {
    if (!this.trigger) {
      return;
    }

    this.trigger.disabled = this.isDisabled;

    if (this.isDisabled) {
      this.focused = false;
      this.close();
    }

    this.syncHostFocusTarget();
    this.requestFrame();
  }

  override focus (options?: FocusOptions): void {
    this.trigger?.focus(options);
  }

}

export function defineSelect (options: DefineOptions = {}): DefineResult {
  return defineStrict([[TAGS.select, DropletSelect], [TAGS.option, DropletOption]], options);
}

declare global {
  interface HTMLElementTagNameMap {
    'droplet-select': DropletSelect;
  }
}
