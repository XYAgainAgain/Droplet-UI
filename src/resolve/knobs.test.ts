import { describe, expect, test } from 'vitest';

import { mount, settle } from '../testing/index.js';
import '../testing/define-all.js';

import { DEFAULT_CONFIG, DropletBody } from '../core/index.js';
import type { DropletConfig } from '../core/index.js';
import { registerPreset, PresetError } from '../presets/index.js';
import type { DropletElement } from '../element/index.js';

import { applyKnobs, KNOBS, readKnob, resolveConfig } from './index.js';
import type { Knob, Knobs } from './index.js';

const ratio = (config: DropletConfig): number => config.membraneDamping / (2 * Math.sqrt(config.membraneSpring));

describe('feel knobs', () => {

  test('leave the record alone at 0.5', () => {
    const config = { ...DEFAULT_CONFIG };

    applyKnobs(config, Object.fromEntries(KNOBS.map((knob) => [knob, 0.5])));

    expect(config).toEqual(DEFAULT_CONFIG);
  });

  test('keep the damping ratio when viscosity changes the stiffness', () => {
    const thick = { ...DEFAULT_CONFIG };
    const thin  = { ...DEFAULT_CONFIG };

    applyKnobs(thick, { viscosity: 1 });
    applyKnobs(thin, { viscosity: 0 });

    expect(thick.membraneSpring).toBeLessThan(DEFAULT_CONFIG.membraneSpring);
    expect(thin.membraneSpring).toBeGreaterThan(DEFAULT_CONFIG.membraneSpring);
    expect(ratio(thick)).toBeCloseTo(ratio(DEFAULT_CONFIG), 6);
    expect(ratio(thin)).toBeCloseTo(ratio(DEFAULT_CONFIG), 6);
  });

  test('turn bounce into a lower damping ratio and softness into bigger dents', () => {
    const bouncy = { ...DEFAULT_CONFIG };
    const soft   = { ...DEFAULT_CONFIG };

    applyKnobs(bouncy, { bounce: 1 });
    applyKnobs(soft, { softness: 1 });

    expect(ratio(bouncy)).toBeLessThan(ratio(DEFAULT_CONFIG));
    expect(soft.maxBulge).toBeCloseTo(DEFAULT_CONFIG.maxBulge * 2, 6);
    expect(soft.membraneSpring).toBe(DEFAULT_CONFIG.membraneSpring);
  });

  test('leave out-of-range and switched-off profile fields alone at 0.5', () => {
    const config = { ...DEFAULT_CONFIG, membraneSpring: 0, membraneDamping: 17, waveCoupling: 500 };

    expect(applyKnobs(config, { bounce: 0.5, viscosity: 0.5, spread: 0.5 })).toEqual([]);
    expect(config).toMatchObject({ membraneSpring: 0, membraneDamping: 17, waveCoupling: 500 });

    applyKnobs(config, { bounce: 1 });
    expect(config).toMatchObject({ membraneSpring: 0, membraneDamping: 17 });
  });

  test('scale every held depth, inside presses included', () => {
    const config = { ...DEFAULT_CONFIG, insideHeldDepthAmount: 4, holdPressAmount: 2 };

    applyKnobs(config, { depth: 1 });

    expect(config.insideHeldDepthAmount).toBeCloseTo(8, 6);
    expect(config.holdPressAmount).toBeCloseTo(4, 6);
  });

  test('read attribute text as a clamped 0–1 number or nothing', () => {
    expect(readKnob('0.25')).toBe(0.25);
    expect(readKnob('7')).toBe(1);
    expect(readKnob('-1')).toBe(0);
    expect(readKnob('soft')).toBe(null);
    expect(readKnob('')).toBe(null);
    expect(readKnob(null)).toBe(null);
  });

});

