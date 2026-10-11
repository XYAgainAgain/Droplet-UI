import { HTMLElementBase } from '../../element/base.js';
import { anyTag, defineStrict, TAGS } from '../../registry/index.js';
import type { DefineOptions, DefineResult } from '../../registry/index.js';

// The minimal surface of a parent that re-reads its segments
interface SegmentParent extends HTMLElement {
  sync?: () => void;
}

/**
 * Declarative data for one option inside `<droplet-segmented>`. Hidden from layout.
 *
 * @element droplet-segment
 *
 * @slot - The segment's visible label.
 *
 * @attr {string} value - Submitted value (defaults to the trimmed text).
 * @attr {boolean} selected - Whether this segment is initially selected.
 * @attr {boolean} disabled - Whether this segment cannot be selected.
 */
export class DropletSegment extends HTMLElementBase {

  static define (options?: DefineOptions): DefineResult {
    return defineSegment(options);
  }

  static get observedAttributes (): string[] {
    return ['value', 'selected', 'disabled'];
  }

  get value (): string {
    return this.hasAttribute('value')
      ? this.getAttribute('value') ?? ''
      : (this.textContent ?? '').trim();
  }

  get label (): string {
    return (this.textContent ?? '').trim();
  }

  get disabled (): boolean {
    return this.hasAttribute('disabled');
  }

  connectedCallback (): void {
    this.style.display = 'none';

    (this.closest(anyTag('segmented')) as SegmentParent | null)?.sync?.();
  }

  attributeChangedCallback (): void {
    (this.closest(anyTag('segmented')) as SegmentParent | null)?.sync?.();
  }

}

export function defineSegment (options: DefineOptions = {}): DefineResult {
  return defineStrict([[TAGS.segment, DropletSegment]], options);
}

declare global {
  interface HTMLElementTagNameMap {
    'droplet-segment': DropletSegment;
  }
}
