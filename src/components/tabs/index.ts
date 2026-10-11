/*
 * Tabbed views. The tab bar is a <jelly-segmented> in tablist mode (a
 * sliding jelly pill with real tab semantics); switching bounces the new
 * panel in. Panels are light-DOM <jelly-tab-panel> children and the active
 * one can be driven by a `value` attribute (like jelly-segmented's) as well
 * as by the panels' own `active` flags
 */

import { emit }                 from '../../utilities/index.js';
import { escapeHTML }           from '../../utilities/index.js';
import { prefersReducedMotion } from '../../utilities/index.js';

import { ensureThemeTokens }    from '../../theme/index.js';

import '../segmented/index.js';
import { HTMLElementBase }      from '../../element/base.js';
import { defineStrict, TAGS }   from '../../registry/index.js';
import type { DefineOptions, DefineResult } from '../../registry/index.js';
import { JellySegment }         from '../segment/index.js';
import { JellySegmented }       from '../segmented/index.js';

import tabsStyles               from './tabs.css?inline';

// The tab-bar surface tabs drives - jelly-segmented satisfies this structurally
interface TabBar extends HTMLElement {
  value: string;
}

/**
 * One tab panel: shown when its tab is active, hidden otherwise.
 *
 * @element jelly-tab-panel
 *
 * @slot - The panel content.
 *
 * @attr {string} label - The tab label shown in the tab bar.
 * @attr {string} value - The panel's value (defaults to its index).
 * @attr {boolean} active - Whether this panel is initially active.
 */
export class JellyTabPanel extends HTMLElementBase {

  static define (options?: DefineOptions): DefineResult {
    return defineTabPanel(options);
  }

  // Lifecycle method: Called automatically when the element is appended to the DOM
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

  // The tab label shown in the tab bar
  get label (): string {
    return this.getAttribute('label') || '';
  }

}

/**
 * A tabbed view whose bar is a sliding jelly segmented control.
 *
 * @element jelly-tabs
 *
 * @slot - The `<jelly-tab-panel>` panels.
 *
 * @attr {string} value - The active panel's value.
 * @attr {"small"|"medium"|"large"} size - Tab-bar size.
 *
 * @fires change - With `detail.value` when the active tab changes.
 *
 * @csspart tabs - The inner segmented tab bar.
 */
export class JellyTabs extends HTMLElementBase {

  static define (options?: DefineOptions): DefineResult {
    return defineTabs(options);
  }

  built = false;

  // Populated in connectedCallback()
  segmented: TabBar | null = null;
  current: string | null = null;

  // Tells the browser to trigger attributeChangedCallback when these attributes change
  static get observedAttributes (): string[] {
    return ['size', 'value'];
  }

  // Lifecycle method: Called automatically when the element is appended to the DOM
  connectedCallback (): void {
    ensureThemeTokens();

    if (this.built) {
      return;
    }

    this.built = true;

    const panels = [...this.querySelectorAll('jelly-tab-panel')];

    // A host value attribute wins; otherwise the panel marked `active` leads
    const activeIndex = Math.max(0, panels.findIndex((panel) => panel.hasAttribute('active')));
    const activePanel = panels[activeIndex];
    const activeValue = this.getAttribute('value') ?? (activePanel ? this.panelValue(activePanel, activeIndex) : '0');

    // Encapsulate styles and markup inside a Shadow DOM so they don't leak out
    this.attachShadow({ mode: 'open', delegatesFocus: true });

    this.shadowRoot!.innerHTML = `
      <style>${tabsStyles}</style>

      <div class="bar">
        <jelly-segmented part="tabs" roles="tablist" value="${escapeHTML(activeValue)}">
          ${panels.map((panel, i) =>
            `<jelly-segment value="${escapeHTML(this.panelValue(panel, i))}">${escapeHTML(this.panelLabel(panel, i))}</jelly-segment>`,
          ).join('')}
        </jelly-segmented>
      </div>

      <div class="panels"><slot></slot></div>
    `;

    this.segmented = this.shadowRoot!.querySelector('jelly-segmented') as TabBar | null;
    this.current   = null;

    this.syncSize();

    // Contain the inner segmented's own (composed) change so it doesn't escape
    // the shadow root and reach host listeners alongside our own single change
    this.segmented!.addEventListener('change', (event) => {
      event.stopPropagation();
      this.activate(this.segmented!.value, true);
    });

    this.activate(activeValue, false);
  }

  // Lifecycle method: Fires when observed HTML attributes change dynamically
  attributeChangedCallback (name: string): void {
    if (name === 'size') {
      this.syncSize();
    }

    if (name === 'value') {
      this.syncValue();
    }
  }

  // Reflect a host value attribute into the tab bar (a no-op when it already
  // matches, so the change event only fires for real switches)
  syncValue (): void {
    const value = this.getAttribute('value');

    if (!this.segmented || value == null || String(value) === this.current) {
      return;
    }

    this.segmented.setAttribute('value', value);
    this.activate(value, true);
  }

  // Pass the host's size down to the tab bar
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

  // A panel's value: its explicit `value` attribute, else its index. Derived
  // on demand rather than cached on the panel - a panel that upgrades after
  // this controller (as happens when the tabs markup is set through a
  // connected element's innerHTML, the parent connecting before its children
  // upgrade) would have any stamped field reset to its class default.
  panelValue (panel: JellyTabPanel, index: number): string {
    return panel.getAttribute('value') || String(index);
  }

  // The visible label for one panel's tab
  panelLabel (panel: JellyTabPanel, index: number): string {
    const label = panel.getAttribute('label');

    if (label) {
      return label;
    }

    const text = (panel.textContent ?? '').trim();

    return text || `Tab ${index + 1}`;
  }

  // Show the panel for `value`, hide the rest and announce real changes
  activate (value: string, animate: boolean): void {
    const panels = [...this.querySelectorAll('jelly-tab-panel')];

    panels.forEach((panel, i) => {
      const on = this.panelValue(panel, i) === String(value);

      panel.hidden = !on;
      panel.toggleAttribute('active', on);
      // The active panel is focusable so keyboard users can reach and scroll
      // it even when it holds no focusable content (APG tabs pattern)
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

    // change fires only when the active tab actually changes - the initial
    // mount selection is state, not an event
    const previous = this.current;

    this.current = String(value);

    // Reflect onto the host value attribute so it never goes stale after a tab
    // click (syncValue short-circuits the re-entry since it already matches)
    if (this.getAttribute('value') !== this.current) {
      this.setAttribute('value', this.current);
    }

    if (previous !== null && previous !== this.current) {
      emit(this, 'change', { value: this.current });
    }
  }

  // The active panel's value as a property
  get value (): string | undefined {
    return this.segmented?.value;
  }

  set value (value: string) {
    this.segmented?.setAttribute('value', value);
    this.activate(value, true);
  }

  // Route programmatic host focus onto the active tab
  override focus (options?: FocusOptions): void {
    this.segmented?.focus(options);
  }

}

export function defineTabPanel (options: DefineOptions = {}): DefineResult {
  return defineStrict([[TAGS.tabPanel, JellyTabPanel]], options);
}

export function defineTabs (options: DefineOptions = {}): DefineResult {
  return defineStrict([[TAGS.segmented, JellySegmented], [TAGS.segment, JellySegment], [TAGS.tabPanel, JellyTabPanel], [TAGS.tabs, JellyTabs]], options);
}

declare global {
  interface HTMLElementTagNameMap {
    'jelly-tab-panel': JellyTabPanel;
    'jelly-tabs': JellyTabs;
  }
}
