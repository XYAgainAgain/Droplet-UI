import { afterEach, describe, expect, test, vi } from 'vitest';

import { mount, settle } from '../testing/index.js';
import '../testing/define-all.js';

import { canvasPointToViewport, getLights, lightsFor, MAX_LIGHTS_PER_SCOPE, normalizeLight, setLights, staticLights, totalLight } from './index.js';

afterEach(() => {
  setLights(null, { flashSafety: false });
  vi.useRealTimers();
  document.documentElement.removeAttribute('data-droplet-motion');
});

describe('light records', () => {

  test('fill defaults and clamp what they accept', () => {
    const light = normalizeLight({ kind: 'point', x: 10, y: 20, intensity: -2, softness: 3, elevation: 200 });

    expect(light).toMatchObject({ kind: 'point', x: 10, y: 20, height: 400, intensity: 0, softness: 1, elevation: 90, region: null });
    expect(light.rgb).toEqual([1, 1, 1]);
    expect(normalizeLight({ kind: 'bogus' as 'point' }).kind).toBe('directional');
  });

  test('parse CSS colors and pass shader triples straight through, folding HDR into intensity', () => {
    expect(normalizeLight({ kind: 'ambient', color: '#ff0000' }).rgb).toEqual([1, 0, 0]);
    expect(normalizeLight({ kind: 'ambient', color: [0.25, 0.5, -1] }).rgb).toEqual([0.25, 0.5, 0]);

    const hdr = normalizeLight({ kind: 'ambient', color: [0.5, 2, 0], intensity: 0.5 });

    expect(hdr.rgb).toEqual([0.25, 1, 0]);
    expect(hdr.intensity).toBe(1);
    expect(Number.isFinite(normalizeLight({ kind: 'ambient', color: [2, 0, 0], intensity: Number.MAX_VALUE }).intensity)).toBe(true);

    const oklch = normalizeLight({ kind: 'ambient', color: 'oklch(0.7 0.15 230)' }).rgb;

    expect(oklch[2]).toBeGreaterThan(oklch[0]);
  });

  test('turn an open region edge into an unbounded one', () => {
    const { region } = normalizeLight({ kind: 'ambient', region: { top: 120 } });

    expect(region).toEqual({ top: 120, right: Infinity, bottom: Infinity, left: -Infinity, feather: 3 });
  });

  test('read static directions, mirroring logical ones in RTL', () => {
    const key = (value: string, rtl = false): number | undefined => staticLights(value, rtl)?.find((light) => light.kind === 'directional')?.angle;

    expect(key('top')).toBe(0);
    expect(key('top-start')).toBe(330);
    expect(key('top-start', true)).toBe(30);
    expect(key('120deg')).toBe(120);
    expect(key('-90')).toBe(270);
    expect(staticLights('overhead', false)?.find((light) => light.kind === 'directional')?.elevation).toBe(90);
    expect(staticLights('none', false)).toEqual([]);
    expect(staticLights('sideways', false)).toBe(null);
  });

});

describe('the light store', () => {

  test('gives a repeated id a distinct one, so flash safety can match lights', () => {
    setLights([{ kind: 'ambient', id: 'a' }, { kind: 'ambient', id: 'a' }, { kind: 'ambient', id: 'a' }]);

    expect(getLights().map((light) => light.id)).toEqual(['a', 'a~2', 'a~3']);
  });

  test('keeps document lights and caps a scope at the per-scope limit', () => {
    setLights(Array.from({ length: 20 }, (_, i) => ({ kind: 'ambient', intensity: 0.1, id: `a${i}` })));

    expect(getLights()).toHaveLength(MAX_LIGHTS_PER_SCOPE);

    setLights([]);
    expect(getLights()).toHaveLength(0);
  });

  test('lets the nearest scope win, across a shadow boundary', async () => {
    const host = mount('<div id="panel"><droplet-button>Inner</droplet-button></div><droplet-button>Outer</droplet-button>');
    const panel = host.querySelector('#panel')!;
    const [inner, outer] = host.querySelectorAll('droplet-button');

    setLights([{ kind: 'ambient', intensity: 0.4, id: 'page' }]);
    setLights([{ kind: 'ambient', intensity: 0.9, id: 'panel' }], { scope: panel });

    expect(lightsFor(inner!)?.[0]?.id).toBe('panel');
    expect(lightsFor(outer!)?.[0]?.id).toBe('page');

    const probe = inner!.shadowRoot!.appendChild(document.createElement('span'));

    expect(lightsFor(probe)?.[0]?.id).toBe('panel');

    setLights(null, { scope: panel });
    host.remove();
  });

  test('falls back to a static data-droplet-light, then to nothing', async () => {
    const host = mount('<div data-droplet-light="top-end"><droplet-button>Lit</droplet-button></div><droplet-button>Plain</droplet-button>');
    await settle(2);

    const [lit, plain] = host.querySelectorAll('droplet-button');

    expect(lightsFor(lit!)?.find((light) => light.kind === 'directional')?.angle).toBe(30);
    expect(lightsFor(plain!)).toBe(null);

    host.remove();
  });

});

