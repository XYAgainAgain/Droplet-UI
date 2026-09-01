/*
 * A resizable panel grid. Drag the jelly dividers between panels; each
 * child becomes a flexible pane. direction="vertical" stacks the panes,
 * direction="both" makes a 2×2 split with two resize axes. Dividers
 * follow the window-splitter pattern (focusable, arrow keys, live
 * aria-valuenow) and respect reading direction
 */

import { emit }              from '../../utilities/index.js';
import { horizontalStep }    from '../../utilities/index.js';
import { isRTL }             from '../../utilities/index.js';

import { ensureThemeTokens } from '../../theme/index.js';

import resizableStyles       from './resizable.css?inline';

// The pane fractions carried in the change event detail
type ResizableSizes = number[] | { cols: number[]; rows: number[] };

/**
 * A resizable panel grid with draggable jelly dividers.
 *
 * @element jelly-resizable
 *
 * @slot - The panes to lay out and resize.
 *
 * @attr {"horizontal"|"vertical"|"both"} direction - Split layout.
 *
 * @fires change - With `detail.sizes` when a divider is dragged or nudged.
 *
 * @csspart container - The pane container.
 */
export class JellyResizable extends HTMLElement {

  built = false;
  grow: number[] = [];
  colGrow: [number, number] = [1, 1];
  rowGrow: [number, number] = [1, 1];
  endDrag: (() => void) | null = null;

  // Populated in render()
  container!: HTMLElement;

  // Tells the browser to trigger attributeChangedCallback when these attributes change
  static get observedAttributes (): string[] {
    return ['direction'];
  }

  // Lifecycle method: Called automatically when the element is appended to the DOM
  connectedCallback (): void {
    ensureThemeTokens();

    if (this.built) {
      return;
    }

    this.built = true;

    // Encapsulate styles and markup inside a Shadow DOM so they don't leak out
    this.attachShadow({ mode: 'open', delegatesFocus: true });

    this.render();
  }

  // Lifecycle method: Called automatically when the element leaves the DOM
  disconnectedCallback (): void {
    // A drag in progress must not leave window listeners behind
    this.endDrag?.();
  }

  // Lifecycle method: Fires when observed HTML attributes change dynamically
  attributeChangedCallback (): void {
    if (this.built) {
      this.render();
    }
  }

  // True for the 2×2 two-axis layout
  get isBothAxes (): boolean {
    return this.getAttribute('direction') === 'both';
  }

  // True when panes stack top-to-bottom
  get vertical (): boolean {
    return this.getAttribute('direction') === 'vertical';
  }

  // The current pane fractions (each axis sums to 1). A single-axis layout
  // returns a flat array; the 2×2 layout returns { cols, rows }. Carried in
  // the change event detail so a listener can read the resulting layout.
  get sizes (): ResizableSizes {
    const normalize = (weights: number[]): number[] => {
      const sum = weights.reduce((a, b) => a + b, 0) || 1;

      return weights.map((weight) => weight / sum);
    };

    if (this.isBothAxes) {
      return { cols: normalize(this.colGrow), rows: normalize(this.rowGrow) };
    }

    return normalize(this.grow);
  }

  // Rebuild panes and dividers for the current direction
  render (): void {
    const panels = [...this.children] as HTMLElement[];

    this.grow = panels.map(() => 1);

    panels.forEach((panel, i) => {
      panel.slot            = `p${i}`;
      panel.style.flex      = '1 1 0';
      panel.style.overflow  = 'auto';
      panel.style.minWidth  = '0';
      panel.style.minHeight = '0';
    });

    let inner = '';

    if (this.isBothAxes) {
      for (let i = 0; i < Math.max(4, panels.length); i++) {
        inner += `<slot name="p${i}"></slot>`;
      }

      inner += `
        <span class="divider divider-x" data-axis="x" role="separator" tabindex="0" aria-orientation="vertical" aria-label="Resize columns"><b></b></span>
        <span class="divider divider-y" data-axis="y" role="separator" tabindex="0" aria-orientation="horizontal" aria-label="Resize rows"><b></b></span>`;
    } else {
      panels.forEach((_, i) => {
        inner += `<slot name="p${i}"></slot>`;

        if (i < panels.length - 1) {
          inner += `<span class="divider" data-i="${i}" role="separator" tabindex="0"
                      aria-orientation="${this.vertical ? 'horizontal' : 'vertical'}"
                      aria-label="Resize panels ${i + 1} and ${i + 2}"><b></b></span>`;
        }
      });
    }

    this.shadowRoot!.innerHTML = `
      <style>${resizableStyles}</style>

      <div class="container" part="container">${inner}</div>
    `;

    this.container = this.shadowRoot!.querySelector('.container')!;

    this.shadowRoot!.querySelectorAll<HTMLElement>('.divider').forEach((div) => {
      div.addEventListener('pointerdown', (event) => this.onDividerDown(event, div));
      div.addEventListener('keydown', (event) => this.onDividerKey(event, Number(div.dataset.i)));
    });

    this.syncDirection();
    this.syncSeparatorValues();
  }

