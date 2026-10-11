import { expect, test } from 'vitest';

import { dropletIcon, ICONS } from './index.js';

test('renders a sized, decorative SVG by default', () => {
  const svg = dropletIcon('heart', { size: 18 });

  expect(svg.startsWith('<svg')).toBe(true);
  expect(svg).toContain('width="18"');
  expect(svg).toContain('height="18"');
  expect(svg).toContain('aria-hidden="true"');
  expect(svg).toContain('viewBox="0 0 24 24"');
});

test('a label makes the icon meaningful and escapes quotes', () => {
  const svg = dropletIcon('warning', { label: 'Heads "up"' });

  expect(svg).toContain('role="img"');
  expect(svg).toContain('aria-label="Heads &quot;up&quot;"');
  expect(svg).not.toContain('aria-hidden');
});

test('every registered icon renders non-empty SVG markup', () => {
  for (const name of Object.keys(ICONS) as (keyof typeof ICONS)[]) {
    const svg = dropletIcon(name);
    expect(svg, name).toContain('<svg');
    expect(svg, name).toContain('</svg>');
  }
});
