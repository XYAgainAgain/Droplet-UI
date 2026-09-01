/*
 * A theme provider that scopes Jelly UI design tokens to its subtree,
 * so consumers can force light or dark mode, follow the operating system,
 * or re-tint the accent for a section of the page - without touching the
 * rest of the document
 *
 * <jelly-theme mode="dark">
 *   <jelly-button>I render on dark tokens</jelly-button>
 * </jelly-theme>
 *
 * <jelly-theme mode="auto" accent="#7C3AED">
 *   <jelly-slider></jelly-slider>
 * </jelly-theme>
 *
 * The provider is display: contents, so it never affects layout. Any
 * individual token can also be overridden inline - the resolved token set
 * is applied through the shadow :host rule, so a consumer's inline style
 * wins over it:
 *
 * <jelly-theme style="--jelly-color-background-azure: #4F46E5">…</jelly-theme>
 */

import { ensureThemeTokens } from '../../theme/index.js';
import { notifyThemeChange } from '../../theme/index.js';
import { LIGHT_TOKENS }      from '../../theme/index.js';
import { DARK_TOKENS }       from '../../theme/index.js';
import type { ThemeMode }    from '../../theme/index.js';

// Parse a resolved rgb()/color(srgb) CSS color into normalized RGBA channels
function colorChannels (color: string): [number, number, number, number] {
  const values = String(color).match(/[\d.]+/g)?.slice(0, 3).map(Number) || [0, 0, 0];
  const channels = color.startsWith('color(')
    ? values
    : values.map((channel) => channel / 255);
  const alpha = Number(String(color).match(/[\d.]+/g)?.[3] ?? 1);

  return [channels[0] ?? 0, channels[1] ?? 0, channels[2] ?? 0, Math.max(0, Math.min(1, alpha))];
}

