import { describe, expect, test, vi } from 'vitest';

import { mount, settle } from '../../testing/index.js';

import { installScopeBridge } from '../../cascade/index.js';
import { DEFAULT_CONFIG }     from '../../core/index.js';
import type { PainterFrame }  from '../../element/painter.js';
import { registerPreset }     from '../../presets/index.js';
import { PALETTE }            from '../../theme/index.js';

import { defineAll } from '../../register.js';
import { defineSlider, JellySlider, THUMB_CONFIG } from './index.js';

defineAll({ strict: false });

function offscreen (width: number, height: number): CanvasRenderingContext2D {
  const canvas  = document.createElement('canvas');
  canvas.width  = Math.round(width);
  canvas.height = Math.round(height);

  return canvas.getContext('2d')!;
}

test('upgrades with a native range input', async () => {
  const host = mount('<jelly-slider value="40"></jelly-slider>');
  const el = host.querySelector('jelly-slider') as JellySlider;

  await settle(3);
  const input = el.shadowRoot!.querySelector('input') as HTMLInputElement;
  expect(input.type).toBe('range');
  expect(input.value).toBe('40');

  host.remove();
});

test('arrow keys step the value and fire input', async () => {
  const host = mount('<jelly-slider value="40" min="0" max="100" step="5"></jelly-slider>');
  const el = host.querySelector('jelly-slider') as JellySlider;

  await settle(3);
  let inputs = 0;
  el.addEventListener('input', () => { inputs += 1; });

  const input = el.shadowRoot!.querySelector('input') as HTMLInputElement;
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));

  expect(input.value).toBe('45');
  expect(inputs).toBeGreaterThan(0);

  host.remove();
});

test('the value property reads and writes the inner input', async () => {
  const host = mount('<jelly-slider value="10"></jelly-slider>');
  const el = host.querySelector('jelly-slider') as JellySlider;

  await settle(3);
  expect(el.value).toBe('10');

  el.value = '75';
  expect((el.shadowRoot!.querySelector('input') as HTMLInputElement).value).toBe('75');

  host.remove();
});

test('participates in a form', async () => {
  const host = mount('<form><jelly-slider name="vol" value="30"></jelly-slider></form>');
  await settle(3);

  const data = new FormData(host.querySelector('form') as HTMLFormElement);
  expect(data.get('vol')).toBe('30');

  host.remove();
});

