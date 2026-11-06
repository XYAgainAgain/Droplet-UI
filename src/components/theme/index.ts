import { ensureThemeTokens } from '../../theme/index.js';
import { notifyThemeChange } from '../../theme/index.js';
import { LIGHT_TOKENS }      from '../../theme/index.js';
import { DARK_TOKENS }       from '../../theme/index.js';
import type { ThemeMode }    from '../../theme/index.js';
import { HTMLElementBase }   from '../../element/base.js';
import { defineStrict, TAGS } from '../../registry/index.js';
import type { DefineOptions, DefineResult } from '../../registry/index.js';

// Declares the legacy name too, so an outer override under either name stops here
function scoped (name: string, value: string): string {
  return `--droplet-color-${name}: ${value}; --jelly-color-${name}: var(--droplet-color-${name});`;
}

// Expects a computed rgb() or color(srgb) string
function colorChannels (color: string): [number, number, number, number] {
  const values = String(color).match(/[\d.]+/g)?.slice(0, 3).map(Number) || [0, 0, 0];
  const channels = color.startsWith('color(')
    ? values
    : values.map((channel) => channel / 255);
  const alpha = Number(String(color).match(/[\d.]+/g)?.[3] ?? 1);

  return [channels[0] ?? 0, channels[1] ?? 0, channels[2] ?? 0, Math.max(0, Math.min(1, alpha))];
}

function luminance (channels: number[]): number {
  const linear = channels.slice(0, 3).map((s) => {
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * (linear[0] ?? 0) + 0.7152 * (linear[1] ?? 0) + 0.0722 * (linear[2] ?? 0);
}

// Composites a translucent accent over the backdrop before measuring contrast
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

  // Mirrors DARK onAccent in tokens.ts
  return ratio(accent, dark) >= ratio(accent, light) ? '#1E222A' : '#FFFFFF';
}

/**
 * A theme provider that scopes the design tokens to its subtree.
 *
 * @element droplet-theme
 *
 * @slot - The subtree the theme applies to.
 *
 * @attr {"light"|"dark"|"auto"} mode - Force a color scheme, or follow the OS.
 * @attr {string} accent - A named hue or any CSS color to re-tint the accent.
 */
export class DropletTheme extends HTMLElementBase {

  static define (options?: DefineOptions): DefineResult {
    return defineTheme(options);
  }

  schemeQuery: MediaQueryList | null;
  onSchemeChange: () => void;
  tokenStyle: HTMLStyleElement | null = null;
  colorProbe: HTMLSpanElement | null = null;

  static get observedAttributes (): string[] {
    return ['mode', 'accent'];
  }

  constructor () {
    super();

    this.schemeQuery    = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
    this.onSchemeChange = () => this.sync();
  }

  connectedCallback (): void {
    ensureThemeTokens();

    if (!this.shadowRoot) {
      this.attachShadow({ mode: 'open' });

      this.shadowRoot!.innerHTML = `
        <style data-droplet-theme-tokens>:host { display: contents; }</style>

        <slot></slot>
      `;
    }

    this.tokenStyle = this.shadowRoot!.querySelector('[data-droplet-theme-tokens]');

    this.schemeQuery?.addEventListener?.('change', this.onSchemeChange);

    this.sync();
  }

  disconnectedCallback (): void {
    this.schemeQuery?.removeEventListener?.('change', this.onSchemeChange);
  }

  attributeChangedCallback (): void {
    if (this.isConnected) {
      this.sync();
    }
  }

  get mode (): ThemeMode {
    const mode = this.getAttribute('mode');

    return mode === 'light' || mode === 'dark' ? mode : 'auto';
  }

  set mode (value: ThemeMode) {
    this.setAttribute('mode', value);
  }

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

  get resolvedMode (): 'light' | 'dark' {
    if (this.mode !== 'auto') {
      return this.mode;
    }

    return this.schemeQuery?.matches ? 'dark' : 'light';
  }

  // Mirrors resolve() in theme/pick.ts
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

  // A :host rule rather than inline host styles, so a consumer's inline tokens still win
  sync (): void {
    if (!this.tokenStyle) {
      return;
    }

    const tokens = this.resolvedMode === 'dark' ? DARK_TOKENS : LIGHT_TOKENS;
    const decls  = Object.entries(tokens).map(([name, value]) => scoped(name, value));

    const accent = this.getAttribute('accent')?.trim();

    if (accent) {
      // Custom properties accept any text, so validate before publishing
      const named = tokens['background-' + accent];
      const hue   = named || accent;
      const valid = Boolean(named) || CSS.supports('color', hue);

      if (valid) {
        const on = named
          ? tokens['foreground-on-emphasis']
          : readableOn(this.resolveColor(hue), this.resolveColor(tokens['background-surface']!));

        decls.push(scoped('background-accent', hue));
        decls.push(scoped('foreground-on-accent', on!));
      }
    }

    this.tokenStyle.textContent = `:host { display: contents; color-scheme: ${this.resolvedMode}; ${decls.join(' ')} }`;

    notifyThemeChange();
  }

}

export function defineTheme (options: DefineOptions = {}): DefineResult {
  return defineStrict([[TAGS.theme, DropletTheme]], options);
}

declare global {
  interface HTMLElementTagNameMap {
    'droplet-theme': DropletTheme;
  }
}