  // Keep aria-orientation (and the 2×2 tracks) in sync with the direction
  syncDirection (): void {
    if (this.isBothAxes) {
      this.shadowRoot?.querySelector('.divider-x')?.setAttribute('aria-orientation', 'vertical');
      this.shadowRoot?.querySelector('.divider-y')?.setAttribute('aria-orientation', 'horizontal');
      this.applyBoth();
      return;
    }

    const orientation = this.vertical ? 'horizontal' : 'vertical';

    this.shadowRoot?.querySelectorAll('.divider').forEach((div) => {
      div.setAttribute('aria-orientation', orientation);
    });
  }

  /*
   * Window-splitter values: each separator reports the size of its first
   * pane as a percentage of the pair (0–100), kept live through drags and
   * keyboard resizes.
   */
  syncSeparatorValues (): void {
    const percent = (a: number, b: number): string => String(Math.round((a / (a + b)) * 100));

    for (const div of this.shadowRoot?.querySelectorAll<HTMLElement>('.divider') || []) {
      div.setAttribute('aria-valuemin', '0');
      div.setAttribute('aria-valuemax', '100');

      if (this.isBothAxes) {
        const grow = div.dataset.axis === 'x' ? this.colGrow : this.rowGrow;
        div.setAttribute('aria-valuenow', percent(grow[0], grow[1]));
      } else {
        const i = Number(div.dataset.i);
        const before = this.grow[i];
        const after = this.grow[i + 1];

        if (before !== undefined && after !== undefined) {
          div.setAttribute('aria-valuenow', percent(before, after));
        }
      }
    }
  }

  // Start a divider drag (single-axis layouts)
  onDividerDown (event: PointerEvent, div: HTMLElement): void {
    if (this.isBothAxes) {
      this.onDividerDownBoth(event, div);
      return;
    }

    const i = Number(div.dataset.i);

    div.setPointerCapture(event.pointerId);
    div.classList.add('drag');

    const rect  = this.container.getBoundingClientRect();
    const total = this.vertical ? rect.height : rect.width;
    const start = this.vertical ? event.clientY : event.clientX;

    // In RTL the first pane sits at the physical right, so a rightward drag
    // shrinks it - mirror the pixel delta
    const mirror = !this.vertical && isRTL(this) ? -1 : 1;

    const g0  = this.grow[i];
    const g1  = this.grow[i + 1];

    if (g0 === undefined || g1 === undefined) {
      return;
    }

    const sum = g0 + g1;

    const move = (ev: PointerEvent): void => {
      const pos = this.vertical ? ev.clientY : ev.clientX;
      const dPx = (pos - start) * mirror;
      const dG  = (dPx / total) * this.grow.reduce((a, b) => a + b, 0);

      const n0 = Math.max(0.08, g0 + dG);
      const n1 = Math.max(0.08, g1 - dG);

      // Keep the pair's total constant
      const s = n0 + n1;

      this.grow[i]     = (n0 / s) * sum;
      this.grow[i + 1] = (n1 / s) * sum;

      this.apply();
    };

    const up = (ev: PointerEvent): void => {
      div.classList.remove('drag');
      div.releasePointerCapture(ev.pointerId);
      this.endDrag?.();

      emit(this, 'change', { sizes: this.sizes });
    };

    this.endDrag = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      this.endDrag = null;
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }

