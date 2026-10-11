import { expect, test } from 'vitest';

import { DEFAULT_CONFIG } from '../core/index.js';
import type { JellyBody } from '../core/index.js';
import { registerPreset } from '../presets/index.js';
import * as Register from '../register.js';
import { mount, settle } from '../testing/index.js';

import { JellyElement } from './index.js';

Register.defineAll({ strict: false });

registerPreset('feel', 'test-converted', { pressure: 432 }, { override: true });

const isCanvas = (value: unknown): boolean =>
  typeof value === 'function' && value.prototype instanceof JellyElement;

const canvas = Object.values(Register).filter(isCanvas) as unknown as Array<typeof JellyElement>;

test('every canvas component opts into the resolver and observes the axis attributes', () => {
  expect(canvas).toHaveLength(19);

  for (const ctor of canvas) {
    expect(ctor.usesResolver, ctor.name).toBe(true);
    expect([...ctor.REPLAYED], ctor.name).toEqual(expect.arrayContaining([...JellyElement.REPLAYED]));

    const observed = (ctor as unknown as { observedAttributes: string[] }).observedAttributes;
    expect(observed, ctor.name).toEqual(expect.arrayContaining([...JellyElement.AXIS_ATTRIBUTES]));
  }
});

type Bodies = (el: Record<string, unknown>) => Array<JellyBody | null | undefined>;

const SECONDARY: Array<[string, string, Bodies, number]> = [
  ['switch thumb', '<jelly-switch>S</jelly-switch>', (el) => [el.thumbBody as JellyBody], DEFAULT_CONFIG.pressure],
  ['range thumbs', '<jelly-range></jelly-range>', (el) => el.thumbs as JellyBody[], 700],
  ['segmented pill', '<jelly-segmented value="a"><jelly-segment value="a">A</jelly-segment><jelly-segment value="b">B</jelly-segment></jelly-segmented>', (el) => [el.pill as JellyBody], DEFAULT_CONFIG.pressure],
  ['progress blob', '<jelly-progress indeterminate></jelly-progress>', (el) => [el.blob as JellyBody], DEFAULT_CONFIG.pressure],
  ['select panel', '<jelly-select><jelly-option value="a">A</jelly-option><jelly-option value="b">B</jelly-option></jelly-select>', (el) => [el.panelBody as JellyBody], DEFAULT_CONFIG.pressure],
];

test.each(SECONDARY)('the %s follows the element feel, live', async (name, markup, bodies, rest) => {
  const host = mount(`<div style="width:320px">${markup}</div>`);

  try {
    await settle(6);

    const el = host.querySelector('div')!.firstElementChild as JellyElement & { openPanel?: () => void };

    // The select builds its panel membrane the first time it opens
    if (name === 'select panel') {
      el.openPanel!();
      await settle(4);
    }

    const read = (): Array<JellyBody | null | undefined> => bodies(el as unknown as Record<string, unknown>);

    expect(read().length).toBeGreaterThan(0);
    for (const body of read()) {
      expect(body!.config.pressure).toBe(rest);
    }

    el.setAttribute('feel', 'test-converted');
    for (const body of read()) {
      expect(body!.config.pressure).toBe(432);
    }

    el.removeAttribute('feel');
    for (const body of read()) {
      expect(body!.config.pressure).toBe(rest);
    }
  } finally {
    host.remove();
  }
});
