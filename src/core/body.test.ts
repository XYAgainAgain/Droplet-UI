import { expect, test } from 'vitest';

import { JellyBody, traceSmoothPath } from './body.js';
import { DEFAULT_CONFIG } from './config.js';

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
