import { describe, expect, it, vi } from 'vitest';

import { mount } from '../testing/index.js';

import {
  canonicalizeQualityAttribute,
  readQuality,
  replayProperties,
  warnUnknownFeel,
  writeQuality,
} from './configure.js';

describe('canonicalizeQualityAttribute', () => {
  it('rewrites a known alias and leaves garbage as written', () => {
    const host = mount('<i quality="MED"></i><i quality="potato"></i><i></i>');
    const [alias, garbage, absent] = host.querySelectorAll('i');

    canonicalizeQualityAttribute(alias!);
    canonicalizeQualityAttribute(garbage!);
    canonicalizeQualityAttribute(absent!);

    expect(alias!.getAttribute('quality')).toBe('medium');
    expect(garbage!.getAttribute('quality')).toBe('potato');
    expect(absent!.hasAttribute('quality')).toBe(false);

    host.remove();
  });

  it('leaves an already-canonical value untouched', () => {
    const host = mount('<i quality="high"></i>');
    const el = host.firstElementChild!;
    const write = vi.spyOn(el, 'setAttribute');

    canonicalizeQualityAttribute(el);

    expect(write).not.toHaveBeenCalled();
    write.mockRestore();
    host.remove();
  });
});

describe('readQuality', () => {
  it('prefers the element attribute over an ancestor scope', () => {
    const host = mount('<div style="--droplet-quality: low"><i></i><i quality="hi"></i></div>');
    const [inherited, own] = host.querySelectorAll('i');

    expect(readQuality(inherited!)).toBe('low');
    expect(readQuality(own!)).toBe('high');

    host.remove();
  });

  it('falls back to medium with no attribute and no scope', () => {
    const host = mount('<i></i>');

    expect(readQuality(host.firstElementChild!)).toBe('medium');

    host.remove();
  });
});

describe('writeQuality', () => {
  it('reflects the canonical spelling and removes on null', () => {
    const host = mount('<i></i>');
    const el = host.firstElementChild!;

    writeQuality(el, 'md');
    expect(el.getAttribute('quality')).toBe('medium');

    writeQuality(el, null);
    expect(el.hasAttribute('quality')).toBe(false);

    writeQuality(el, undefined);
    expect(el.hasAttribute('quality')).toBe(false);

    host.remove();
  });

  it('skips the write when the attribute already holds the canonical value', () => {
    const host = mount('<i quality="low"></i>');
    const el = host.firstElementChild!;
    const write = vi.spyOn(el, 'setAttribute');

    writeQuality(el, 'lo');

    expect(write).not.toHaveBeenCalled();
    write.mockRestore();
    host.remove();
  });
});

describe('replayProperties', () => {
  it('deletes the shadowing own property and reassigns through the setter', () => {
    const seen: string[] = [];
    const host = mount('<i></i>');
    const el = host.firstElementChild! as Element & { thing?: string };

    Object.defineProperty(Object.getPrototypeOf(el), 'thing', {
      configurable: true,
      set (value: string) { seen.push(value); },
      get () { return seen[seen.length - 1]; },
    });

    // The pre-upgrade write: an own property shadowing the accessor
    Object.defineProperty(el, 'thing', { configurable: true, writable: true, value: 'early' });

    replayProperties(el, ['thing']);

    expect(Object.hasOwn(el, 'thing')).toBe(false);
    expect(seen).toEqual(['early']);

    delete (Object.getPrototypeOf(el) as Record<string, unknown>).thing;
    host.remove();
  });

  it('discards the captured value when markup set the attribute', () => {
    const seen: string[] = [];
    const host = mount('<i thing="markup"></i>');
    const el = host.firstElementChild! as Element & { thing?: string };

    Object.defineProperty(Object.getPrototypeOf(el), 'thing', {
      configurable: true,
      set (value: string) { seen.push(value); },
      get () { return seen[seen.length - 1]; },
    });

    Object.defineProperty(el, 'thing', { configurable: true, writable: true, value: 'early' });

    replayProperties(el, ['thing']);

    expect(Object.hasOwn(el, 'thing')).toBe(false);
    expect(seen).toEqual([]);

    delete (Object.getPrototypeOf(el) as Record<string, unknown>).thing;
    host.remove();
  });

  it('ignores a name with no shadowing property', () => {
    const host = mount('<i></i>');

    expect(() => replayProperties(host.firstElementChild!, ['nothing'])).not.toThrow();

    host.remove();
  });
});

describe('warnUnknownFeel', () => {
  it('warns once per name per document', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const elsewhere = document.implementation.createHTMLDocument('other');

    warnUnknownFeel('configure-ghost', document);
    warnUnknownFeel('configure-ghost', document);
    expect(warn).toHaveBeenCalledTimes(1);

    warnUnknownFeel('configure-other', document);
    expect(warn).toHaveBeenCalledTimes(2);

    warnUnknownFeel('configure-ghost', elsewhere);
    expect(warn).toHaveBeenCalledTimes(3);

    warn.mockRestore();
  });
});
