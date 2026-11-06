import { afterEach, describe, expect, test, vi } from 'vitest';

import { mount, settle } from '../testing/index.js';
import '../testing/define-all.js';
import { defineCompat } from '../compat/index.js';

import type { DropletElement } from '../element/index.js';

import { onColorFor } from './pick.js';

defineCompat();

afterEach(() => vi.restoreAllMocks());

function pixel (el: DropletElement, x: number, y: number): number[] {
  const canvas = el.canvas;
  const rect   = canvas.getBoundingClientRect();
  const host   = el.getBoundingClientRect();
  const scale  = canvas.width / rect.width;
  const px     = Math.round((host.left + x - rect.left) * scale);
  const py     = Math.round((host.top + y - rect.top) * scale);

  return [...canvas.getContext('2d')!.getImageData(px, py, 1, 1).data];
}

const near = (a: number[], b: number[], tolerance = 3): boolean => a.slice(0, 3).every((c, i) => Math.abs(c - (b[i] ?? 0)) <= tolerance);

describe('color="..." (the #beef69 fixture)', () => {

  test('Nuclear Chartreuse paints exactly on a button, with a dark label', async () => {
    const host = mount('<droplet-button color="#beef69" style="width: 200px">Chartreuse</droplet-button>');
    const el   = host.firstElementChild as DropletElement;

    await settle(40);

    expect(near(pixel(el, 100, 31), [0xbe, 0xef, 0x69])).toBe(true);
    expect(el.style.getPropertyValue('--droplet-pick-on')).toBe('oklch(0.2 0 0)');

    host.remove();
  });

  test('reaches accent controls: a checked checkbox and a slider thumb', async () => {
    const host = mount('<droplet-checkbox checked color="#beef69"></droplet-checkbox><droplet-slider color="#beef69" value="50" style="width: 200px"></droplet-slider>');
    const [box, slider] = [...host.children] as DropletElement[];

    await settle(40);

    const boxRect = box!.getBoundingClientRect();

    expect(near(pixel(box!, boxRect.height / 2, boxRect.height / 2), [0xbe, 0xef, 0x69], 6)).toBe(true);
    expect(near(pixel(slider!, 100, slider!.getBoundingClientRect().height / 2), [0xbe, 0xef, 0x69], 6)).toBe(true);

    host.remove();
  });

  test('beats intent, which beats variant', async () => {
    const host = mount('<droplet-button variant="mint" intent="danger" style="width: 200px">A</droplet-button><droplet-button variant="rose" style="width: 200px">B</droplet-button><droplet-button variant="mint" intent="danger" color="oklch(0.7 0.2 300)" style="width: 200px">C</droplet-button>');
    const [a, b, c] = [...host.children] as DropletElement[];

    await settle(40);

    expect(near(pixel(a!, 100, 31), pixel(b!, 100, 31))).toBe(true);
    expect(near(pixel(c!, 100, 31), pixel(a!, 100, 31), 10)).toBe(false);

    host.remove();
  });

  test('ignores what is not a color, once per value, leaving intent in charge, and follows changes live', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const host = mount('<droplet-button color="nuclear" intent="danger" style="width: 200px">X</droplet-button><droplet-button color="nuclear" style="width: 200px">Y</droplet-button><droplet-button intent="danger" style="width: 200px">Z</droplet-button><droplet-button color="" intent="danger" style="width: 200px">W</droplet-button>');
    const [el, , danger, empty] = [...host.children] as DropletElement[];

    await settle(40);

    expect(warn.mock.calls.filter((call) => String(call[0]).includes('nuclear'))).toHaveLength(1);
    expect(el!.style.getPropertyValue('--droplet-pick')).toBe('');
    expect(near(pixel(el!, 100, 31), pixel(danger!, 100, 31))).toBe(true);
    expect(near(pixel(empty!, 100, 31), pixel(danger!, 100, 31))).toBe(true);

    // Wait out the crossfade instead of counting frames
    el!.setAttribute('color', '#beef69');
    await vi.waitFor(() => expect(near(pixel(el!, 100, 31), [0xbe, 0xef, 0x69])).toBe(true), { timeout: 3000 });

    el!.removeAttribute('color');
    expect(el!.style.getPropertyValue('--droplet-pick')).toBe('');

    host.remove();
  });

  test('judges a translucent color as it shows over the surface, and reads currentColor in place', async () => {
    const host = mount('<droplet-button color="rgba(0, 0, 0, 0.15)">Faint</droplet-button><div style="color: rgb(20, 20, 120)"><droplet-button color="currentColor">Inherited</droplet-button></div>');
    const [faint, inherited] = host.querySelectorAll('droplet-button');

    await settle(6);

    expect((faint as HTMLElement).style.getPropertyValue('--droplet-pick-on')).toBe('oklch(0.2 0 0)');
    expect((inherited as HTMLElement).style.getPropertyValue('--droplet-pick-on')).toBe('#ffffff');

    host.remove();
  });

  test('puts back an inline pick the author set when color goes away', async () => {
    const host = mount('<droplet-button style="--droplet-pick: red; width: 200px">Own</droplet-button>');
    const el   = host.firstElementChild as HTMLElement;

    await settle(3);
    expect(el.style.getPropertyValue('--droplet-pick')).toBe('red');

    el.setAttribute('color', '#beef69');
    expect(el.style.getPropertyValue('--droplet-pick')).toBe('#beef69');

    el.removeAttribute('color');
    expect(el.style.getPropertyValue('--droplet-pick')).toBe('red');

    host.remove();
  });

  test('works on a legacy jelly-* tag too', async () => {
    const host = mount('<jelly-button color="#beef69" style="width: 200px">Legacy</jelly-button>');

    await settle(40);

    expect(near(pixel(host.firstElementChild as DropletElement, 100, 31), [0xbe, 0xef, 0x69])).toBe(true);

    host.remove();
  });

  test('picks the readable on-color', () => {
    expect(onColorFor([0.745, 0.937, 0.412])).toBe('oklch(0.2 0 0)');
    expect(onColorFor([0.1, 0.1, 0.4])).toBe('#ffffff');
  });

});
