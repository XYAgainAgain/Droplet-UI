import { describe, expect, it, vi } from 'vitest';

import '../testing/define-all.js';
import type { DropletButton } from '../components/button/index.js';
import { mount, raf, settle } from '../testing/index.js';
import { prefersReducedMotion } from '../utilities/index.js';

import { DARK_TOKENS, ensureThemeTokens, getThemeMode, notifyThemeChange, onThemeChange, setThemeMode, VARIANT_CSS } from './index.js';
import { readToken } from './token-read.js';

// A page-level stylesheet standing in for a consumer's own CSS
function pageStyle (css: string): () => void {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.append(style);
  return () => style.remove();
}

// The resolved color a token produces on an element, in one comparable format
function tokenColor (el: DropletButton, target: Element, name: string): string {
  return el.resolveColor(readToken(getComputedStyle(target), name));
}

describe('legacy token compatibility', () => {
  it('lets a legacy theme override reach a component, winning over the canonical name', async () => {
    const host = mount('<droplet-button>A</droplet-button>');
    const el = host.firstElementChild as DropletButton;
    await settle(2);

    const legacy = pageStyle(':root { --jelly-color-background-accent: rgb(1, 2, 3) }');
    const canonical = pageStyle(':root { --droplet-color-background-accent: rgb(4, 5, 6) }');

    try {
      expect(tokenColor(el, el, 'fill')).toBe(el.resolveColor('rgb(1, 2, 3)'));
      legacy();
      expect(tokenColor(el, el, 'fill')).toBe(el.resolveColor('rgb(4, 5, 6)'));
    } finally {
      canonical();
      host.remove();
    }
  });

  it('applies a component token set on the host under either name, the legacy one winning a tie', async () => {
    // The canonical motion attribute stops the height transition, so a size reads at once
    document.documentElement.setAttribute('data-droplet-motion', 'reduce');
    const host = mount('<droplet-button style="--droplet-button-height: 50px">A</droplet-button>');
    const el = host.firstElementChild as DropletButton;

    try {
      await settle(2);
      const inner = el.shadowRoot!.querySelector('button')!;
      expect(inner.getBoundingClientRect().height).toBe(50);

      el.style.setProperty('--jelly-button-height', '40px');
      expect(inner.getBoundingClientRect().height).toBe(40);
    } finally {
      document.documentElement.removeAttribute('data-droplet-motion');
      host.remove();
      await raf();
    }
  });

  it('keeps a component token set on one host from reaching a component nested inside it', async () => {
    const host = mount('<droplet-button style="--jelly-fill: rgb(1, 2, 3)">X <droplet-badge variant="mint">3</droplet-badge></droplet-button>');
    const button = host.firstElementChild as DropletButton;

    try {
      await settle(2);
      const badge = button.querySelector('droplet-badge')!;
      expect(tokenColor(button, button, 'fill')).toBe(button.resolveColor('rgb(1, 2, 3)'));
      expect(tokenColor(button, badge, 'fill')).toBe(button.resolveColor('var(--droplet-color-background-mint)'));
    } finally {
      host.remove();
    }
  });

  it('answers a consumer reading the legacy names, at the root, in dark mode, and inside a scoped theme', async () => {
    const host = mount('<droplet-button>A</droplet-button><span id="outside" style="color: var(--jelly-color-background-surface)"></span><droplet-theme mode="dark"><span id="inside" style="color: var(--jelly-color-background-surface)"></span></droplet-theme>');
    const el = host.firstElementChild as DropletButton;
    const color = (id: string): string => el.resolveColor(getComputedStyle(host.querySelector(`#${id}`)!).color);

    try {
      await settle(1);
      expect(color('outside')).toBe(el.resolveColor('var(--droplet-color-background-surface)'));
      expect(color('inside')).toBe(el.resolveColor(DARK_TOKENS['background-surface']!));
      expect(getComputedStyle(el).getPropertyValue('--jelly-button-height').trim()).toBe('62px');

      setThemeMode('dark');
      expect(color('outside')).toBe(el.resolveColor(DARK_TOKENS['background-surface']!));
    } finally {
      setThemeMode('auto');
      host.remove();
    }
  });

  it('stops an outer legacy theme override at a scoped theme boundary, and accepts a legacy accent', () => {
    const remove = pageStyle(':root { --jelly-color-background-default: rgb(9, 9, 9) }');
    const host = mount('<droplet-button>A</droplet-button><span id="outside"></span><droplet-theme mode="dark"><span id="inside"></span></droplet-theme><droplet-theme accent="var(--jelly-color-background-rose)"><span id="accent"></span></droplet-theme>');
    const el = host.firstElementChild as DropletButton;

    try {
      const read = (id: string, name: string): string => readToken(getComputedStyle(host.querySelector(`#${id}`)!), name);
      expect(read('outside', 'color-background-default')).toBe('rgb(9, 9, 9)');
      expect(read('inside', 'color-background-default')).toBe(DARK_TOKENS['background-default']);
      expect(el.resolveColor(read('accent', 'color-background-accent'))).toBe(el.resolveColor('var(--droplet-color-background-rose)'));
    } finally {
      remove();
      host.remove();
    }
  });

  it('keeps a VARIANT_CSS host from recoloring a slotted component', async () => {
    customElements.define('variant-css-host', class extends HTMLElement {
      constructor () {
        super();
        this.attachShadow({ mode: 'open' }).innerHTML = `<style>${VARIANT_CSS}</style><slot></slot>`;
      }
    });
    const host = mount('<variant-css-host><droplet-button variant="rose">R</droplet-button></variant-css-host>');
    const button = host.querySelector('droplet-button') as DropletButton;

    try {
      await settle(2);
      expect(tokenColor(button, button, 'fill')).toBe(button.resolveColor('var(--droplet-color-background-rose)'));
    } finally {
      host.remove();
    }
  });
});

