import { expect, test } from 'vitest';

import { JellyBody, traceSmoothPath } from './body.js';
import { DEFAULT_CONFIG } from './config.js';

const normalsOf = (body: JellyBody): Array<[number, number]> =>
  body.membrane.map((point) => [point.nx, point.ny]);

test('membrane sampling rejects non-finite counts and clamps undersized counts', () => {
  const fallback = new JellyBody({ width: 100, height: 40, config: { samples: Infinity } });
  const clamped = new JellyBody({ width: 100, height: 40, config: { samples: 0 } });
  const fractional = new JellyBody({ width: 100, height: 40, config: { samples: 4.2 } });

  expect(fallback.membrane).toHaveLength(DEFAULT_CONFIG.samples);
  expect(clamped.membrane).toHaveLength(4);
  expect(fractional.membrane).toHaveLength(5);
});

test('tracing an empty path clears any path already on the context', () => {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d')!;

  context.lineWidth = 4;
  context.beginPath();
  context.moveTo(0, 10);
  context.lineTo(20, 10);
  expect(context.isPointInStroke(10, 10)).toBe(true);

  traceSmoothPath(context, []);
  expect(context.isPointInStroke(10, 10)).toBe(false);
});

test('normalBlendPasses changes the membrane normals when overridden', () => {
  const base = { width: 120, height: 40, radius: 20 };
  const smooth = new JellyBody({ ...base, config: { normalBlendPasses: 6 } });
  const raw = new JellyBody({ ...base, config: { normalBlendPasses: 0 } });

  const differs = smooth.membrane.some((p, i) => {
    const q = raw.membrane[i]!;
    return Math.abs(p.nx - q.nx) > 1e-6 || Math.abs(p.ny - q.ny) > 1e-6;
  });

  expect(differs).toBe(true);
});

test('normalBlendPasses clamps to the 0-6 safety bound at the constructor', () => {
  const base = { width: 100, height: 40, radius: 18 };
  const high   = new JellyBody({ ...base, config: { normalBlendPasses: 99 } });
  const capped = new JellyBody({ ...base, config: { normalBlendPasses: 6 } });
  const low    = new JellyBody({ ...base, config: { normalBlendPasses: -3 } });
  const zero   = new JellyBody({ ...base, config: { normalBlendPasses: 0 } });
  const bogus  = new JellyBody({ ...base, config: { normalBlendPasses: Number.NaN } });
  const fallback = new JellyBody({ ...base, config: { normalBlendPasses: DEFAULT_CONFIG.normalBlendPasses } });

  expect(high.config.normalBlendPasses).toBe(6);
  expect(low.config.normalBlendPasses).toBe(0);
  expect(bogus.config.normalBlendPasses).toBe(DEFAULT_CONFIG.normalBlendPasses);

  // The stored value is not enough: the membrane must be built with the clamped count
  expect(normalsOf(high)).toEqual(normalsOf(capped));
  expect(normalsOf(low)).toEqual(normalsOf(zero));
  expect(normalsOf(bogus)).toEqual(normalsOf(fallback));
});

test('resize keeps the 0-6 safety bound after config is mutated directly', () => {
  const base = { width: 100, height: 40, radius: 18 };
  const mutated = new JellyBody({ ...base, config: { normalBlendPasses: 2 } });
  const bounded = new JellyBody({ ...base, config: { normalBlendPasses: 6 } });

  mutated.config.normalBlendPasses = 99;
  mutated.resize(140, 50, 20);
  bounded.resize(140, 50, 20);

  expect(mutated.config.normalBlendPasses).toBe(6);
  expect(normalsOf(mutated)).toEqual(normalsOf(bounded));
});
