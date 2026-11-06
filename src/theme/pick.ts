const MARKER = 'data-droplet-pick';

const warned = new WeakMap<Document, Set<string>>();

// Inline values color= overwrote, restored when it goes
const saved = new WeakMap<HTMLElement, { pick: [string, string]; on: [string, string] }>();

type RGBA = [number, number, number, number];

// color-mix in srgb yields sRGB from any color syntax, resolved in the host's context
function resolve (el: HTMLElement, expression: string): RGBA | null {
  const root  = el.shadowRoot ?? el;
  const probe = el.ownerDocument.createElement('span');

  probe.style.cssText = `position:absolute;width:0;height:0;visibility:hidden;color:color-mix(in srgb, ${expression} 100%, transparent)`;
  root.appendChild(probe);

  const computed = getComputedStyle(probe).color;

  probe.remove();

  const parts = computed.match(/[\d.]+/g)?.map(Number);

  if (!parts || parts.length < 3) {
    return null;
  }

  const srgb = computed.startsWith('color(');
  const [r = 0, g = 0, b = 0] = srgb ? parts : parts.map((part) => part / 255);

  return [r, g, b, parts[3] ?? 1];
}

const channel = (c: number): number => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

// Pass the fill as seen, already composited
export function onColorFor (rgb: readonly [number, number, number]): string {
  const lum = 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);

  // oklch(0.2 0 0) has a relative luminance of 0.2³
  return 1.05 / (lum + 0.05) >= (lum + 0.05) / (0.008 + 0.05) ? '#ffffff' : 'oklch(0.2 0 0)';
}

function restore (el: HTMLElement): void {
  const before = saved.get(el);

  if (!before) {
    return;
  }

  saved.delete(el);

  for (const [name, [value, priority]] of [['--droplet-pick', before.pick], ['--droplet-pick-on', before.on]] as const) {
    if (value) el.style.setProperty(name, value, priority);
    else el.style.removeProperty(name);
  }
}

function warnOnce (el: HTMLElement, value: string): void {
  let seen = warned.get(el.ownerDocument);

  if (!seen) {
    seen = new Set();
    warned.set(el.ownerDocument, seen);
  }

  if (!seen.has(value)) {
    seen.add(value);
    console.warn(`[droplet] color="${value}" is not a CSS color; ignoring it`, el);
  }
}

// The marker gates the color rules, so an invalid color leaves intent and variant in charge.
// Rerun on theme change: a translucent pick is judged over the surface, which can move.
export function syncColorPick (el: HTMLElement): void {
  const value = el.getAttribute('color')?.trim() ?? '';
  const valid = value !== '' && typeof CSS !== 'undefined' && CSS.supports('color', value);
  const fill  = valid && el.isConnected ? resolve(el, value) : null;

  if (!valid || !fill) {
    el.removeAttribute(MARKER);
    restore(el);

    if (value && !valid) {
      warnOnce(el, value);
    }

    return;
  }

  if (!saved.has(el)) {
    saved.set(el, {
      pick: [el.style.getPropertyValue('--droplet-pick'), el.style.getPropertyPriority('--droplet-pick')],
      on:   [el.style.getPropertyValue('--droplet-pick-on'), el.style.getPropertyPriority('--droplet-pick-on')],
    });
  }

  const surface = resolve(el, 'var(--jelly-color-background-surface, var(--droplet-color-background-surface, #fff))') ?? [1, 1, 1, 1];
  const alpha   = fill[3];
  const seen    = [0, 1, 2].map((i) => fill[i]! * alpha + surface[i]! * (1 - alpha)) as [number, number, number];

  // Unchanged values aren't rewritten, so a style observer that calls back here settles
  const on = onColorFor(seen);

  if (el.style.getPropertyValue('--droplet-pick') !== value) el.style.setProperty('--droplet-pick', value);
  if (el.style.getPropertyValue('--droplet-pick-on') !== on) el.style.setProperty('--droplet-pick-on', on);
  if (!el.hasAttribute(MARKER)) el.setAttribute(MARKER, '');
}
