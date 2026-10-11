import { expect, test } from 'vitest';

import { DEFAULT_CONFIG } from '../core/index.js';
import type { DropletBody } from '../core/index.js';
import { registerPreset } from '../presets/index.js';
import * as Register from '../register.js';
import { mount, settle } from '../testing/index.js';

import { DropletElement } from './index.js';

Register.defineAll({ strict: false });

registerPreset('feel', 'test-converted', { pressure: 432 }, { override: true });

const isCanvas = (value: unknown): boolean =>
  typeof value === 'function' && value.prototype instanceof DropletElement;

const canvas = Object.values(Register).filter(isCanvas) as unknown as Array<typeof DropletElement>;

test('every canvas component opts into the resolver and observes the axis attributes', () => {
  expect(canvas).toHaveLength(19);

  for (const ctor of canvas) {
    expect(ctor.usesResolver, ctor.name).toBe(true);
    expect([...ctor.REPLAYED], ctor.name).toEqual(expect.arrayContaining([...DropletElement.REPLAYED]));

    const observed = (ctor as unknown as { observedAttributes: string[] }).observedAttributes;
    expect(observed, ctor.name).toEqual(expect.arrayContaining([...DropletElement.AXIS_ATTRIBUTES]));
  }
});

type Bodies = (el: Record<string, unknown>) => Array<DropletBody | null | undefined>;

const SECONDARY: Array<[string, string, Bodies, number]> = [
  ['switch thumb', '<droplet-switch>S</droplet-switch>', (el) => [el.thumbBody as DropletBody], DEFAULT_CONFIG.pressure],
  ['range thumbs', '<droplet-range></droplet-range>', (el) => el.thumbs as DropletBody[], 700],
  ['segmented pill', '<droplet-segmented value="a"><droplet-segment value="a">A</droplet-segment><droplet-segment value="b">B</droplet-segment></droplet-segmented>', (el) => [el.pill as DropletBody], DEFAULT_CONFIG.pressure],
  ['progress blob', '<droplet-progress indeterminate></droplet-progress>', (el) => [el.blob as DropletBody], DEFAULT_CONFIG.pressure],
  ['select panel', '<droplet-select><droplet-option value="a">A</droplet-option><droplet-option value="b">B</droplet-option></droplet-select>', (el) => [el.panelBody as DropletBody], DEFAULT_CONFIG.pressure],
];

test.each(SECONDARY)('the %s follows the element feel, live', async (name, markup, bodies, rest) => {
  const host = mount(`<div style="width:320px">${markup}</div>`);

  try {
    await settle(6);

    const el = host.querySelector('div')!.firstElementChild as DropletElement & { openPanel?: () => void };

    // The select builds its panel membrane the first time it opens
    if (name === 'select panel') {
      el.openPanel!();
      await settle(4);
    }

    const read = (): Array<DropletBody | null | undefined> => bodies(el as unknown as Record<string, unknown>);

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