describe('knobs in the resolver', () => {

  test('apply a preset bundle, let element knobs beat it, and let raw config beat both', () => {
    registerPreset('feel', 'test-knobby', { knobs: { softness: 1 } }, { override: true });

    const preset  = resolveConfig({ feel: 'test-knobby' });
    const element = resolveConfig({ feel: 'test-knobby', knobs: { softness: 0.5 } });
    const raw     = resolveConfig({ feel: 'test-knobby', raw: { maxBulge: 3 } });

    expect(preset.config.maxBulge).toBeCloseTo(DEFAULT_CONFIG.maxBulge * 2, 6);
    expect(preset.provenance.maxBulge).toBe('knob');
    expect(element.config.maxBulge).toBe(DEFAULT_CONFIG.maxBulge);
    expect(raw.config.maxBulge).toBe(3);
    expect(raw.provenance.maxBulge).toBe('raw');
  });

  test('ship the states of matter as knob bundles that change the physics', () => {
    for (const feel of ['solid', 'liquid', 'goo', 'plasma', 'gas']) {
      const resolved = resolveConfig({ feel });

      expect(resolved.feel).toBe(feel);
      expect(resolved.config).not.toEqual(DEFAULT_CONFIG);
    }

    expect(resolveConfig({ feel: 'gas' }).config.maxBulge).toBeGreaterThan(resolveConfig({ feel: 'solid' }).config.maxBulge);
  });

  test('reject a knob bundle with unknown dials or values off the scale', () => {
    expect(() => registerPreset('feel', 'bad-knobs', { knobs: { wobble: 0.5 } })).toThrow(PresetError);
    expect(() => registerPreset('feel', 'bad-range', { knobs: { softness: 2 } })).toThrow(PresetError);
  });

  test('reach a control through attributes and properties, live', async () => {
    const host = mount('<droplet-button softness="1">Soft</droplet-button>');
    const el   = host.firstElementChild as DropletElement & { softness: number | null; bounce: number | null };

    await settle(4);

    expect(el.softness).toBe(1);
    expect(el.resolvedConfig.maxBulge).toBeCloseTo(DEFAULT_CONFIG.maxBulge * 2, 6);

    el.softness = null;
    el.bounce   = 0.9;

    expect(el.hasAttribute('softness')).toBe(false);
    expect(el.resolvedConfig.maxBulge).toBe(DEFAULT_CONFIG.maxBulge);
    expect(ratio(el.resolvedConfig)).toBeLessThan(ratio(DEFAULT_CONFIG));

    host.remove();
  });

});

// Every knob pair at both extremes, at 60 and 30 Hz, stays finite without recoverIfUnstable and settles
describe('knob stability sweep', () => {

  const pairs: Array<[Knob, Knob]> = [];

  for (let i = 0; i < KNOBS.length; i++) {
    for (let j = i + 1; j < KNOBS.length; j++) pairs.push([KNOBS[i]!, KNOBS[j]!]);
  }

  test.each(pairs)('%s × %s', (a, b) => {
    for (const [va, vb] of [[0, 0], [0, 1], [1, 0], [1, 1]] as const) {
      for (const dt of [1 / 60, 1 / 30]) {
        const knobs: Knobs   = { [a]: va, [b]: vb };
        const { config }     = resolveConfig({ knobs });
        const body           = new DropletBody({ width: 200, height: 60, radius: 30, config: { ...config } });
        const recover        = body.recoverIfUnstable.bind(body);

        let rescued = false;

        body.recoverIfUnstable = () => {
          rescued ||= body.membrane.some((p) => !Number.isFinite(p.d) || !Number.isFinite(p.v) || Math.abs(p.d) > 500);
          recover();
        };

        body.pressAtLocal(30, 0, 1.12);

        for (let t = 0; t < 0.3; t += dt) body.update(dt);

        body.release();
        body.centerPop(1.2);

        let rested = false;

        for (let t = 0; t < 12; t += dt) {
          body.update(dt);

          if (body.isResting()) {
            rested = true;
            break;
          }
        }

        expect(rescued, `${a}=${va} ${b}=${vb} at ${Math.round(1 / dt)} Hz went unstable`).toBe(false);
        expect(rested, `${a}=${va} ${b}=${vb} at ${Math.round(1 / dt)} Hz never settled`).toBe(true);
      }
    }
  });

});
