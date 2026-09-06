import { describe, it, expect, vi } from 'vitest';

import { defineElements, RegistrationError } from './index.js';

const uniq = () => `x-${Math.random().toString(36).slice(2)}`;

describe('defineElements', () => {
  it('defines a fresh tag and reports it', () => {
    class A extends HTMLElement {}
    const tag = uniq();
    const result = defineElements([[tag, A]]);
    expect(result.defined).toEqual([tag]);
    expect(customElements.get(tag)).toBe(A);
  });

  it('is a silent no-op for the same class twice', () => {
    class A extends HTMLElement {}
    const tag = uniq();
    defineElements([[tag, A]]);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = defineElements([[tag, A]]);
    expect(result.alreadyDefined).toEqual([tag]);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('warns and skips a foreign constructor by default', () => {
    class A extends HTMLElement {}
    class B extends HTMLElement {}
    const tag = uniq();
    defineElements([[tag, A]]);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = defineElements([[tag, B]]);
    expect(result.collisions).toHaveLength(1);
    expect(result.collisions[0]!.existing).toBe(A);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(customElements.get(tag)).toBe(A);
    warn.mockRestore();
  });

  it('warns only once per tag per registry', () => {
    class A extends HTMLElement {}
    class B extends HTMLElement {}
    const tag = uniq();
    defineElements([[tag, A]]);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    defineElements([[tag, B]]);
    const second = defineElements([[tag, B]]);
    expect(second.collisions).toHaveLength(1);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('still defines the fresh entries alongside a collision', () => {
    class A extends HTMLElement {}
    class B extends HTMLElement {}
    class C extends HTMLElement {}
    const taken = uniq();
    const fresh = uniq();
    defineElements([[taken, A]]);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = defineElements([[taken, B], [fresh, C]]);
    expect(result.defined).toEqual([fresh]);
    expect(customElements.get(fresh)).toBe(C);
    warn.mockRestore();
  });

  it('throws in strict mode and defines nothing else in the batch', () => {
    class A extends HTMLElement {}
    class B extends HTMLElement {}
    class C extends HTMLElement {}
    const taken = uniq();
    const fresh = uniq();
    defineElements([[taken, A]]);
    expect(() => defineElements([[fresh, C], [taken, B]], { strict: true })).toThrow(RegistrationError);
    expect(customElements.get(fresh)).toBeUndefined();
  });

  it('carries the preflight result and the colliding tags on the thrown error', () => {
    class A extends HTMLElement {}
    class B extends HTMLElement {}
    const taken = uniq();
    defineElements([[taken, A]]);
    try {
      defineElements([[taken, B]], { strict: true });
      expect.unreachable('strict mode should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(RegistrationError);
      const registrationError = error as RegistrationError;
      expect(registrationError.result.defined).toEqual([]);
      expect(registrationError.result.collisions).toHaveLength(1);
      expect(registrationError.message).toContain(taken);
    }
  });

  it('treats the same tag twice in one batch as already defined', () => {
    class A extends HTMLElement {}
    const tag = uniq();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = defineElements([[tag, A], [tag, A]]);
    expect(result.defined).toEqual([tag]);
    expect(result.alreadyDefined).toEqual([tag]);
    expect(warn).not.toHaveBeenCalled();
    expect(customElements.get(tag)).toBe(A);
    warn.mockRestore();
  });

  it('reports a duplicate tag with a different constructor as a collision', () => {
    class A extends HTMLElement {}
    class B extends HTMLElement {}
    const tag = uniq();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = defineElements([[tag, A], [tag, B]]);
    expect(result.defined).toEqual([tag]);
    expect(result.collisions).toHaveLength(1);
    expect(result.collisions[0]!.existing).toBe(A);
    expect(result.collisions[0]!.requested).toBe(B);
    expect(customElements.get(tag)).toBe(A);
    warn.mockRestore();
  });

  it('throws before defining anything when one batch carries a conflicting duplicate', () => {
    class A extends HTMLElement {}
    class B extends HTMLElement {}
    const tag = uniq();
    expect(() => defineElements([[tag, A], [tag, B]], { strict: true })).toThrow(RegistrationError);
    expect(customElements.get(tag)).toBeUndefined();
  });

  it('accepts a scoped registry where the platform has one', () => {
    if (typeof CustomElementRegistry !== 'function') return;
    let registry: CustomElementRegistry;
    try { registry = new CustomElementRegistry(); } catch { return; }
    class A extends HTMLElement {}
    const tag = uniq();
    const result = defineElements([[tag, A]], { registry });
    expect(result.defined).toEqual([tag]);
    expect(customElements.get(tag)).toBeUndefined();
  });
});
