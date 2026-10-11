import { expect, test } from 'vitest';

import { mount, raf } from '../../testing/index.js';

import type { DropletTheme } from './index.js';
import '../../testing/define-all.js';

test('mode="dark" scopes the dark tokens to its subtree', async () => {
  const host = mount('<droplet-theme mode="dark"><span class="child">x</span></droplet-theme>');
  const el = host.querySelector('droplet-theme') as DropletTheme;
  await raf();

  expect(el.resolvedMode).toBe('dark');

  const child = host.querySelector('.child') as HTMLElement;
  const bg = getComputedStyle(child).getPropertyValue('--jelly-color-background-default').trim();
  // dark background-default is oklch(0.2198 …)
  expect(bg).toContain('0.2198');

  host.remove();
});

test('a custom accent publishes a resolved accent + readable on-color', async () => {
  const host = mount('<droplet-theme accent="#7C3AED"><span class="child">x</span></droplet-theme>');
  await raf();

  const child = host.querySelector('.child') as HTMLElement;
  const accent = getComputedStyle(child).getPropertyValue('--jelly-color-background-accent').trim();
  const onAccent = getComputedStyle(child).getPropertyValue('--jelly-color-foreground-on-accent').trim();

  expect(accent).toBe('#7C3AED');
  expect(onAccent).toBe('#FFFFFF'); // white is the readable label on this purple

  host.remove();
});