  // Start a divider drag (2×2 layout)
  onDividerDownBoth (event: PointerEvent, div: HTMLElement): void {
    const axis = div.dataset.axis;

    if (axis !== 'x' && axis !== 'y') {
      return;
    }

    div.setPointerCapture(event.pointerId);
    div.classList.add('drag');

    const rect   = this.container.getBoundingClientRect();
    const total  = axis === 'x' ? rect.width : rect.height;
    const start  = axis === 'x' ? event.clientX : event.clientY;
    const mirror = axis === 'x' && isRTL(this) ? -1 : 1;
    const grow   = axis === 'x' ? this.colGrow : this.rowGrow;

    const g0  = grow[0];
    const g1  = grow[1];
    const sum = g0 + g1;

    const move = (ev: PointerEvent): void => {
      const pos = axis === 'x' ? ev.clientX : ev.clientY;
      const dG  = (((pos - start) * mirror) / total) * sum;

      const n0 = Math.max(0.12, g0 + dG);
      const n1 = Math.max(0.12, g1 - dG);

      const s = n0 + n1;

      grow[0] = (n0 / s) * sum;
      grow[1] = (n1 / s) * sum;

      this.applyBoth();
    };

    const up = (ev: PointerEvent): void => {
      div.classList.remove('drag');
      div.releasePointerCapture(ev.pointerId);
      this.endDrag?.();

      emit(this, 'change', { sizes: this.sizes });
    };

    this.endDrag = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      this.endDrag = null;
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }

  // Keyboard resize: arrows move the divider (direction-aware), one step at a
  // time; Home/End drive it to the minimum / maximum (nudge clamps the ends)
  onDividerKey (event: KeyboardEvent, i: number): void {
    const step = 0.12;
    const axis = (event.currentTarget as HTMLElement | null)?.dataset.axis;

    if (event.key === 'Home' || event.key === 'End') {
      const toEnd = event.key === 'End';

      if (this.isBothAxes) {
        this.nudgeBoth(axis, toEnd ? 1 : -1);
      } else {
        this.nudge(i, toEnd ? 1 : -1);
      }

      event.preventDefault();
      return;
    }

    if (this.isBothAxes) {
      if (axis === 'x') {
        const d = horizontalStep(event.key, isRTL(this));

        if (d !== 0) {
          this.nudgeBoth('x', d * step);
          event.preventDefault();
        }
      } else if (axis === 'y' && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
        this.nudgeBoth('y', event.key === 'ArrowDown' ? step : -step);
        event.preventDefault();
      }

      return;
    }

    if (this.vertical) {
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        this.nudge(i, event.key === 'ArrowDown' ? step : -step);
        event.preventDefault();
      }
      return;
    }

    const d = horizontalStep(event.key, isRTL(this));

    if (d !== 0) {
      this.nudge(i, d * step);
      event.preventDefault();
    }
  }

  // Grow one pane of a pair by d (single-axis layouts)
  nudge (i: number, d: number): void {
    const before = this.grow[i];
    const after = this.grow[i + 1];

    if (before === undefined || after === undefined) {
      return;
    }

    this.grow[i]     = Math.max(0.08, before + d);
    this.grow[i + 1] = Math.max(0.08, after - d);

    this.apply();
    emit(this, 'change', { sizes: this.sizes });
  }

  // Grow one track of an axis by d (2×2 layout)
  nudgeBoth (axis: string | undefined, d: number): void {
    const grow = axis === 'x' ? this.colGrow : this.rowGrow;
    const sum  = grow[0] + grow[1];

    grow[0] = Math.max(0.12, grow[0] + d);
    grow[1] = Math.max(0.12, grow[1] - d);

    const s = grow[0] + grow[1];

    grow[0] = (grow[0] / s) * sum;
    grow[1] = (grow[1] / s) * sum;

    this.applyBoth();
    emit(this, 'change', { sizes: this.sizes });
  }

  // Push the flex weights onto the panes
  apply (): void {
    const panels = [...this.children] as HTMLElement[];

    panels.forEach((panel, i) => {
      panel.style.flex = `${this.grow[i]} 1 0`;
    });

    this.syncSeparatorValues();
  }

  // Push the track weights onto the 2×2 grid
  applyBoth (): void {
    this.container?.style.setProperty('--jelly-resizable-col-a', `${this.colGrow[0]}fr`);
    this.container?.style.setProperty('--jelly-resizable-col-b', `${this.colGrow[1]}fr`);
    this.container?.style.setProperty('--jelly-resizable-row-a', `${this.rowGrow[0]}fr`);
    this.container?.style.setProperty('--jelly-resizable-row-b', `${this.rowGrow[1]}fr`);

    this.syncSeparatorValues();
  }

  // Route programmatic host focus onto the first divider
  override focus (options?: FocusOptions): void {
    this.shadowRoot?.querySelector<HTMLElement>('.divider')?.focus(options);
  }

}

// Register the custom element
customElements.define('jelly-resizable', JellyResizable);

declare global {
  interface HTMLElementTagNameMap {
    'jelly-resizable': JellyResizable;
  }
}