describe('flash safety', () => {

  const flash = (intensity: number): void => setLights([{ kind: 'ambient', intensity }]);

  test('holds a fourth rise inside one second, lets every fall through, and lands the latest after', () => {
    vi.useFakeTimers();
    flash(1);

    for (let i = 0; i < 3; i++) {
      flash(1.5);
      flash(1);
    }

    expect(totalLight(getLights())).toBeCloseTo(1, 5);

    flash(1.5);
    expect(totalLight(getLights())).toBeCloseTo(1, 5);

    vi.advanceTimersByTime(1001);
    expect(totalLight(getLights())).toBeCloseTo(1.5, 5);
  });

  test('raises a light in capped steps that still arrive at the target', () => {
    vi.useFakeTimers();
    flash(1);
    flash(5);

    expect(totalLight(getLights())).toBeCloseTo(1.6, 5);

    vi.advanceTimersByTime(5000);
    expect(totalLight(getLights())).toBeCloseTo(5, 5);
  });

  test('counts brightness swapped between two regions even when the total holds', () => {
    vi.useFakeTimers();

    const swap = (top: number, bottom: number): void => setLights([
      { kind: 'ambient', intensity: top, region: { bottom: 100 }, id: 'sky' },
      { kind: 'ambient', intensity: bottom, region: { top: 100 }, id: 'sea' },
    ]);

    swap(0.1, 2);
    swap(2, 0.1);

    const sky = (): number => getLights().find((light) => light.id === 'sky')!.intensity;

    expect(sky()).toBeLessThan(2);

    for (let i = 0; i < 8; i++) swap(i % 2 ? 0.1 : 2, i % 2 ? 2 : 0.1);
    vi.advanceTimersByTime(10000);
    expect(sky()).toBeCloseTo(0.1, 5);
  });

  test('tightens both limits under reduced motion', () => {
    vi.useFakeTimers();
    document.documentElement.setAttribute('data-droplet-motion', 'reduce');
    flash(1);

    flash(5);
    expect(totalLight(getLights())).toBeCloseTo(1.25, 5);

    vi.advanceTimersByTime(20000);
    expect(totalLight(getLights())).toBeCloseTo(5, 5);

    flash(1);

    for (let i = 0; i < 2; i++) {
      flash(1.2);
      flash(1);
    }

    flash(1.2);
    expect(totalLight(getLights())).toBeCloseTo(1, 5);
  });

  test('lets a fall land at once while a capped rise is still arriving', () => {
    vi.useFakeTimers();
    flash(1);
    flash(10);
    expect(totalLight(getLights())).toBeCloseTo(1.6, 5);

    flash(0.5);
    expect(totalLight(getLights())).toBeCloseTo(0.5, 5);

    vi.advanceTimersByTime(5000);
    expect(totalLight(getLights())).toBeCloseTo(0.5, 5);
  });

  test('lets the falling lights of a held update land while its rising ones wait', () => {
    vi.useFakeTimers();

    const pair = (a: number, b: number): void => setLights([
      { kind: 'ambient', intensity: a, id: 'a' },
      { kind: 'ambient', intensity: b, id: 'b' },
    ]);

    pair(1, 1);

    for (let i = 0; i < 3; i++) {
      pair(1.4, 1);
      pair(1, 1);
    }

    pair(1.4, 0.2);

    const intensity = (id: string): number => getLights().find((light) => light.id === id)!.intensity;

    expect(intensity('a')).toBeCloseTo(1, 5);
    expect(intensity('b')).toBeCloseTo(0.2, 5);

    vi.advanceTimersByTime(1001);
    expect(intensity('a')).toBeCloseTo(1.4, 5);
  });

  test('sums a rise spread across several lights', () => {
    vi.useFakeTimers();

    const four = (intensity: number): void => setLights(['a', 'b', 'c', 'd'].map((id) => ({ kind: 'ambient', intensity, id })));

    four(1);

    for (let i = 0; i < 3; i++) {
      four(1.5);
      four(1);
    }

    four(1.5);
    expect(totalLight(getLights())).toBeCloseTo(4, 5);
  });

  test('lets small drift through freely and stands aside when the author opts out', () => {
    vi.useFakeTimers();
    flash(1);

    for (let i = 0; i < 20; i++) flash(1 + (i % 2) * 0.05);
    expect(totalLight(getLights())).toBeCloseTo(1.05, 5);

    setLights([{ kind: 'ambient', intensity: 6 }], { flashSafety: false });
    setLights([{ kind: 'ambient', intensity: 0.1 }], { flashSafety: false });
    setLights([{ kind: 'ambient', intensity: 6 }], { flashSafety: false });
    setLights([{ kind: 'ambient', intensity: 0.1 }], { flashSafety: false });
    expect(totalLight(getLights())).toBeCloseTo(0.1, 5);
  });

});

