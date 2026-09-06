import { describe, it, expect } from 'vitest';
import { registerPreset, getPreset, listPresets, PresetError } from './index.js';
// gel reaches the registry the way a consumer gets it: the resolver imports it.
import '../resolve/index.js';

describe('preset registry', () => {
  it('registers and returns a frozen copy', () => {
    registerPreset('feel', 'my-goo', { pressure: 400 });
    const p = getPreset<{ pressure: number }>('feel', 'my-goo')!;
    expect(p.pressure).toBe(400);
    expect(Object.isFrozen(p)).toBe(true);
    expect(listPresets('feel')).toContain('my-goo');
  });

  it('rejects bad names and duplicates', () => {
    expect(() => registerPreset('feel', 'Bad Name', {})).toThrow(PresetError);
    registerPreset('feel', 'dup-test', {});
    expect(() => registerPreset('feel', 'dup-test', {})).toThrow(PresetError);
    expect(() => registerPreset('feel', 'dup-test', {}, { override: true })).not.toThrow();
  });

  it('protects built-ins unless overridden', () => {
    expect(() => registerPreset('feel', 'gel', {})).toThrow(PresetError);
  });

  it('validates feel records as finite numbers inside safety bounds', () => {
    expect(() => registerPreset('feel', 'nan-feel', { pressure: Number.NaN })).toThrow(PresetError);
    expect(() => registerPreset('feel', 'huge-samples', { samples: 100000 })).toThrow(PresetError);
  });

  it('round-trips through JSON', () => {
    registerPreset('feel', 'json-feel', { pressure: 300, maxBulge: 10 });
    const copy = JSON.parse(JSON.stringify(getPreset('feel', 'json-feel')));
    expect(copy).toEqual({ pressure: 300, maxBulge: 10 });
  });

  it('rejects names that do not match the lowercase pattern', () => {
    for (const bad of ['', '1st', '-lead', 'trailing_', 'UPPER']) {
      expect(() => registerPreset('feel', bad, {})).toThrow(PresetError);
    }
    expect(() => registerPreset('feel', 'ok-name-9', {})).not.toThrow();
  });

  it('rejects records that do not survive a JSON round trip', () => {
    expect(() => registerPreset('palette', 'fn-palette', { paint: () => 0 } as object)).toThrow(PresetError);
    expect(() => registerPreset('palette', 'undef-palette', { ink: undefined } as object)).toThrow(PresetError);
    const cyclic: Record<string, unknown> = {};
    cyclic['self'] = cyclic;
    expect(() => registerPreset('palette', 'cyclic-palette', cyclic)).toThrow(PresetError);
    expect(() => registerPreset('palette', 'array-palette', [1, 2] as unknown as object)).toThrow(PresetError);
    class Ink { readonly hue = 1; }
    expect(() => registerPreset('palette', 'class-palette', { ink: new Ink() })).toThrow(PresetError);
  });

  it('rejects records whose shape would not survive a JSON copy', () => {
    const sparse: unknown[] = [1];
    sparse[3] = 2;
    expect(() => registerPreset('palette', 'sparse-palette', { ramp: sparse })).toThrow(PresetError);

    const labelled: Record<string, unknown> = { hue: 1 };
    labelled[Symbol('tag') as unknown as string] = 'x';
    expect(() => registerPreset('palette', 'symbol-palette', labelled)).toThrow(PresetError);

    const hidden = {};
    Object.defineProperty(hidden, 'hue', { value: 1, enumerable: false });
    expect(() => registerPreset('palette', 'hidden-palette', hidden)).toThrow(PresetError);

    const accessor = {};
    Object.defineProperty(accessor, 'hue', { get: () => 1, enumerable: true });
    expect(() => registerPreset('palette', 'accessor-palette', accessor)).toThrow(PresetError);

    const tagged = [1, 2];
    Object.defineProperty(tagged, 'note', { value: 'x', enumerable: true });
    expect(() => registerPreset('palette', 'tagged-palette', { ramp: tagged })).toThrow(PresetError);
  });

  it('accepts a plain record built in another realm', () => {
    const frame = document.createElement('iframe');
    document.body.append(frame);
    const realm = frame.contentWindow as (Window & typeof globalThis) | null;
    expect(realm).not.toBeNull();
    const record = Object.assign(new realm!.Object(), { accent: '#000' }) as object;
    try {
      expect(() => registerPreset('palette', 'realm-palette', record)).not.toThrow();
      expect(getPreset('palette', 'realm-palette')).toEqual({ accent: '#000' });
    } finally {
      frame.remove();
    }
  });

  it('rejects feel keys that are not physics config keys', () => {
    expect(() => registerPreset('feel', 'bogus-key', { nope: 1 } as object)).toThrow(PresetError);
  });

  it('accepts any JSON-safe record on the axes Phases 5 and 6 tighten', () => {
    expect(() => registerPreset('palette', 'brand', { accent: '#ff0055', ramp: [1, 2, 3] })).not.toThrow();
    expect(getPreset('palette', 'brand')).toEqual({ accent: '#ff0055', ramp: [1, 2, 3] });
  });

  it('stores a deep copy, so later mutation of the caller object changes nothing', () => {
    const record: { pressure: number } = { pressure: 200 };
    registerPreset('feel', 'copied-feel', record);
    record.pressure = 999;
    expect(getPreset<{ pressure: number }>('feel', 'copied-feel')!.pressure).toBe(200);
  });

  it('returns null for an unknown name and lists names sorted', () => {
    expect(getPreset('feel', 'never-registered')).toBeNull();
    expect(getPreset('material', 'never-registered')).toBeNull();
    const names = listPresets('feel');
    expect(names).toEqual([...names].sort());
    expect(names).toContain('gel');
  });

  it('scopes a document registry over the module-level one', () => {
    const scoped = document.implementation.createHTMLDocument('scoped');
    registerPreset('feel', 'gel', { pressure: 111 }, { document: scoped, override: true });
    registerPreset('feel', 'scoped-only', { pressure: 222 }, { document: scoped });

    expect(getPreset<{ pressure: number }>('feel', 'gel', scoped)!.pressure).toBe(111);
    expect(getPreset('feel', 'gel')).toEqual({});
    expect(getPreset('feel', 'scoped-only', scoped)).toEqual({ pressure: 222 });
    expect(getPreset('feel', 'scoped-only')).toBeNull();
    expect(listPresets('feel', scoped)).toContain('gel');
    expect(listPresets('feel', scoped)).toContain('my-goo');
  });
});