describe('jelly-slider contracts', () => {

  test('registers through the helper and is a no-op the second time', () => {
    expect(defineSlider().alreadyDefined).toEqual(['jelly-slider']);
  });

  test('reads feel from the nearest scope and lets the element override it', async () => {
    installScopeBridge(document);
    registerPreset('feel', 'slider-stiff', { pressure: 900 }, { override: true });

    const host = mount('<div data-droplet-feel="slider-stiff"><jelly-slider></jelly-slider><jelly-slider feel="gel"></jelly-slider></div>');
    await settle();

    const [a, b] = host.querySelectorAll('jelly-slider') as NodeListOf<JellySlider>;

    expect(a!.feel).toBe('slider-stiff');
    expect(a!.resolvedConfig.pressure).toBe(900);
    expect(b!.feel).toBe('gel');
    expect(b!.resolvedConfig.pressure).toBe(DEFAULT_CONFIG.pressure);

    host.remove();
  });

  test('keeps the thumb profile under a feel preset', async () => {
    registerPreset('feel', 'test-soft', { pressure: 300 }, { override: true });

    const host = mount('<jelly-slider feel="test-soft"></jelly-slider>');
    await settle();

    const el = host.firstElementChild as JellySlider;

    // The preset wins field by field over the profile, so pressure is the
    // preset's on both bodies while untouched profile fields survive
    expect(el.resolvedConfig.pressure).toBe(300);
    expect(el.thumbConfig.pressure).toBe(300);
    expect(el.thumbConfig.membraneSpring).toBe(THUMB_CONFIG.membraneSpring);
    expect(el.thumbConfig.rippleWidth).toBe(THUMB_CONFIG.rippleWidth);
    expect(el.resolvedConfig.membraneSpring).toBe(DEFAULT_CONFIG.membraneSpring);
    expect(el.thumbBody!.config.membraneSpring).toBe(THUMB_CONFIG.membraneSpring);

    host.remove();
  });

  test('re-resolves both bodies on an attribute change without rebuilding the thumb', async () => {
    const host = mount('<jelly-slider></jelly-slider>');
    await settle(6);

    const el = host.firstElementChild as JellySlider;
    const resize = vi.spyOn(el.thumbBody!, 'resize');

    el.setAttribute('quality', 'high');
    el.resolve();

    expect(el.thumbConfig.membraneSpring).toBe(THUMB_CONFIG.membraneSpring);
    expect(resize).not.toHaveBeenCalled();

    resize.mockRestore();
    host.remove();
  });

  test('applies the quality cap to both bodies and reflects the canonical alias', async () => {
    const host = mount('<jelly-slider quality="med"></jelly-slider>');
    await settle(6);

    const el = host.firstElementChild as JellySlider;

    expect(el.quality).toBe('medium');
    expect(el.getAttribute('quality')).toBe('medium');

    el.quality = 'low';
    await settle();

    expect(el.getAttribute('quality')).toBe('low');
    expect(el.resolvedConfig.samples).toBeLessThanOrEqual(120);
    expect(el.thumbConfig.samples).toBeLessThanOrEqual(120);
    expect(el.thumbBody!.config.samples).toBe(el.thumbConfig.samples);

    host.remove();
  });

  test('replays a value assigned before upgrade', async () => {
    const el = document.createElement('jelly-slider-not-yet') as HTMLElement & { value?: string };
    el.value = '17';
    document.body.appendChild(el);

    customElements.define('jelly-slider-not-yet', class extends JellySlider {});
    await settle(3);

    const slider = el as unknown as JellySlider;

    expect(slider.value).toBe('17');
    expect((slider.shadowRoot!.querySelector('input') as HTMLInputElement).value).toBe('17');

    el.remove();
  });

  test('lets a markup value attribute win over a pre-upgrade property', async () => {
    const el = document.createElement('jelly-slider-markup-wins') as HTMLElement & { value?: string };
    el.setAttribute('value', '80');
    el.value = '17';
    document.body.appendChild(el);

    customElements.define('jelly-slider-markup-wins', class extends JellySlider {});
    await settle(3);

    expect((el as unknown as JellySlider).value).toBe('80');

    el.remove();
  });

  test('emits nothing for a programmatic value set', async () => {
    const host = mount('<jelly-slider value="10"></jelly-slider>');
    await settle(3);

    const el = host.firstElementChild as JellySlider;
    const onInput = vi.fn();
    const onChange = vi.fn();

    el.addEventListener('input', onInput);
    el.addEventListener('change', onChange);

    el.value = '55';
    el.setAttribute('value', '60');
    await settle();

    expect(onInput).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();

    host.remove();
  });

  test('stays silent for a native change that committed no new value', async () => {
    const host = mount('<jelly-slider value="100"></jelly-slider>');
    await settle();

    const el = host.firstElementChild as JellySlider;
    const onChange = vi.fn();
    const onInput = vi.fn();

    el.addEventListener('change', onChange);
    el.addEventListener('input', onInput);

    // Firefox fires change for PageUp at max with the value unchanged
    el.input.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    await settle();

    expect(onChange).not.toHaveBeenCalled();
    expect(onInput).not.toHaveBeenCalled();

    el.input.value = '90';
    el.input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    el.input.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    await settle();

    expect(onInput).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledTimes(1);

    host.remove();
  });

  test('emits exactly one input and one change per keyboard step', async () => {
    const host = mount('<jelly-slider value="40" min="0" max="100" step="5"></jelly-slider>');
    await settle(3);

    const el = host.firstElementChild as JellySlider;
    const onInput = vi.fn();
    const onChange = vi.fn();

    el.addEventListener('input', onInput);
    el.addEventListener('change', onChange);

    const input = el.shadowRoot!.querySelector('input') as HTMLInputElement;

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true }));

    expect(el.value).toBe('45');
    expect(onInput).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledTimes(1);

    host.remove();
  });

  test('does not let the hidden input\'s own events escape as duplicates', async () => {
    const host = mount('<jelly-slider value="40"></jelly-slider>');
    await settle(3);

    const el = host.firstElementChild as JellySlider;
    const onInput = vi.fn();
    const onChange = vi.fn();

    el.addEventListener('input', onInput);
    el.addEventListener('change', onChange);

    const input = el.shadowRoot!.querySelector('input') as HTMLInputElement;

    input.value = '55';
    input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    input.dispatchEvent(new Event('change', { bubbles: true, composed: true }));

    expect(onInput).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(el.value).toBe('55');

    host.remove();
  });

  test('emits one input per drag move and one change on release', async () => {
    const host = mount('<jelly-slider value="40"></jelly-slider>');
    await settle(6);

    const el = host.firstElementChild as JellySlider;
    const onInput = vi.fn();
    const onChange = vi.fn();

    el.addEventListener('input', onInput);
    el.addEventListener('change', onChange);

    const track = el.shadowRoot!.querySelector('.track') as HTMLElement;
    const rect  = track.getBoundingClientRect();
    const down  = { bubbles: true, composed: true, pointerId: 7, isPrimary: true, clientY: rect.top + rect.height / 2 };

    track.dispatchEvent(new PointerEvent('pointerdown', { ...down, clientX: rect.left + rect.width * 0.25 }));
    track.dispatchEvent(new PointerEvent('pointermove', { ...down, clientX: rect.left + rect.width * 0.5 }));
    track.dispatchEvent(new PointerEvent('pointerup',   { ...down, clientX: rect.left + rect.width * 0.5 }));

    expect(onInput).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenCalledTimes(1);

    host.remove();
  });

  test('exposes dragging through :state() and clears it on pointer cancel', async () => {
    const host = mount('<jelly-slider></jelly-slider>');
    await settle(6);

    const el    = host.firstElementChild as JellySlider;
    const track = el.shadowRoot!.querySelector('.track') as HTMLElement;
    const rect  = track.getBoundingClientRect();
    const base  = { bubbles: true, composed: true, pointerId: 3, isPrimary: true, clientX: rect.left + 10, clientY: rect.top + rect.height / 2 };

    track.dispatchEvent(new PointerEvent('pointerdown', base));
    expect(el.matches(':state(dragging)')).toBe(true);

    track.dispatchEvent(new PointerEvent('pointercancel', base));
    expect(el.matches(':state(dragging)')).toBe(false);

    host.remove();
  });

  test('keeps dragging through a pointerup from a different pointer', async () => {
    const host = mount('<jelly-slider></jelly-slider>');
    await settle(6);

    const el    = host.firstElementChild as JellySlider;
    const track = el.shadowRoot!.querySelector('.track') as HTMLElement;
    const rect  = track.getBoundingClientRect();

    track.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true, composed: true, pointerId: 5, isPrimary: true,
      clientX: rect.left + 10, clientY: rect.top + rect.height / 2,
    }));

    el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, composed: true, pointerId: 99 }));

    expect(el.matches(':state(dragging)')).toBe(true);
    expect(el.dragging).toBe(true);

    host.remove();
  });

  test('ends the drag when pointer capture is lost without a pointerup', async () => {
    const host = mount('<jelly-slider></jelly-slider>');
    await settle(6);

    const el    = host.firstElementChild as JellySlider;
    const track = el.shadowRoot!.querySelector('.track') as HTMLElement;
    const rect  = track.getBoundingClientRect();

    track.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true, composed: true, pointerId: 6, isPrimary: true,
      clientX: rect.left + 10, clientY: rect.top + rect.height / 2,
    }));

    expect(el.dragging).toBe(true);

    track.dispatchEvent(new PointerEvent('lostpointercapture', { bubbles: true, composed: true, pointerId: 6 }));

    expect(el.matches(':state(dragging)')).toBe(false);
    expect(el.dragging).toBe(false);
    expect(el.pointerId).toBe(null);

    // The engine parks only when frame() reports settled, so a stuck drag flag
    // would keep this loop alive forever
    let live = true;

    for (let i = 0; i < 1200 && live; i++) {
      live = el.frame(1 / 60);
    }

    expect(live).toBe(false);

    host.remove();
  });

  test('ignores a second pointer while a drag is in flight', async () => {
    const host = mount('<jelly-slider value="50"></jelly-slider>');
    await settle(6);

    const el    = host.firstElementChild as JellySlider;
    const track = el.shadowRoot!.querySelector('.track') as HTMLElement;
    const rect  = track.getBoundingClientRect();
    const y     = rect.top + rect.height / 2;

    track.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true, composed: true, pointerId: 1, isPrimary: true,
      clientX: rect.left + rect.width * 0.25, clientY: y,
    }));

    const first = el.value;

    track.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true, composed: true, pointerId: 2, isPrimary: false,
      clientX: rect.left + rect.width * 0.9, clientY: y,
    }));

    expect(el.pointerId).toBe(1);
    expect(el.value).toBe(first);

    host.remove();
  });

  test('clears dragging state on disconnect', async () => {
    const host = mount('<jelly-slider></jelly-slider>');
    await settle(6);

    const el    = host.firstElementChild as JellySlider;
    const track = el.shadowRoot!.querySelector('.track') as HTMLElement;
    const rect  = track.getBoundingClientRect();

    track.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true, composed: true, pointerId: 4, isPrimary: true,
      clientX: rect.left + 10, clientY: rect.top + rect.height / 2,
    }));

    expect(el.matches(':state(dragging)')).toBe(true);

    host.remove();
    await settle();

    expect(el.matches(':state(dragging)')).toBe(false);
  });

  test('paints the track identically through the extracted painter slot', async () => {
    const host = mount('<jelly-slider value="35"></jelly-slider>');
    await settle(10);

    const el     = host.firstElementChild as JellySlider;
    const w      = el.cssW;
    const h      = el.cssH;
    const cx     = w / 2;
    const cy     = h / 2;
    const tW     = el.trackW;
    const trackH = el.trackH || el.sizeConfig.track;
    const track  = el.resolveColor(`var(--jelly-track, ${PALETTE['background-neutral']})`);
    const accent = el.resolveColor(`var(--jelly-accent, ${PALETTE['background-accent']})`);

    // The pre-extraction drawing, verbatim, against a matched offscreen canvas
    const direct = offscreen(w, h);
    direct.save();
    direct.beginPath();
    direct.roundRect(cx - tW / 2, cy - trackH / 2, tW, trackH, trackH / 2);
    direct.fillStyle = track;
    direct.fill();
    direct.clip();
    direct.fillStyle = accent;
    direct.fillRect(cx - tW / 2, cy - trackH / 2, el.thumbX + tW / 2, trackH);
    direct.restore();

    const viaSlot = offscreen(w, h);

    el.paintTrackPass(viaSlot);

    const pw = Math.round(w);
    const ph = Math.round(h);
    const a  = direct.getImageData(0, 0, pw, ph).data;
    const b  = viaSlot.getImageData(0, 0, pw, ph).data;

    let painted = 0;
    let diffs   = 0;

    for (let i = 0; i < a.length; i += 4) {
      if ((a[i + 3] ?? 0) > 0) {
        painted++;
      }
    }

    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) {
        diffs++;
      }
    }

    expect(painted).toBeGreaterThan(100);
    expect(diffs).toBe(0);

    host.remove();
  });

  test('isolates a throwing track painter and logs once', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    customElements.define('jelly-slider-hostile', class extends JellySlider {
      calls = 0;

      override paintTrack (): void {
        this.calls++;
        throw new Error('boom');
      }
    });

    const host = mount('<jelly-slider-hostile></jelly-slider-hostile>');
    await settle(8);

    const el = host.firstElementChild as JellySlider & { calls: number };

    expect(el.calls).toBe(1);
    expect(error).toHaveBeenCalledTimes(1);

    el.frame(16);

    expect(el.calls).toBe(1);
    expect(error).toHaveBeenCalledTimes(1);

    // painter.md: reconnecting gives a disabled painter one more chance
    const parent = el.parentElement!;

    el.remove();
    parent.appendChild(el);
    await settle(4);

    expect(el.calls).toBe(2);

    error.mockRestore();
    host.remove();
  });

  test('builds the track frame from the real render path', async () => {
    customElements.define('jelly-slider-frame-probe', class extends JellySlider {
      seen: PainterFrame | null = null;

      override paintTrack (frame: PainterFrame): void {
        this.seen = frame;
        super.paintTrack(frame);
      }
    });

    const host = mount('<jelly-slider-frame-probe value="35"></jelly-slider-frame-probe>');
    await settle(8);

    const el = host.firstElementChild as JellySlider & { seen: PainterFrame | null };

    el.seen = null;
    el.paintTrackPass();

    expect(el.seen).not.toBeNull();
    expect(el.seen!.width).toBe(el.cssW);
    expect(el.seen!.height).toBe(el.cssH);

    const local = el.body!.projectPoint(el.body!.getSurfacePoints()[0]!);

    expect(el.seen!.points[0]!.x).toBeCloseTo(local.x + el.cssW / 2, 5);
    expect(el.seen!.points[0]!.y).toBeCloseTo(local.y + el.cssH / 2, 5);

    host.remove();
  });

  test('keeps the track pass alive when the surface painter throws', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    customElements.define('jelly-slider-bad-surface', class extends JellySlider {
      trackCalls = 0;

      override paintSurface (): void {
        throw new Error('boom');
      }

      override paintTrack (frame: PainterFrame): void {
        this.trackCalls++;
        super.paintTrack(frame);
      }
    });

    const host = mount('<jelly-slider-bad-surface></jelly-slider-bad-surface>');
    await settle(8);

    const el     = host.firstElementChild as JellySlider & { trackCalls: number };
    const before = el.trackCalls;

    el.frame(1 / 60);

    expect(before).toBeGreaterThan(0);
    expect(el.trackCalls).toBeGreaterThan(before);

    error.mockRestore();
    host.remove();
  });

  test('reveals an operable native range input when there is no 2D context', async () => {
    const original = HTMLCanvasElement.prototype.getContext;

    HTMLCanvasElement.prototype.getContext = function () { return null; } as typeof original;

    const host = mount('<jelly-slider value="40" min="0" max="100" step="5"></jelly-slider>');

    HTMLCanvasElement.prototype.getContext = original;

    const el = host.firstElementChild as JellySlider;

    await settle(3);

    expect(el.hasAttribute('data-jelly-nocanvas')).toBe(true);

    const input  = el.shadowRoot!.querySelector('input') as HTMLInputElement;
    const styles = getComputedStyle(input);

    expect(styles.opacity).toBe('1');
    expect(styles.pointerEvents).toBe('auto');
    expect(input.tabIndex).toBe(0);

    // Zero cssW/cssH and no context: the geometry has to stay harmless
    expect(el.cssW).toBe(0);
    expect(() => { el.applyShape(); el.paintTrackPass(); el.frame(16); }).not.toThrow();

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true }));
    expect(el.value).toBe('45');

    host.remove();
  });

});