test('takes a scope from a same-origin iframe', async () => {
  const host  = mount('<iframe></iframe>');
  const frame = host.querySelector('iframe')!;
  const doc   = frame.contentDocument!;

  expect(() => setLights([{ kind: 'ambient', intensity: 0.5 }], { scope: doc })).not.toThrow();
  expect(getLights(doc)).toHaveLength(1);

  const inner = doc.body.appendChild(doc.createElement('div'));

  expect(lightsFor(inner)?.[0]?.intensity).toBe(0.5);

  setLights(null, { scope: doc });
  host.remove();
});

test('maps a point in a canvas drawing buffer to viewport px', () => {
  const host   = mount('<canvas width="400" height="200" style="position: fixed; left: 30px; top: 50px; width: 200px; height: 100px"></canvas>');
  const canvas = host.querySelector('canvas')!;

  expect(canvasPointToViewport(canvas, 300, 40)).toEqual({ x: 180, y: 70 });

  host.remove();
});

describe('whole-run review', () => {

  test('clearing a scope and setting it again stays inside the flash envelope', () => {
    vi.useFakeTimers();

    const scope = document.body.appendChild(document.createElement('div'));

    setLights([{ kind: 'ambient', intensity: 3, id: 'bolt' }], { scope });
    expect(totalLight(getLights(scope))).toBeCloseTo(3, 5);

    setLights(null, { scope });
    setLights([{ kind: 'ambient', intensity: 3, id: 'bolt' }], { scope });

    expect(totalLight(getLights(scope))).toBeLessThan(3);

    setLights(null, { scope, flashSafety: false });
    scope.remove();
  });

  test('a clear that would be a fourth rise in a second waits its turn', () => {
    vi.useFakeTimers();

    const scope = document.body.appendChild(document.createElement('div'));
    const dark  = (): void => setLights([{ kind: 'ambient', intensity: 0.01 }], { scope });

    dark();

    for (let i = 0; i < 3; i++) {
      setLights(null, { scope });
      expect(getLights(scope)).toHaveLength(0);
      dark();
    }

    setLights(null, { scope });
    expect(getLights(scope)).toHaveLength(1);

    vi.advanceTimersByTime(1100);
    expect(getLights(scope)).toHaveLength(0);

    scope.remove();
  });

  test('a clear that opts out of flash safety forgets the history, even after the scope let go', () => {
    vi.useFakeTimers();

    const scope = document.body.appendChild(document.createElement('div'));

    setLights([{ kind: 'ambient', intensity: 3, id: 'bolt' }], { scope });
    setLights(null, { scope });
    setLights(null, { scope, flashSafety: false });
    setLights([{ kind: 'ambient', intensity: 3, id: 'bolt' }], { scope });

    expect(totalLight(getLights(scope))).toBeCloseTo(3, 5);

    setLights(null, { scope, flashSafety: false });
    scope.remove();
  });

  test('clearing a scope on the root element measures the document lights it uncovers', () => {
    vi.useFakeTimers();

    const root = document.documentElement;
    // Matches the default rig, so each clear rises only from the brighter document lights
    const dim  = (): void => setLights([
      { kind: 'ambient', intensity: 0.72, id: 'rig-ambient' },
      { kind: 'directional', angle: 330, elevation: 50, intensity: 0.4, softness: 0.4, id: 'rig-key' },
    ], { scope: root });

    setLights([{ kind: 'ambient', intensity: 3 }]);
    dim();

    for (let i = 0; i < 3; i++) {
      setLights(null, { scope: root });
      dim();
    }

    setLights(null, { scope: root });
    expect(getLights(root)).toHaveLength(2);

    setLights(null, { scope: root, flashSafety: false });
  });

  test('ignores keywords that are only object prototype names', () => {
    for (const word of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
      expect(staticLights(word, false)).toBe(null);
      expect(staticLights(word, true)).toBe(null);
    }
  });

});
