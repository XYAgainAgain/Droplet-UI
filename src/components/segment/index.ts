/*
 * Declarative data for one option inside <jelly-segmented>. The parent
 * reads its value, label and disabled state and renders the actual
 * control, so the segment element stays out of the layout entirely
 */

import { HTMLElementBase } from '../../element/base.js';
import { defineStrict, TAGS } from '../../registry/index.js';
import type { DefineOptions, DefineResult } from '../../registry/index.js';

// The minimal surface of a parent that re-reads its segments
interface SegmentParent extends HTMLElement {
  sync?: () => void;
}

/**
 * Declarative data for one option inside `<jelly-segmented>`. Hidden from layout.
 *
 * @element jelly-segment
 *
 * @slot - The segment's visible label.
 *
 * @attr {string} value - Submitted value (defaults to the trimmed text).
 * @attr {boolean} selected - Whether this segment is initially selected.
 * @attr {boolean} disabled - Whether this segment cannot be selected.
 */
export class JellySegment extends HTMLElementBase {

  static define (options?: DefineOptions): DefineResult {
    return defineSegment(options);
  }

  // Tells the browser to trigger attributeChangedCallback when these attributes change
  static get observedAttributes (): string[] {
    return ['value', 'selected', 'disabled'];
  }

  // The submitted value: the value attribute, falling back to the text label
  get value (): string {
    return this.hasAttribute('value')
      ? this.getAttribute('value') ?? ''
      : (this.textContent ?? '').trim();
  }

  // The visible label rendered by the parent control
  get label (): string {
    return (this.textContent ?? '').trim();
  }

  // True when this option cannot be selected
  get disabled (): boolean {
    return this.hasAttribute('disabled');
  }

  // Lifecycle method: Called automatically when the element is appended to the DOM
  connectedCallback (): void {
    this.style.display = 'none';

    // Ask the parent control to re-read its options
    (this.closest('jelly-segmented') as SegmentParent | null)?.sync?.();
  }

  // Lifecycle method: Fires when observed HTML attributes change dynamically
  attributeChangedCallback (): void {
    (this.closest('jelly-segmented') as SegmentParent | null)?.sync?.();
  }

}

export function defineSegment (options: DefineOptions = {}): DefineResult {
  return defineStrict([[TAGS.segment, JellySegment]], options);
}

declare global {
  interface HTMLElementTagNameMap {
    'jelly-segment': JellySegment;
  }
}
