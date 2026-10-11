import { describe, it, expect } from 'vitest';
import * as Register from './register.js';
import { defineAll, defineMenu, defineSelect, defineTabs, TAGS } from './register.js';

// Records the order tags are defined in without touching the real registry
function recorder (): { registry: CustomElementRegistry; seen: string[] } {
  const seen: string[] = [];
  const registry = { get: () => undefined, define: (tag: string) => { seen.push(tag); } } as unknown as CustomElementRegistry;
  return { registry, seen };
}

describe('defineAll', () => {
  it('is idempotent after the root import has already registered everything', async () => {
    await import('./jelly.js');
    const result = defineAll();
    expect(result.defined).toEqual([]);
    expect(result.collisions).toEqual([]);
    expect(result.alreadyDefined.length).toBe(Object.keys(TAGS).length);
  });

  it('batches every TAGS key exactly once, families in upgrade order', () => {
    const { registry, seen } = recorder();
    defineAll({ registry });

    expect([...seen].sort()).toEqual(Object.values(TAGS).sort());
    expect(new Set(seen).size).toBe(seen.length);
    expect(seen[0]).toBe(TAGS.theme);

    const before = (a: string, b: string): boolean => seen.indexOf(a) < seen.indexOf(b);
    expect(before(TAGS.collapsible, TAGS.accordion)).toBe(true);
    expect(before(TAGS.menuItem, TAGS.menu)).toBe(true);
    expect(before(TAGS.tabPanel, TAGS.tabs)).toBe(true);
    expect(before(TAGS.radio, TAGS.radioGroup)).toBe(true);
  });
});

describe('family helpers', () => {
  it('bring the elements their markup needs, in the root order', () => {
    const tabs = recorder();
    defineTabs({ registry: tabs.registry });
    expect(tabs.seen).toEqual([TAGS.segmented, TAGS.segment, TAGS.tabPanel, TAGS.tabs]);

    const select = recorder();
    defineSelect({ registry: select.registry });
    expect(select.seen).toEqual([TAGS.select, TAGS.option]);

    const menu = recorder();
    defineMenu({ registry: menu.registry });
    expect(menu.seen).toEqual([TAGS.menuItem, TAGS.menu]);
  });

  it('cover every family the contract names', () => {
    const cases: Array<[(options: { registry: CustomElementRegistry }) => unknown, string[]]> = [
      [Register.defineAccordion, [TAGS.collapsible, TAGS.accordion]],
      [Register.definePagination, [TAGS.button, TAGS.pagination]],
      [Register.defineRadioGroup, [TAGS.radio, TAGS.radioGroup]],
      [Register.defineSegmented, [TAGS.segmented, TAGS.segment]],
    ];

    for (const [helper, expected] of cases) {
      const { registry, seen } = recorder();
      helper({ registry });
      expect(seen).toEqual(expected);
    }
  });
});

describe('static define', () => {
  it('matches the free helper on every class, and both are strict by default', () => {
    const foreign = class extends HTMLElement {};
    const taken = { get: () => foreign, define: () => {} } as unknown as CustomElementRegistry;
    const classes = Object.entries(Register).filter(([name, value]) => /^Jelly[A-Z]/.test(name) && typeof value === 'function');

    expect(classes).toHaveLength(Object.keys(TAGS).length);

    for (const [name, ctor] of classes) {
      const helper = (Register as Record<string, unknown>)[`define${name.slice('Jelly'.length)}`] as (o: object) => unknown;
      const viaStatic = recorder();
      const viaHelper = recorder();

      (ctor as unknown as { define: (o: object) => unknown }).define({ registry: viaStatic.registry });
      helper({ registry: viaHelper.registry });

      expect(viaStatic.seen, name).toEqual(viaHelper.seen);
      expect(viaStatic.seen.length, name).toBeGreaterThan(0);
      expect(() => helper({ registry: taken }), name).toThrow(Register.RegistrationError);
    }
  });
});
