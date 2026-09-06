import { describe, it, expect } from 'vitest';
import { resolveConfig, parseQuality, SAFETY_BOUNDS } from './index.js';
import { DEFAULT_CONFIG } from '../core/index.js';
import { getPreset, listPresets, registerPreset } from '../presets/index.js';

describe('resolveConfig', () => {
  it('returns the baseline when nothing is set', () => {
    const r = resolveConfig({});
    expect(r.config).toEqual(DEFAULT_CONFIG);
    expect(r.provenance.samples).toBe('baseline');
    expect(r.feel).toBe('gel');
  });

  it('applies profile, then raw, and records provenance', () => {
    const r = resolveConfig({ profile: { pressure: 500 }, raw: { pressure: 700, maxDent: 4 } });
    expect(r.config.pressure).toBe(700);
    expect(r.provenance.pressure).toBe('raw');
    expect(r.config.maxDent).toBe(4);
  });

  it('lets quality cap win over raw, within safety bounds', () => {
    const r = resolveConfig({ raw: { samples: 240 }, quality: 'low' });
    expect(r.config.samples).toBe(120);
    expect(r.provenance.samples).toBe('quality');
  });

  it('clamps raw values to safety bounds', () => {
    expect(resolveConfig({ raw: { samples: 9999 } }).config.samples).toBe(480);
  });

  it('is order independent and immutable', () => {
    const a = resolveConfig({ raw: { pressure: 1 }, profile: { pressure: 2 } });
    const b = resolveConfig({ profile: { pressure: 2 }, raw: { pressure: 1 } });
    expect(a.config).toEqual(b.config);
    expect(Object.isFrozen(a.config)).toBe(true);
  });

  it('resolves a registered feel preset through the registry', () => {
    registerPreset('feel', 'test-soft', { pressure: 300 });
    const r = resolveConfig({ profile: { heldCurveSpring: 200 }, feel: 'test-soft' });
    expect(r.config.pressure).toBe(300);
    expect(r.provenance.pressure).toBe('feel');
    expect(r.config.heldCurveSpring).toBe(200);
    expect(r.provenance.heldCurveSpring).toBe('profile');
    expect(r.feel).toBe('test-soft');
  });

  it('falls back to gel on an unknown feel without warning', () => {
    const warn = console.warn;
    let warned = 0;
    console.warn = () => { warned += 1; };
    try {
      const r = resolveConfig({ feel: 'nope-not-here' });
      expect(r.feel).toBe('gel');
      expect(r.config).toEqual(DEFAULT_CONFIG);
    } finally {
      console.warn = warn;
    }
    expect(warned).toBe(0);
  });

  it('drops non-finite values and unknown keys silently', () => {
    const r = resolveConfig({ raw: { pressure: Number.NaN, samples: Number.POSITIVE_INFINITY, nope: 3 } as never });
    expect(r.config.pressure).toBe(DEFAULT_CONFIG.pressure);
    expect(r.config.samples).toBe(DEFAULT_CONFIG.samples);
    expect(r.provenance.pressure).toBe('baseline');
    expect('nope' in r.config).toBe(false);
  });

  it('clamps the profile layer too and keeps its provenance', () => {
    const r = resolveConfig({ profile: { samples: 9999 } });
    expect(r.config.samples).toBe(SAFETY_BOUNDS.samples?.[1]);
    expect(r.provenance.samples).toBe('profile');
  });

  it('records quality provenance only for fields the cap changed', () => {
    const r = resolveConfig({ raw: { samples: 60 }, quality: 'low' });
    expect(r.config.samples).toBe(60);
    expect(r.provenance.samples).toBe('raw');
    expect(r.config.normalBlendPasses).toBe(2);
    expect(r.provenance.normalBlendPasses).toBe('quality');
  });

  it('rounds the integer-valued fields so the body cannot store something else', () => {
    const r = resolveConfig({ raw: { normalBlendPasses: 2.5, samples: 60.4 } });
    expect(r.config.normalBlendPasses).toBe(3);
    expect(r.config.samples).toBe(60);
    expect(r.provenance.normalBlendPasses).toBe('raw');
  });

  it('freezes the provenance record and reports the effective quality', () => {
    const r = resolveConfig({ quality: 'high' });
    expect(Object.isFrozen(r.provenance)).toBe(true);
    expect(r.quality).toBe('high');
    expect(resolveConfig({}).quality).toBe('medium');
  });

  it('registers the built-in gel through the normal resolver import', () => {
    expect(getPreset('feel', 'gel')).toEqual({});
    expect(listPresets('feel')).toContain('gel');
  });

  it('looks a feel name up as written, so a mixed-case variant is unknown', () => {
    registerPreset('feel', 'case-soft', { pressure: 321 });
    for (const written of ['CASE-SOFT', 'Case-Soft', '  case-soft  ']) {
      const r = resolveConfig({ feel: written });
      expect(r.feel).toBe('gel');
      expect(r.config.pressure).toBe(DEFAULT_CONFIG.pressure);
      expect(r.provenance.pressure).toBe('baseline');
    }
  });

  it('parses quality aliases', () => {
    expect(parseQuality('med')).toBe('medium');
    expect(parseQuality('HIGH')).toBe('high');
    expect(parseQuality('lo')).toBe('low');
    expect(parseQuality('hi')).toBe('high');
    expect(parseQuality('potato')).toBe('medium');
  });
});