// Relative luminance for normalized sRGB channels
function luminance (channels: number[]): number {
  const linear = channels.slice(0, 3).map((s) => {
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * (linear[0] ?? 0) + 0.7152 * (linear[1] ?? 0) + 0.0722 * (linear[2] ?? 0);
}

// Pick whichever shared foreground has stronger contrast with a custom accent.
// Composite translucent accents over the active surface before measuring them.
function readableOn (color: string, backdrop: string): string {
  const foreground = colorChannels(color);
  const background = colorChannels(backdrop);
  const alpha      = foreground[3];
  const composite  = foreground.slice(0, 3).map((channel, index) => {
    return channel * alpha + (background[index] ?? 0) * (1 - alpha);
  });
  const accent = luminance(composite);
  const dark   = luminance(colorChannels('rgb(30, 34, 42)'));
  const light  = 1;
  const ratio  = (a: number, b: number): number => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

  // The dark on-color is the card surface (#1E222A), not pure black, so dark-mode
  // fills stay in the same family as the rest of the surface tokens.
  return ratio(accent, dark) >= ratio(accent, light) ? '#1E222A' : '#FFFFFF';
}

/**
 * A theme provider that scopes the design tokens to its subtree.
 *
 * @element jelly-theme
 *
 * @slot - The subtree the theme applies to.
 *
 * @attr {"light"|"dark"|"auto"} mode - Force a color scheme, or follow the OS.
 * @attr {string} accent - A named hue or any CSS color to re-tint the accent.
 */
export class JellyTheme extends HTMLElement {

  schemeQuery: MediaQueryList | null;
  onSchemeChange: () => void;
  tokenStyle: HTMLStyleElement | null = null;
  colorProbe: HTMLSpanElement | null = null;

  // Tells the browser to trigger attributeChangedCallback when these attributes change
  static get observedAttributes (): string[] {
    return ['mode', 'accent'];
  }

  constructor () {
    super();

    // Re-resolve an 'auto' subtree when the operating system scheme flips
    this.schemeQuery    = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
    this.onSchemeChange = () => this.sync();
  }

  // Lifecycle method: Called automatically when the element is appended to the DOM
  connectedCallback (): void {
    ensureThemeTokens();

    if (!this.shadowRoot) {
      // The provider is layout-invisible; sync() fills the token style below
      this.attachShadow({ mode: 'open' });

      this.shadowRoot!.innerHTML = `
        <style data-jelly-theme-tokens>:host { display: contents; }</style>

        <slot></slot>
      `;
    }

    this.tokenStyle = this.shadowRoot!.querySelector('[data-jelly-theme-tokens]');

    this.schemeQuery?.addEventListener?.('change', this.onSchemeChange);

    this.sync();
  }

  // Lifecycle method: Called automatically when the element leaves the DOM
  disconnectedCallback (): void {
    this.schemeQuery?.removeEventListener?.('change', this.onSchemeChange);
  }

  // Lifecycle method: Fires when observed HTML attributes change dynamically
  attributeChangedCallback (): void {
    if (this.isConnected) {
      this.sync();
    }
  }

  // The requested mode: 'light', 'dark', or 'auto' (follow the OS)
  get mode (): ThemeMode {
    const mode = this.getAttribute('mode');

    return mode === 'light' || mode === 'dark' ? mode : 'auto';
  }

  set mode (value: ThemeMode) {
    this.setAttribute('mode', value);
  }

  // The re-tinted accent hue for this subtree (null when unset)
  get accent (): string | null {
    return this.getAttribute('accent');
  }

  set accent (value: string | null) {
    if (value == null) {
      this.removeAttribute('accent');
    } else {
      this.setAttribute('accent', value);
    }
  }

  // The mode in effect right now, with 'auto' resolved against the OS
  get resolvedMode (): 'light' | 'dark' {
    if (this.mode !== 'auto') {
      return this.mode;
    }

    return this.schemeQuery?.matches ? 'dark' : 'light';
  }

  // Resolve any supported CSS color syntax to computed sRGB for contrast math
  resolveColor (color: string): string {
    if (!this.colorProbe) {
      this.colorProbe = document.createElement('span');
      this.colorProbe.setAttribute('aria-hidden', 'true');
      this.colorProbe.style.cssText =
        'position:absolute;width:0;height:0;visibility:hidden;pointer-events:none';
      this.shadowRoot!.appendChild(this.colorProbe);
    }

    const probe = this.colorProbe!;

    probe.style.color = `color-mix(in srgb, ${color} 100%, transparent)`;

    return getComputedStyle(probe).color;
  }

  /*
   * Apply the resolved token set through the shadow :host rule, so the whole
   * subtree - including canvas-painted components that read computed tokens -
   * picks up the theme through normal CSS inheritance. Writing it as a :host
   * selector rule (rather than inline styles on the host) means a consumer's
   * own inline `style="--jelly-color-…"` still wins.
   */
  sync (): void {
    if (!this.tokenStyle) {
      return;
    }

    const tokens = this.resolvedMode === 'dark' ? DARK_TOKENS : LIGHT_TOKENS;
    const decls  = Object.entries(tokens).map(([name, value]) => `--jelly-color-${name}: ${value};`);

    const accent = this.getAttribute('accent')?.trim();

    if (accent) {
      // A named hue (rose/amber/azure/mint) maps through the palette with the
      // shared on-emphasis label; a valid custom CSS color is used with a
      // luminance-picked on-color. Custom properties accept arbitrary text, so
      // validate before publishing; otherwise canvas consumers keep a stale color.
      const named = tokens['background-' + accent];
      const hue   = named || accent;
      const valid = Boolean(named) || CSS.supports('color', hue);

      if (valid) {
        const on = named
          ? tokens['foreground-on-emphasis']
          : readableOn(this.resolveColor(hue), this.resolveColor(tokens['background-surface']!));

        decls.push(`--jelly-color-background-accent: ${hue};`);
        decls.push(`--jelly-color-foreground-on-accent: ${on};`);
      }
    }

    this.tokenStyle.textContent = `:host { display: contents; color-scheme: ${this.resolvedMode}; ${decls.join(' ')} }`;

    // Wake resting canvases inside this subtree so they repaint with the new colors
    notifyThemeChange();
  }

}

// Register the custom element
customElements.define('jelly-theme', JellyTheme);

declare global {
  interface HTMLElementTagNameMap {
    'jelly-theme': JellyTheme;
  }
}