describe('the document token sheet', () => {
  it('lives in @layer droplet and switches mode on either attribute', async () => {
    ensureThemeTokens(document);
    const sheet = document.querySelector('style[data-droplet-tokens]')!;
    expect(sheet.textContent).toContain('@layer droplet');

    const root = document.documentElement;
    const background = (): string => readToken(getComputedStyle(root), 'color-background-default');

    for (const attribute of ['data-droplet-mode', 'data-jelly-mode']) {
      root.setAttribute(attribute, 'dark');
      expect(background(), attribute).toBe(DARK_TOKENS['background-default']);
      root.removeAttribute(attribute);
      await raf();
    }
  });

  it('keeps both spellings of mode and motion in step, the one written last winning', async () => {
    ensureThemeTokens(document);
    const root = document.documentElement;

    try {
      root.setAttribute('data-droplet-mode', 'light');
      root.setAttribute('data-jelly-mode', 'dark');
      await raf();
      expect(root.getAttribute('data-droplet-mode')).toBe('dark');
      expect(getThemeMode()).toBe('dark');
      expect(readToken(getComputedStyle(root), 'color-background-default')).toBe(DARK_TOKENS['background-default']);

      root.setAttribute('data-jelly-motion', 'reduce');
      await raf();
      expect(root.getAttribute('data-droplet-motion')).toBe('reduce');
      root.setAttribute('data-droplet-motion', 'no-preference');
      await raf();
      expect(root.getAttribute('data-jelly-motion')).toBe('no-preference');
      expect(prefersReducedMotion()).toBe(false);
      expect(getComputedStyle(root).getPropertyValue('--droplet-motion').trim()).toBe('no-preference');
    } finally {
      for (const name of ['data-droplet-mode', 'data-jelly-mode', 'data-droplet-motion', 'data-jelly-motion']) {
        root.removeAttribute(name);
      }
      await raf();
    }
  });

  it('is driven by setThemeMode, and either event name reaches listeners of both exactly once', () => {
    ensureThemeTokens(document);
    const canonical = vi.fn();
    const legacy = vi.fn();
    const subscriber = vi.fn();
    window.addEventListener('droplet-theme-change', canonical);
    window.addEventListener('jelly-theme-change', legacy);
    const off = onThemeChange(subscriber);

    try {
      setThemeMode('dark');
      expect(document.documentElement.getAttribute('data-droplet-mode')).toBe('dark');
      expect(document.documentElement.getAttribute('data-jelly-mode')).toBe('dark');
      expect([canonical.mock.calls.length, legacy.mock.calls.length, subscriber.mock.calls.length]).toEqual([1, 1, 1]);

      window.dispatchEvent(new CustomEvent('jelly-theme-change'));
      notifyThemeChange();
      expect([canonical.mock.calls.length, legacy.mock.calls.length, subscriber.mock.calls.length]).toEqual([3, 3, 3]);
    } finally {
      setThemeMode('auto');
      off();
      window.removeEventListener('droplet-theme-change', canonical);
      window.removeEventListener('jelly-theme-change', legacy);
    }
  });
});

