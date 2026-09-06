import { describe, it, expect } from 'vitest';
import { installScopeBridge, readScopedAxis, onScopeChange } from './index.js';
import { mount, raf } from '../testing/index.js';

describe('cascade bridge', () => {
  it('propagates a scope attribute to descendants as a custom property', async () => {
    installScopeBridge(document);
    const host = mount(`<section data-droplet-feel="goo"><div id="t"></div></section>`);
    await raf();
    expect(readScopedAxis(host.querySelector('#t')!, 'feel')).toBe('goo');
    host.remove();
  });

  it('resolves a scope inserted together with its children, with no frame in between', () => {
    installScopeBridge(document);
    const host = mount(`<section data-droplet-feel="goo"><div id="t"></div></section>`);
    expect(readScopedAxis(host.querySelector('#t')!, 'feel')).toBe('goo');
    host.remove();
  });

  it('a light-DOM scope reaches a shadow descendant', async () => {
    installScopeBridge(document);
    const host = mount(`<section data-droplet-quality="low"><div id="h"></div></section>`);
    const inner = host.querySelector('#h')!.attachShadow({ mode: 'open' });
    inner.innerHTML = `<span id="deep"></span>`;
    await raf();
    expect(readScopedAxis(inner.querySelector('#deep')!, 'quality')).toBe('low');
    host.remove();
  });

  it('updates live and notifies', async () => {
    installScopeBridge(document);
    const host = mount(`<section data-droplet-feel="gel"><div id="t"></div></section>`);
    let fired = 0;
    const off = onScopeChange(document, () => fired++);
    host.firstElementChild!.setAttribute('data-droplet-feel', 'liquid');
    await raf();
    expect(readScopedAxis(host.querySelector('#t')!, 'feel')).toBe('liquid');
    expect(fired).toBe(1);
    off();
    host.remove();
  });

  it('nearest scope wins', async () => {
    installScopeBridge(document);
    const host = mount(`<div data-droplet-feel="goo"><div data-droplet-feel="solid"><i id="t"></i></div></div>`);
    await raf();
    expect(readScopedAxis(host.querySelector('#t')!, 'feel')).toBe('solid');
    host.remove();
  });

  it('ends with the property removed when a scope is set then removed in one tick', async () => {
    installScopeBridge(document);
    const host = mount(`<section data-droplet-material="matte"><div id="t"></div></section>`);
    await raf();
    const scope = host.firstElementChild as HTMLElement;
    scope.setAttribute('data-droplet-material', 'glass');
    scope.removeAttribute('data-droplet-material');
    await raf();
    expect(scope.style.getPropertyValue('--droplet-material')).toBe('');
    expect(readScopedAxis(host.querySelector('#t')!, 'material')).toBe(null);
    host.remove();
  });

  it('restores the next ancestor value when the nearer scope attribute is removed', async () => {
    installScopeBridge(document);
    const host = mount(`<div data-droplet-palette="dusk"><div id="mid" data-droplet-palette="dawn"><i id="t"></i></div></div>`);
    await raf();
    host.querySelector('#mid')!.removeAttribute('data-droplet-palette');
    await raf();
    expect(readScopedAxis(host.querySelector('#t')!, 'palette')).toBe('dusk');
    host.remove();
  });

  it('resolves for elements inserted later without any observer work', async () => {
    installScopeBridge(document);
    const host = mount(`<section data-droplet-substance="foam"></section>`);
    await raf();
    const late = document.createElement('div');
    host.firstElementChild!.appendChild(late);
    expect(readScopedAxis(late, 'substance')).toBe('foam');
    host.remove();
  });

  it('returns null for an element under no scope', () => {
    installScopeBridge(document);
    const host = mount(`<div id="t"></div>`);
    expect(readScopedAxis(host.querySelector('#t')!, 'feel')).toBe(null);
    host.remove();
  });

  it('is idempotent per document', async () => {
    installScopeBridge(document);
    installScopeBridge(document);
    const host = mount(`<section data-droplet-feel="gel"><div id="t"></div></section>`);
    let fired = 0;
    const off = onScopeChange(document, () => fired++);
    host.firstElementChild!.setAttribute('data-droplet-feel', 'goo');
    await raf();
    expect(fired).toBe(1);
    expect(readScopedAxis(host.querySelector('#t')!, 'feel')).toBe('goo');
    off();
    host.remove();
  });

  it('stops notifying after unsubscribe', async () => {
    installScopeBridge(document);
    const host = mount(`<section data-droplet-feel="gel"></section>`);
    let fired = 0;
    onScopeChange(document, () => fired++)();
    host.firstElementChild!.setAttribute('data-droplet-feel', 'goo');
    await raf();
    expect(fired).toBe(0);
    host.remove();
  });
});
