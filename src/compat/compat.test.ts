import { describe, expect, it, vi } from 'vitest';

import '../jelly.js';
import * as Compat from './index.js';
import * as Register from '../register.js';
import { LEGACY_TAGS, TAGS } from '../registry/index.js';
import type { TagKey } from '../registry/index.js';
import { mount, settle } from '../testing/index.js';

// Records what a helper would define without touching the real registry
function recorder (): { registry: CustomElementRegistry; seen: string[] } {
  const seen: string[] = [];
  const registry = { get: () => undefined, define: (tag: string) => { seen.push(tag); } } as unknown as CustomElementRegistry;
  return { registry, seen };
}

const KEYS = Object.keys(TAGS) as TagKey[];

describe('legacy aliases', () => {
  it('register every Jelly UI tag as its own subclass of the canonical element', () => {
    for (const key of KEYS) {
      const legacy = customElements.get(LEGACY_TAGS[key]);
      const canonical = customElements.get(TAGS[key]);

      expect(legacy, LEGACY_TAGS[key]).toBeTypeOf('function');
      expect(canonical, TAGS[key]).toBeTypeOf('function');
      expect(legacy).not.toBe(canonical);
      expect(legacy!.prototype).toBeInstanceOf(canonical!);
      expect(legacy!.name).toMatch(/^Jelly[A-Z]/);
    }
  });

  it('export each alias under its Jelly UI class name', () => {
    for (const key of KEYS) {
      const ctor = customElements.get(LEGACY_TAGS[key])!;
      expect((Compat as Record<string, unknown>)[ctor.name], ctor.name).toBe(ctor);
    }
  });

  it('define only their own legacy tag through each static helper', () => {
    for (const key of KEYS) {
      const ctor = customElements.get(LEGACY_TAGS[key]) as unknown as { define: (o: object) => unknown; name: string };
      const { registry, seen } = recorder();
      ctor.define({ registry });
      expect(seen, ctor.name).toEqual([LEGACY_TAGS[key]]);
    }
  });

  it('batch the canonical library and then every legacy tag in the same order, warning instead of throwing', () => {
    const canonical = recorder();
    Register.defineAll({ registry: canonical.registry });

    const { registry, seen } = recorder();
    Compat.defineCompat({ registry });

    const legacyOrder = canonical.seen.map((tag) => LEGACY_TAGS[(Object.keys(TAGS) as TagKey[]).find((key) => TAGS[key] === tag)!]);
    expect(seen).toEqual([...canonical.seen, ...legacyOrder]);

    const foreign = class extends HTMLElement {};
    const taken = { get: () => foreign, define: () => {} } as unknown as CustomElementRegistry;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      expect(Compat.defineCompat({ registry: taken }).collisions).toHaveLength(KEYS.length * 2);
      expect(warn).toHaveBeenCalledTimes(KEYS.length * 2);
      expect(() => Compat.defineCompat({ registry: taken, strict: true })).toThrow(Register.RegistrationError);
    } finally {
      warn.mockRestore();
    }
  });

  it('keep the Jelly UI root exports and the toast global', async () => {
    const root = await import('../jelly.js');
    expect(root.JellyElement).toBe(root.DropletElement);
    expect(root.JellyBody).toBe(root.DropletBody);
    expect(root.jellyToast).toBe(root.dropletToast);
    expect(root.jellyIcon).toBe(root.dropletIcon);
    expect(window.jellyToast).toBe(window.dropletToast);
  });

  it('upgrade legacy markup, and a canonical element can host legacy children and the reverse', async () => {
    const host = mount(`
      <jelly-accordion single id="legacy">
        <droplet-collapsible label="A" open>A</droplet-collapsible>
        <jelly-collapsible label="B">B</jelly-collapsible>
      </jelly-accordion>
      <droplet-accordion single id="canonical">
        <jelly-collapsible label="C" open>C</jelly-collapsible>
        <droplet-collapsible label="D">D</droplet-collapsible>
      </droplet-accordion>
    `);

    try {
      await settle(4);

      for (const id of ['legacy', 'canonical']) {
        const accordion = host.querySelector(`#${id}`)!;
        const [first, second] = [...accordion.children] as Array<HTMLElement & { open: boolean; toggle: (force?: boolean) => void }>;

        expect(first!.open, id).toBe(true);
        second!.toggle(true);
        await settle(2);
        expect(first!.open, id).toBe(false);
        expect(second!.open, id).toBe(true);
      }
    } finally {
      host.remove();
    }
  });
});