describe('token plumbing', () => {
  it('paints a variant label in its on-color, not the default accent label', async () => {
    const host = mount('<droplet-button variant="white">W</droplet-button>');
    const el = host.firstElementChild as DropletButton;

    try {
      await settle(2);
      const label = el.resolveColor(getComputedStyle(el.shadowRoot!.querySelector('button')!).color);
      expect(label).toBe(el.resolveColor('var(--droplet-color-foreground-on-white)'));
      expect(label).not.toBe(el.resolveColor('var(--droplet-color-foreground-on-accent)'));
    } finally {
      host.remove();
    }
  });

  it('reads a token legacy first, falling back to the canonical name', () => {
    const host = mount('<div style="--jelly-x: legacy; --droplet-x: canonical; --droplet-y: only-canonical"></div>');
    const styles = getComputedStyle(host.firstElementChild!);

    try {
      expect(readToken(styles, 'x')).toBe('legacy');
      expect(readToken(styles, 'y')).toBe('only-canonical');
    } finally {
      host.remove();
    }
  });

  it('names the canvas part under both spellings', async () => {
    const host = mount('<droplet-button>P</droplet-button>');

    try {
      await settle(1);
      const canvas = host.firstElementChild!.shadowRoot!.querySelector('canvas')!;
      expect(canvas.part.contains('droplet')).toBe(true);
      expect(canvas.part.contains('jelly')).toBe(true);
    } finally {
      host.remove();
    }
  });

  it('wakes a canvas on either motion-change event, until it disconnects', async () => {
    const host = mount('<droplet-button>M</droplet-button>');
    const el = host.firstElementChild as DropletButton;
    await settle(4);
    const wake = vi.spyOn(el, 'requestFrame');

    try {
      window.dispatchEvent(new CustomEvent('droplet-motion-change'));
      window.dispatchEvent(new CustomEvent('jelly-motion-change'));
      expect(wake).toHaveBeenCalledTimes(2);

      host.remove();
      window.dispatchEvent(new CustomEvent('droplet-motion-change'));
      expect(wake).toHaveBeenCalledTimes(2);
    } finally {
      wake.mockRestore();
      host.remove();
    }
  });

  it('keeps the library-written resizable tracks immune to a stray legacy value', () => {
    const host = mount('<droplet-resizable direction="both" style="--jelly-resizable-col-a: 5fr; width: 400px; height: 200px"><div>A</div><div>B</div><div>C</div><div>D</div></droplet-resizable>');
    const container = host.firstElementChild!.shadowRoot!.querySelector('.container')!;

    try {
      const tracks = getComputedStyle(container).gridTemplateColumns.split(' ');
      expect(tracks[0]).toBe(tracks.at(-1));
    } finally {
      host.remove();
    }
  });
});
