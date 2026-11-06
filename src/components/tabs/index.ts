import { emit }                 from '../../utilities/index.js';
import { escapeHTML }           from '../../utilities/index.js';
import { prefersReducedMotion } from '../../utilities/index.js';

import { ensureThemeTokens }    from '../../theme/index.js';

import '../segmented/index.js';
import { HTMLElementBase }      from '../../element/base.js';
import { anyTag, defineStrict, TAGS }   from '../../registry/index.js';
import type { DefineOptions, DefineResult } from '../../registry/index.js';
import { DropletSegment }         from '../segment/index.js';
import { DropletSegmented }       from '../segmented/index.js';

import tabsStyles               from './tabs.css?inline';

interface TabBar extends HTMLElement {
  value: string;
}

/**
 * One tab panel: shown when its tab is active, hidden otherwise.
 *
 * @element droplet-tab-panel
 *
 * @slot - The panel content.
 *
 * @attr {string} label - The tab label shown in the tab bar.
 * @attr {string} value - The panel's value (defaults to its index).
 * @attr {boolean} active - Whether this panel is initially active.
 */
export class DropletTabPanel extends HTMLElementBase {

  static define (options?: DefineOptions): DefineResult {
    return defineTabPanel(options);
  }

  connectedCallback (): void {
    ensureThemeTokens();
    this.setAttribute('role', 'tabpanel');

    const label = this.getAttribute('label');

    if (!this.hasAttribute('aria-label') && label) {
      this.setAttribute('aria-label', label);
    }

    if (!this.hasAttribute('active')) {
      this.hidden = true;
    }
  }

  get label (): string {
    return this.getAttribute('label') || '';
  }

}

/**
 * A tabbed view whose bar is a sliding soft-body segmented control.
 *
 * @element droplet-tabs
 *
 * @slot - The `<droplet-tab-panel>` panels.
 *
 * @attr {string} value - The active panel's value.
 * @attr {"small"|"medium"|"large"} size - Tab-bar size.
 *
 * @fires change - With `detail.value` when the active tab changes.
 *
 * @csspart tabs - The inner segmented tab bar.
 */
export class DropletTabs extends HTMLElementBase {

  static define (options?: DefineOptions): DefineResult {
    return defineTabs(options);
  }

  built = false;

  segmented: TabBar | null = null;
  current: string | null = null;

  static get observedAttributes (): string[] {
    return ['size', 'value'];
  }

  connectedCallback (): void {
    ensureThemeTokens();

    if (this.built) {
      return;
    }

    this.built = true;

    const panels = [...this.querySelectorAll<DropletTabPanel>(anyTag('tabPanel'))];

    const activeIndex = Math.max(0, panels.findIndex((panel) => panel.hasAttribute('active')));
    const activePanel = panels[activeIndex];
    const activeValue = this.getAttribute('value') ?? (activePanel ? this.panelValue(activePanel, activeIndex) : '0');

    this.attachShadow({ mode: 'open', delegatesFocus: true });

    this.shadowRoot!.innerHTML = `
      <style>${tabsStyles}</style>

      <div class="bar">
        <${TAGS.segmented} part="tabs" roles="tablist" value="${escapeHTML(activeValue)}">
          ${panels.map((panel, i) =>
            `<${TAGS.segment} value="${escapeHTML(this.panelValue(panel, i))}">${escapeHTML(this.panelLabel(panel, i))}</${TAGS.segment}>`,
          ).join('')}
        </${TAGS.segmented}>
      </div>

      <div class="panels"><slot></slot></div>
    `;

    this.segmented = this.shadowRoot!.querySelector(TAGS.segmented) as TabBar | null;
    this.current   = null;

    this.syncSize();

    // Stops the segmented's composed change so hosts see only the tabs' change
    this.segmented!.addEventListener('change', (event) => {
      event.stopPropagation();
      this.activate(this.segmented!.value, true);
    });

    this.activate(activeValue, false);
  }

  attributeChangedCallback (name: string): void {
    if (name === 'size') {
      this.syncSize();
    }

    if (name === 'value') {
      this.syncValue();
    }
  }

  syncValue (): void {
    const value = this.getAttribute('value');

    if (!this.segmented || value == null || String(value) === this.current) {
      return;
    }

    this.segmented.setAttribute('value', value);
    this.activate(value, true);
  }

  syncSize (): void {
    if (!this.segmented) {
      return;
    }

    const size = this.getAttribute('size');

    if (size) {
      this.segmented.setAttribute('size', size);
    } else {
      this.segmented.removeAttribute('size');
    }
  }

  // Derived, not cached: a panel upgrading after this controller resets stamped fields
  panelValue (panel: DropletTabPanel, index: number): string {
    return panel.getAttribute('value') || String(index);
  }

  panelLabel (panel: DropletTabPanel, index: number): string {
    const label = panel.getAttribute('label');

    if (label) {
      return label;
    }

    const text = (panel.textContent ?? '').trim();

    return text || `Tab ${index + 1}`;
  }

  activate (value: string, animate: boolean): void {
    const panels = [...this.querySelectorAll<DropletTabPanel>(anyTag('tabPanel'))];

    panels.forEach((panel, i) => {
      const on = this.panelValue(panel, i) === String(value);

      panel.hidden = !on;
      panel.toggleAttribute('active', on);
      // Focusable even without focusable content (APG tabs pattern)
      panel.tabIndex = on ? 0 : -1;

      if (on && animate && !prefersReducedMotion()) {
        panel.animate?.(
          [
            { opacity: 0, transform: 'translateY(4px) scale(0.995)' },
            { opacity: 1, transform: 'translateY(0) scale(1)' },
          ],
          { duration: 220, easing: 'cubic-bezier(.22,1,.36,1)' },
        );
      }
    });

    // No change event for the initial mount selection
    const previous = this.current;

    this.current = String(value);

    // Set after `current` so the re-entrant syncValue sees a match and skips
    if (this.getAttribute('value') !== this.current) {
      this.setAttribute('value', this.current);
    }

    if (previous !== null && previous !== this.current) {
      emit(this, 'change', { value: this.current });
    }
  }

  get value (): string | undefined {
    return this.segmented?.value;
  }

  set value (value: string) {
    this.segmented?.setAttribute('value', value);
    this.activate(value, true);
  }

  override focus (options?: FocusOptions): void {
    this.segmented?.focus(options);
  }

}

export function defineTabPanel (options: DefineOptions = {}): DefineResult {
  return defineStrict([[TAGS.tabPanel, DropletTabPanel]], options);
}

export function defineTabs (options: DefineOptions = {}): DefineResult {
  return defineStrict([[TAGS.segmented, DropletSegmented], [TAGS.segment, DropletSegment], [TAGS.tabPanel, DropletTabPanel], [TAGS.tabs, DropletTabs]], options);
}

declare global {
  interface HTMLElementTagNameMap {
    'droplet-tab-panel': DropletTabPanel;
    'droplet-tabs': DropletTabs;
  }
}
