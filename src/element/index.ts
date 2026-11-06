import { DropletBody }            from '../core/index.js';
import { engine }               from '../core/index.js';
import { traceSmoothPath }      from '../core/index.js';
import type { DropletComponent }  from '../core/index.js';
import type { DropletConfig }     from '../core/index.js';
import type { SurfacePoint }    from '../core/index.js';

import { canonicalizeSize }     from '../utilities/index.js';
import { isRTL }                from '../utilities/index.js';
import { prefersReducedMotion } from '../utilities/index.js';
import { triggerHaptic }        from '../utilities/index.js';

import { ensureThemeTokens }    from '../theme/index.js';
import { FOCUS_RING }           from '../theme/index.js';
import { PALETTE }              from '../theme/index.js';

import baseStyles               from '../styles/base.css?inline';

import { installScopeBridge }    from '../cascade/index.js';
import { onScopeChange }         from '../cascade/index.js';
import { readScopedAxis }        from '../cascade/index.js';

import { isConfigKey }           from '../resolve/index.js';
import { KNOBS }                 from '../resolve/index.js';
import { readKnob }              from '../resolve/index.js';
import type { Knob }             from '../resolve/index.js';
import type { Knobs }            from '../resolve/index.js';
import { resolveConfig }         from '../resolve/index.js';
import { sameConfig }            from '../resolve/index.js';
import type { Quality }          from '../resolve/index.js';
import type { Resolved }         from '../resolve/index.js';
import type { ResolveInputs }    from '../resolve/index.js';

import { HTMLElementBase }       from './base.js';

import { canonicalizeQualityAttribute } from './configure.js';
import { readNamedAxis }                from './configure.js';
import { readQuality }                  from './configure.js';
import { replayProperties }             from './configure.js';
import { warnUnknownFeel }              from './configure.js';
import { writeNamedAxis }               from './configure.js';
import { writeQuality }                 from './configure.js';

import { buildFrame }            from './painter.js';
import type { PainterFrame }     from './painter.js';

import type { RGBA }             from './types.js';
import type { Shape }            from './types.js';
import type { Ring }             from './types.js';
import type { Border }           from './types.js';
import type { PaintOptions }     from './types.js';
import type { WirePressOptions } from './types.js';
import { LOG_PREFIX }            from '../registry/tags.js';
import { readToken } from '../theme/token-read.js';
import { syncColorPick } from '../theme/pick.js';
import { onPresetRegistered } from '../presets/index.js';

import { anchored }              from '../light/index.js';
import { defaultRig }            from '../light/index.js';
import { forEachLightSubscriber } from '../light/index.js';
import { lightGeneration }       from '../light/index.js';
import { lightsFor }             from '../light/index.js';
import { subscribeLights }       from '../light/index.js';
import type { Light }            from '../light/index.js';
import type { ResolvedRegion }   from '../light/index.js';

import { causticsOf }            from '../material/index.js';
import { incidences }            from '../material/index.js';
import { maskRegion }            from '../material/index.js';
import { materialRecord }        from '../material/index.js';
import { MATTE }                 from '../material/index.js';
import { paintShading }          from '../material/index.js';
import type { Caustic }          from '../material/index.js';
import type { ShadePhase }       from '../material/index.js';
import type { Shading }          from '../material/index.js';
import { shade }                 from '../material/index.js';
import type { Bounds }           from '../material/index.js';
import type { MaterialRecord }   from '../material/index.js';
import type { RGB }              from '../material/index.js';

export type { RGBA, Shape, Ring, Border, PaintOptions, WirePressOptions } from './types.js';
export type { PainterFrame } from './painter.js';

// Keyed by body so each membrane keeps its record (the slider's thumb resolves separately)
const appliedRecords = new WeakMap<DropletBody, Resolved>();

const warnedMaterials = new WeakMap<Document, Set<string>>();

// A material registered or replaced after controls painted with its name repaints them
onPresetRegistered((axis) => {
  if (axis !== 'material') return;

  forEachLightSubscriber((subscriber) => {
    if (subscriber instanceof DropletElement) subscriber.refreshMaterial();
  });
});

// Pooled, never per paint: slot 0 isolates a lit surface, slot 1 renders a zone pass or alpha map
const scratches: (HTMLCanvasElement | null)[] = [null, null];

// Only area is cleared and only area is read back, so the rest of a scratch can stay stale
function scratchFor (slot: 0 | 1, area: Area, device: DOMMatrix): CanvasRenderingContext2D | null {
  const canvas = (scratches[slot] ??= document.createElement('canvas'));

  if (canvas.width < area.x + area.w)  canvas.width  = area.x + area.w;
  if (canvas.height < area.y + area.h) canvas.height = area.y + area.h;

  const ctx = canvas.getContext('2d');

  if (ctx) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.clearRect(area.x, area.y, area.w, area.h);
    ctx.setTransform(device);
  }

  return ctx;
}

interface Area {
  x: number;
  y: number;
  w: number;
  h: number;
}

// CSS px around a surface's points: the traced curve and the shading's soft edges stay inside it
const AREA_PAD = 4;

// Device px a surface's lit paint can touch: its bounds through the transform, clamped to the canvas
function deviceArea (m: DOMMatrix, b: Bounds, width: number, height: number): Area {
  const corners = [
    [b.x - AREA_PAD, b.y - AREA_PAD], [b.x + b.w + AREA_PAD, b.y - AREA_PAD],
    [b.x - AREA_PAD, b.y + b.h + AREA_PAD], [b.x + b.w + AREA_PAD, b.y + b.h + AREA_PAD],
  ] as const;

  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;

  for (const [x, y] of corners) {
    const px = m.a * x + m.c * y + m.e;
    const py = m.b * x + m.d * y + m.f;

    x0 = Math.min(x0, px);
    y0 = Math.min(y0, py);
    x1 = Math.max(x1, px);
    y1 = Math.max(y1, py);
  }

  const x = Math.max(0, Math.floor(x0));
  const y = Math.max(0, Math.floor(y0));

  return { x, y, w: Math.min(width, Math.ceil(x1)) - x, h: Math.min(height, Math.ceil(y1)) - y };
}

// Two device px in eight directions puts some copy over 1.8 px inward along any straight edge's normal, past a
// pixel's √2 span, so a capsule's edge pixels turn opaque; the original goes on last so colors inside stay exact
const DILATE = [
  [2, 0], [1.414, 1.414], [0, 2], [-1.414, 1.414], [-2, 0], [-1.414, -1.414], [0, -2], [1.414, -1.414], [0, 0],
] as const;

interface Shaded {
  shading: Shading;
  ambient: RGB;
  caustics: Caustic[];
}

// One per body: its steady-light shading, kept while the light, color, and material stay put
interface ShadeEntry extends Shaded {
  key: string;
  canvas: HTMLCanvasElement;
  bounds: Bounds;
  live: HTMLCanvasElement | null;
  liveKey: string;
}

const shadeCaches = new WeakMap<object, ShadeEntry>();

// How far a body may stretch from its cached size before the shading is redrawn
const SHADE_STRETCH = 0.15;

function alphaOf (color: string): number {
  const slash = color.split('/')[1];

  if (slash !== undefined) {
    const value = parseFloat(slash);

    return slash.includes('%') ? value / 100 : value;
  }

  return color.startsWith('rgba(') ? Number(color.match(/[\d.]+/g)?.[3] ?? 1) : 1;
}

function rgbOf (color: string): RGB {
  const [r = 0, g = 0, b = 0] = (color.match(/[\d.]+/g) ?? []).map(Number);

  return color.startsWith('color(') ? [r, g, b] : [r / 255, g / 255, b / 255];
}

// Self-overdraw keeps the color and roughly doubles a small alpha, so eleven rounds take 1/255 to opaque
function thicken (target: CanvasRenderingContext2D, area: Area): void {
  target.save();
  target.setTransform(1, 0, 0, 1, 0, 0);
  target.globalAlpha = 1;
  target.globalCompositeOperation = 'source-over';

  for (let i = 0; i < 11; i++) target.drawImage(target.canvas, area.x, area.y, area.w, area.h, area.x, area.y, area.w, area.h);

  target.restore();
}

// Coarse mode rounds to what a repaint could show: 1 px, 1°, 1% intensity, one color step
function lightSignature (lights: readonly Light[] | null, coarse = false): string {
  if (!lights) {
    return '';
  }

  const r = (value: number, step: number): number => (coarse ? Math.round(value / step) : value);

  return lights.map((light) => [
    light.kind, r(light.x, 1), r(light.y, 1), r(light.height, 1), r(light.angle, 1), r(light.elevation, 1),
    r(light.intensity, 0.01), r(light.softness, 0.01), r(light.caustics, 0.01), light.rgb.map((c) => r(c, 1 / 255)).join(','),
    light.region ? [light.region.top, light.region.right, light.region.bottom, light.region.left, light.region.feather].map((v) => r(v, 1)).join(',') : '',
  ].join(':')).join('|');
}

function regionKey (region: ResolvedRegion): string {
  return `${region.top},${region.right},${region.bottom},${region.left}`;
}

function contains (region: ResolvedRegion, x: number, y: number): boolean {
  return y >= region.top && y < region.bottom && x >= region.left && x < region.right;
}

type Box = { left: number; top: number; right: number; bottom: number };

function covers (region: ResolvedRegion, box: Box): boolean {
  return region.left <= box.left && region.right >= box.right && region.top <= box.top && region.bottom >= box.bottom;
}

// Whether the parts of box outside region each sit wholly inside one of the others
function remainderCovered (region: ResolvedRegion, others: ResolvedRegion[], box: Box): boolean {
  const middleTop    = Math.max(box.top, region.top);
  const middleBottom = Math.min(box.bottom, region.bottom);

  const rest: Box[] = [
    { left: box.left, right: box.right, top: box.top, bottom: Math.min(box.bottom, region.top) },
    { left: box.left, right: box.right, top: Math.max(box.top, region.bottom), bottom: box.bottom },
    { left: box.left, right: Math.min(box.right, region.left), top: middleTop, bottom: middleBottom },
    { left: Math.max(box.left, region.right), right: box.right, top: middleTop, bottom: middleBottom },
  ].filter((part) => part.right > part.left && part.bottom > part.top);

  return rest.every((part) => others.some((other) => covers(other, part)));
}

function overlaps (region: ResolvedRegion, box: Box): boolean {
  return box.right > region.left && box.left < region.right && box.bottom > region.top && box.top < region.bottom;
}

function meet (a: ResolvedRegion, b: ResolvedRegion): ResolvedRegion | null {
  const region = {
    top:     Math.max(a.top, b.top),
    right:   Math.min(a.right, b.right),
    bottom:  Math.min(a.bottom, b.bottom),
    left:    Math.max(a.left, b.left),
    feather: Math.max(a.feather, b.feather),
  };

  return region.top < region.bottom && region.left < region.right ? region : null;
}

// Overlap passes past this drop, zone passes never; real scenes cross a control with one or two regions
const MAX_ZONE_PASSES = 16;

export class DropletElement extends HTMLElementBase implements DropletComponent {

  // px, so the wobble can overflow without clipping
  static PAD = 48;

  // False keeps the plain connect path, with no resolver
  static usesResolver = false;

  // Replayed through setters on upgrade; subclasses spread it so a new axis reaches every component
  static REPLAYED: readonly string[] = ['feel', 'quality', 'palette', 'material', ...KNOBS, 'config'];

  // Spread into a converted component's observedAttributes
  static AXIS_ATTRIBUTES: readonly string[] = ['feel', 'quality', 'material', 'gloss', 'color', ...KNOBS];

  // Text sits on the fill, so light must keep it readable
  static textOnFill = true;

  body: DropletBody | null = null;
  built = false;
  dpr = 1;
  cssW = 0;
  cssH = 0;

  // Behind the config accessor; frozen once validated
  rawConfig: Partial<DropletConfig> | undefined = undefined;

  resolvedRecord: Resolved | undefined = undefined;
  configWarned: Set<string> | undefined = undefined;
  scopeUnsubscribe: (() => void) | null = null;

  // Unknown names paint as matte and warn once per name per document
  refreshMaterial (): void {
    const name   = this.material;
    let record   = materialRecord(name, this.ownerDocument);

    if (!record) {
      let seen = warnedMaterials.get(this.ownerDocument);

      if (!seen) {
        seen = new Set();
        warnedMaterials.set(this.ownerDocument, seen);
      }

      if (!seen.has(name)) {
        seen.add(name);
        console.warn(`${LOG_PREFIX} unknown material "${name}"; painting as matte`, this);
      }

      record = MATTE;
    }

    const knob   = parseFloat(this.getAttribute('gloss') ?? '');
    const gloss  = Number.isFinite(knob) ? Math.min(1, Math.max(0, knob)) : record.sharpness;
    const before = lightSignature(this.litLights());

    const changed = gloss !== this.glossKnob || JSON.stringify(record) !== JSON.stringify(this.materialRecordCache);

    this.materialRecordCache = record;
    this.glossKnob           = gloss;
    this.litGeneration       = -1;
    this.textColorCache      = undefined;

    // A scope change re-resolves every control; one whose look is unchanged stays parked
    if (changed || lightSignature(this.litLights()) !== before) {
      this.requestFrame();
    }
  }

  extraBodies = new Map<DropletBody, Partial<DropletConfig>>();

  // Read once per resolve
  materialRecordCache: Readonly<MaterialRecord> = MATTE;
  glossKnob = MATTE.sharpness;

  // Viewport rects from the light service's read phase
  lightRects = new WeakMap<HTMLCanvasElement, DOMRect>();
  litGeneration = -1;
  litCache: readonly Light[] | null = null;
  litSignature = '';

  // The label color for the contrast floor; anything that can restyle the control clears it
  textColorCache: RGB | null | undefined = undefined;
  lightUnsubscribe: (() => void) | null = null;

  // Frozen, so editing in place can't skip validation; resolvedConfig holds the resolved record
  get config (): Partial<DropletConfig> | undefined {
    return this.rawConfig;
  }

  set config (value: Partial<DropletConfig> | null | undefined) {
    if (!this.usesResolver) {
      this.rawConfig = value ?? undefined;
      return;
    }

    this.rawConfig = value ? Object.freeze(this.validateConfig(value)) : undefined;
    this.resolve();
  }

  get usesResolver (): boolean {
    return (this.constructor as typeof DropletElement).usesResolver;
  }

  // After the cascade and the unknown-name fallback, never the raw attribute
  get feel (): string {
    return this.resolution().feel;
  }

  set feel (value: string | null | undefined) {
    if (value === null || value === undefined) {
      this.removeAttribute('feel');
    } else {
      this.setAttribute('feel', value);
    }
  }

  get quality (): Quality {
    return readQuality(this);
  }

  set quality (value: Quality | string | null | undefined) {
    writeQuality(this, value);
  }

  // Parsed and reported only
  get palette (): string | null {
    return readNamedAxis(this, 'palette');
  }

  set palette (value: string | null | undefined) {
    writeNamedAxis(this, 'palette', value);
  }

  get material (): string {
    return readNamedAxis(this, 'material') ?? 'matte';
  }

  set material (value: string | null | undefined) {
    writeNamedAxis(this, 'material', value);
  }

  // 0–1, where 0.5 keeps the feel preset's value; null when unset
  get softness (): number | null { return this.knob('softness'); }
  set softness (value: number | string | null) { this.setKnob('softness', value); }
  get bounce (): number | null { return this.knob('bounce'); }
  set bounce (value: number | string | null) { this.setKnob('bounce', value); }
  get viscosity (): number | null { return this.knob('viscosity'); }
  set viscosity (value: number | string | null) { this.setKnob('viscosity', value); }
  get spread (): number | null { return this.knob('spread'); }
  set spread (value: number | string | null) { this.setKnob('spread', value); }
  get depth (): number | null { return this.knob('depth'); }
  set depth (value: number | string | null) { this.setKnob('depth', value); }
  get intensity (): number | null { return this.knob('intensity'); }
  set intensity (value: number | string | null) { this.setKnob('intensity', value); }

  knob (name: Knob): number | null {
    return readKnob(this.getAttribute(name));
  }

  setKnob (name: Knob, value: number | string | null | undefined): void {
    if (value === null || value === undefined) {
      this.removeAttribute(name);
    } else {
      this.setAttribute(name, String(value));
    }
  }

  get resolvedConfig (): Readonly<DropletConfig> {
    return this.resolution().config;
  }

  // Sits below any feel preset
  profile (): Partial<DropletConfig> {
    return {};
  }

  // Warns once per element per key, so a bad value in a frame loop can't spam
  validateConfig (value: Partial<DropletConfig>): Partial<DropletConfig> {
    const copy: Record<string, number> = {};

    for (const [key, entry] of Object.entries(value)) {
      if (isConfigKey(key) && typeof entry === 'number' && Number.isFinite(entry)) {
        copy[key] = entry;
        continue;
      }

      if (!this.configWarned) {
        this.configWarned = new Set();
      }

      if (!this.configWarned.has(key)) {
        this.configWarned.add(key);
        console.warn(`${LOG_PREFIX} config.${key} is not a finite DropletConfig field; ignoring`, this);
      }
    }

    return copy as Partial<DropletConfig>;
  }

  // Recomputes from canonical inputs on every change, so attribute order is unobservable
  resolve (): Resolved {
    this.refreshMaterial();

    const inputs = this.axisInputs();
    const next   = resolveConfig({ profile: this.profile(), ...inputs });

    this.resolvedRecord = next;

    // Reading feel on an unconverted component must stay side-effect free
    if (!this.usesResolver) {
      return next;
    }

    // A supplied name that resolved to something else is invalid, feel="" included
    if (inputs.feel !== null && next.feel !== inputs.feel) {
      warnUnknownFeel(inputs.feel, this.ownerDocument);
    }

    this.applyResolved(next);

    for (const [body, profile] of this.extraBodies) {
      this.applyResolved(this.resolveFor(profile), body);
    }

    return next;
  }

  // True when the change was an axis and is fully handled
  axisAttributeChanged (name: string): boolean {
    if (name === 'material' || name === 'gloss') {
      this.refreshMaterial();
      return true;
    }

    if (name === 'color') {
      syncColorPick(this);
      this.textColorCache = undefined;
      this.requestFrame();
      return true;
    }

    if (name !== 'feel' && name !== 'quality' && !(KNOBS as readonly string[]).includes(name)) {
      return false;
    }

    if (name === 'quality') {
      canonicalizeQualityAttribute(this);
    }

    this.resolve();
    return true;
  }

  // Re-resolved with the main body; profile is its layer, like profile() for the main body
  createBody (shape: Shape, profile: Partial<DropletConfig> = {}): DropletBody {
    if (!this.usesResolver) {
      return new DropletBody({ ...shape, config: { ...profile } });
    }

    const record = this.resolveFor(profile);
    const body   = new DropletBody({ ...shape, config: { ...record.config } });

    this.seedResolved(body, record);
    this.extraBodies.set(body, profile);

    return body;
  }

  resolution (): Resolved {
    return this.resolvedRecord ?? this.resolve();
  }

  // Shared by every body, so a multi-membrane component can't drift between them
  axisInputs (): Omit<ResolveInputs, 'profile'> & { feel: string | null } {
    const feel = this.getAttribute('feel');

    const knobs: Knobs = {};

    for (const knob of KNOBS) {
      const value = readKnob(this.getAttribute(knob));

      if (value !== null) knobs[knob] = value;
    }

    // Trimmed like the scope path, whose custom property the CSS engine trims
    return {
      feel:    feel === null ? readScopedAxis(this, 'feel') : feel.trim(),
      knobs,
      raw:      this.rawConfig,
      quality:  this.quality,
      document: this.ownerDocument,
    };
  }

  resolveFor (profile: Partial<DropletConfig>): Resolved {
    return resolveConfig({ profile, ...this.axisInputs() });
  }

  // So the next applyResolved compares against it instead of rebuilding a matching membrane
  seedResolved (body: DropletBody, resolved: Resolved): void {
    appliedRecords.set(body, resolved);
  }

  // A membrane-shaping change rebuilds the ring from rest
  applyResolved (resolved: Resolved, body: DropletBody | null = this.body): void {
    if (!body) {
      return;
    }

    const next = resolved.config;
    // Not body.config, which the body rewrites as it stores, so that comparison never settles
    const previous = appliedRecords.get(body)?.config;

    appliedRecords.set(body, resolved);

    // An unchanged record must not wake a body parked at rest
    if (previous && sameConfig(previous, next)) {
      return;
    }

    const rebuild  = !previous
      || previous.samples !== next.samples
      || previous.normalBlendPasses !== next.normalBlendPasses;

    body.config = { ...next };

    if (rebuild) {
      body.resize(body.width, body.height, body.radius);
    }

    this.requestFrame();
  }

  // Populated in build(); ctx stays unset when getContext('2d') returns null
  canvas!: HTMLCanvasElement;
  ctx!: CanvasRenderingContext2D;
  overhang!: SVGForeignObjectElement;

  // Canvas is decoration: false makes every paint path no-op instead of throwing
  hasContext = false;
  contextLost = false;

  painterFailed = false;
  asyncPainterWarned = false;

  resizeObserver: ResizeObserver | null = null;
  attributeObserver: MutationObserver | null = null;

  focusVisible = false;
  frameDt = 0;
  colorEasing = false;
  lightMoving = false;
  eased: Record<string, RGBA | undefined> = {};
  probe?: HTMLSpanElement;
  hostFocusTarget?: HTMLElement | null;
  hostFocusHandler?: (event: FocusEvent) => void;
  pressPointerId: number | null = null;
  keyboardActive = false;

  // Base listeners are bound fields, which leaves handleEvent to subclasses

  // A theme or direction change can move the box without a resize the observer would catch
  onThemeChange = (): void => {
    this.textColorCache = undefined;
    this.litGeneration  = -1;
    syncColorPick(this);

    if (this.built) {
      this.applyShape();
      this.onShape();
    }

    this.requestFrame();
  };

  // An in-page reduced-motion preview changes without the OS media query firing
  onMotionChange = (): void => this.requestFrame();

  onWindowResize = (): void => this.applyShape();

  // No preventDefault: the browser only attempts a restore if the event goes unhandled
  onContextLost = (): void => {
    this.contextLost = true;
    this.setAttribute('data-droplet-nocanvas', '');
    engine.drop(this);
  };

  // The restored context comes back untransformed
  onContextRestored = (): void => {
    this.contextLost = false;
    this.removeAttribute('data-droplet-nocanvas');
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    // A resize during the loss lands here; applyShape skips the repaint on an unchanged size
    this.applyShape();
    this.requestFrame();
  };

  constructor () {
    super();

    this.attachShadow({ mode: 'open', delegatesFocus: true });
  }

  // Subclass hooks

  styles (): string {
    return '';
  }

  // Interactive markup above the canvas
  content (): string {
    return '<slot></slot>';
  }

  shape (width: number, height: number): Shape {
    return { width, height, radius: Math.min(width, height) / 2 };
  }

  fill (): string {
    const custom = readToken(getComputedStyle(this), 'fill').trim();

    return custom || PALETTE['background-accent']!;
  }

  // Once, after the shadow DOM and canvas exist; wire events here
  onBuilt (): void {}

  // After every shape (re)build
  onShape (): void {}

  // Return true to keep animating
  frame (dt: number): boolean {
    return this.defaultFrame(dt);
  }

  // fillStyle arrives eased and globalAlpha set
  paintSurface (frame: PainterFrame): void {
    frame.ctx.fill(frame.path);
  }

  // Lifecycle

  connectedCallback (): void {
    if (this.usesResolver) {
      this.connectResolver();
    }

    ensureThemeTokens(this.ownerDocument);
    canonicalizeSize(this);
    syncColorPick(this);

    // A painter disabled by a throw gets one more chance per reconnect
    this.painterFailed = false;

    if (!this.built) {
      this.build();
    }

    this.observeResize();

    // Unobserved host attributes still restyle (variant → --droplet-fill, inline tokens, state classes)
    if (!this.attributeObserver) {
      this.attributeObserver = new MutationObserver((records) => {
        this.textColorCache = undefined;

        // A color= expression can lean on inline tokens or classes, so its on-color follows them
        if (this.hasAttribute('color') && records.some((record) => record.attributeName === 'style' || record.attributeName === 'class')) {
          syncColorPick(this);
        }

        this.requestFrame();
      });
      this.attributeObserver.observe(this, { attributes: true });
    }

    window.addEventListener('droplet-theme-change', this.onThemeChange);
    // The theme runtime relays a page's droplet-motion-change under this name
    window.addEventListener('droplet-motion-change', this.onMotionChange);
    // Zoom changes the DPR without firing the ResizeObserver
    window.addEventListener('resize', this.onWindowResize, { passive: true });

    this.lightUnsubscribe ??= subscribeLights(this);

    this.requestFrame();
  }

  // Runs before build, so the first membrane is seeded from the record it keeps
  connectResolver (): void {
    installScopeBridge(this.ownerDocument);

    replayProperties(this, (this.constructor as typeof DropletElement).REPLAYED);
    canonicalizeQualityAttribute(this);
    this.resolve();

    if (!this.scopeUnsubscribe) {
      this.scopeUnsubscribe = onScopeChange(this.ownerDocument, () => this.resolve());
    }
  }

  adoptedCallback (): void {
    ensureThemeTokens(this.ownerDocument);
  }

  disconnectedCallback (): void {
    engine.drop(this);

    this.scopeUnsubscribe?.();
    this.scopeUnsubscribe = null;

    window.removeEventListener('droplet-theme-change', this.onThemeChange);
    window.removeEventListener('droplet-motion-change', this.onMotionChange);
    window.removeEventListener('resize', this.onWindowResize);

    this.lightUnsubscribe?.();
    this.lightUnsubscribe = null;

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    if (this.attributeObserver) {
      this.attributeObserver.disconnect();
      this.attributeObserver = null;
    }
  }

  // Paint paths no-op without a context, so semantics and interaction survive
  get canPaint (): boolean {
    return this.hasContext && !this.contextLost;
  }

  // Checked live, not cached
  get reducedMotion (): boolean {
    return prefersReducedMotion();
  }

  // SVG overflow is ink overflow in every engine, so the PAD overhang paints but never scrolls an ancestor
  build (): void {
    this.shadowRoot!.innerHTML =
      `<style>${baseStyles}${this.styles()}</style>` +
      `<svg class="droplet-overhang" aria-hidden="true"><foreignObject>` +
      `<canvas class="droplet-canvas" part="droplet jelly" aria-hidden="true"></canvas>` +
      `</foreignObject></svg>` +
      `<div class="droplet-content">${this.content()}</div>`;

    this.canvas   = this.shadowRoot!.querySelector<HTMLCanvasElement>('.droplet-canvas')!;
    this.overhang = this.shadowRoot!.querySelector<SVGForeignObjectElement>('.droplet-overhang > foreignObject')!;
    this.built    = true;

    const ctx = this.canvas.getContext('2d');

    if (ctx) {
      this.ctx        = ctx;
      this.hasContext = true;

      this.canvas.addEventListener('contextlost', this.onContextLost);
      this.canvas.addEventListener('contextrestored', this.onContextRestored);
    } else {
      this.setAttribute('data-droplet-nocanvas', '');
    }

    this.onBuilt();
  }

  observeResize (): void {
    if (this.resizeObserver) {
      return;
    }

    this.resizeObserver = new ResizeObserver(() => this.applyShape());
    this.resizeObserver.observe(this);

    this.applyShape();
  }

  // Host-local px; an inner `data-droplet-box` element narrows it (a checkbox beside its label)
  dropletBox (): { width: number; height: number; offsetX: number; offsetY: number; screenX: number; screenY: number } {
    const hostRect = this.getBoundingClientRect();

    // Divides out ancestor transforms (a dialog's uneven open-scale), so a body built mid-animation keeps its aspect
    const sx   = this.offsetWidth > 0 ? hostRect.width / this.offsetWidth : 1;
    const sy   = this.offsetHeight > 0 ? hostRect.height / this.offsetHeight : 1;
    const invX = sx > 0.001 ? 1 / sx : 1;
    const invY = sy > 0.001 ? 1 / sy : 1;

    const boxEl = this.shadowRoot!.querySelector('[data-droplet-box]');
    const b     = boxEl ? boxEl.getBoundingClientRect() : hostRect;

    return {
      width:   b.width * invX,
      height:  b.height * invY,
      offsetX: (b.left + b.width / 2 - hostRect.left) * invX,
      offsetY: (b.top + b.height / 2 - hostRect.top) * invY,

      // Screen space, for pointer → local mapping
      screenX: b.left + b.width / 2,
      screenY: b.top + b.height / 2,
    };
  }

  applyShape (): void {
    if (!this.built || !this.canPaint) {
      return;
    }

    const box = this.dropletBox();

    if (box.width < 1 || box.height < 1) {
      return;
    }

    const shape = this.shape(box.width, box.height);
    const pad   = (this.constructor as typeof DropletElement).PAD;
    const cssW  = shape.width + pad * 2;
    const cssH  = shape.height + pad * 2;
    const dpr   = Math.min(window.devicePixelRatio || 1, 3);
    const pxW   = Math.round(cssW * dpr);
    const pxH   = Math.round(cssH * dpr);

    // Resizing clears the canvas and rebuilds the membrane, so a sub-pixel reflow (a tab label going bold) must not
    const resize = !this.body || this.canvas.width !== pxW || this.canvas.height !== pxH;

    if (resize) {
      this.dpr  = dpr;
      this.cssW = cssW;
      this.cssH = cssH;

      this.canvas.style.width  = `${this.cssW}px`;
      this.canvas.style.height = `${this.cssH}px`;
    }

    // Repositioning never clears the canvas; SVG user units are the host's CSS px, origin at its padding box
    this.overhang.setAttribute('x',      String(box.offsetX - this.cssW / 2));
    this.overhang.setAttribute('y',      String(box.offsetY - this.cssH / 2));
    this.overhang.setAttribute('width',  String(this.cssW));
    this.overhang.setAttribute('height', String(this.cssH));

    // Positions read before this move are stale for point lights and regions
    this.lightRects = new WeakMap();

    if (!resize) {
      return;
    }

    this.canvas.width  = pxW;
    this.canvas.height = pxH;

    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (!this.body) {
      // Seeded so the membrane is born with its final sample count, not rebuilt after
      const resolved = this.usesResolver ? this.resolution() : null;

      this.body = new DropletBody({
        width:  shape.width,
        height: shape.height,
        radius: shape.radius,
        config: resolved ? { ...resolved.config } : this.config,
      });

      if (resolved) {
        this.seedResolved(this.body, resolved);
      }
    } else {
      this.body.resize(shape.width, shape.height, shape.radius);
    }

    this.onShape();

    // The resize cleared the canvas, so repaint now or a fast size transition flashes blank
    try {
      this.frame(0);
    } catch (error) {
      console.error(`${LOG_PREFIX} paint error`, error);
    }

    this.requestFrame();
  }

  // For a shape change that keeps the box size (a radius swap), where applyShape would early-return
  reshapeMembrane (): void {
    if (!this.built || !this.body) {
      return;
    }

    const box = this.dropletBox();

    if (box.width < 1 || box.height < 1) {
      return;
    }

    const next = this.shape(box.width, box.height);

    this.body.resize(next.width, next.height, next.radius);
    this.requestFrame();
  }

  // Rendering

  clearCanvas (): void {
    if (!this.canPaint) {
      return;
    }

    this.ctx.clearRect(0, 0, this.cssW, this.cssH);
  }

  // Centered in the canvas, offset by cx and cy px
  paintBody (body: DropletBody, options: PaintOptions = {}): void {
    if (!this.canPaint) {
      return;
    }

    const {
      fill   = this.fill(),
      cx     = 0,
      cy     = 0,
      alpha  = 1,
      ctx    = this.ctx,
      cssW   = this.cssW,
      cssH   = this.cssH,
      ring   = null,
      scaleX = 1,
      scaleY = 1,
      border = null,

      // A post-projection deform the physics shouldn't carry (a slider thumb's tapered tail)
      warp   = null,

      // Bodies painted in one frame pass distinct easeKeys so their colors don't share a track
      ease    = true,
      easeKey = 'body',
    } = options;

    // Ring and border stay exact
    const surface = ease ? this.easeColor(easeKey, fill, this.frameDt || 0) : fill;

    const centerX = cssW / 2 + cx;
    const centerY = cssH / 2 + cy;
    const project: (point: SurfacePoint) => SurfacePoint = warp
      ? (point) => warp(body.projectPoint(point))
      : (point) => body.projectPoint(point);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(centerX, centerY);
    ctx.rotate(body.state.rotateZ);

    if (scaleX !== 1 || scaleY !== 1) {
      ctx.scale(scaleX, scaleY);
    }

    if (ring) {
      const ringPoints = body.getSurfacePoints(ring.gap + ring.width / 2).map(project);

      traceSmoothPath(ctx, ringPoints);
      ctx.lineWidth   = ring.width;
      ctx.strokeStyle = ring.color;
      ctx.lineJoin    = 'round';
      ctx.stroke();
    }

    const frame = buildFrame({
      ctx,
      points:  body.getSurfacePoints().map(project),
      resting: body.isResting(),
      dpr:     this.dpr,
      width:   cssW,
      height:  cssH,
    });

    ctx.fillStyle = surface;

    const lights = this.litLights();

    // A lit surface is painted by paintLit, which shades it in isolation first
    const isolate = lights !== null;

    let painted = isolate;

    if (!isolate && !this.painterFailed) {
      // A custom painter must not leak state into the border pass, another body, or the next frame
      ctx.save();

      try {
        this.warnIfAsync(this.paintSurface(frame));
        painted = true;
      } catch (error) {
        this.painterFailed = true;
        console.error(`${LOG_PREFIX} painter error`, error);
      } finally {
        ctx.restore();
      }
    }

    // Outside the save/restore, so a failed painter's half-applied clip can't distort the matte fill
    if (!painted) {
      ctx.fill(frame.path);
    }

    if (lights) {
      const place = { centerX, centerY, cssW, cssH, rotation: body.state.rotateZ, scaleX, scaleY };

      this.paintLit(ctx, frame.path, frame.points, lights, surface, place, (target) => {
        target.fillStyle = surface;

        if (this.painterFailed) {
          target.fill(frame.path);
          return;
        }

        target.save();

        try {
          this.warnIfAsync(this.paintSurface(Object.freeze({ ...frame, ctx: target })));
        } catch (error) {
          this.painterFailed = true;
          console.error(`${LOG_PREFIX} painter error`, error);
          target.restore();
          target.save();
          target.fill(frame.path);
        } finally {
          target.restore();
        }
      }, !isolate, this.painterFailed || this.paintSurface === DropletElement.prototype.paintSurface, body);
    }

    if (border) {
      ctx.lineWidth   = border.width;
      ctx.strokeStyle = border.color;
      ctx.lineJoin    = 'round';
      ctx.stroke(frame.path);
    }

    ctx.restore();
  }

  // Light service hooks: light/index.ts measures every control before any repaints

  lightCanvases (): HTMLCanvasElement[] {
    return this.canvas ? [this.canvas] : [];
  }

  // A hidden canvas measures as an empty rect, which says nothing about where it will paint
  measureLight (): void {
    for (const canvas of this.lightCanvases()) {
      const rect = canvas.isConnected ? canvas.getBoundingClientRect() : null;

      if (rect && rect.width > 0 && rect.height > 0) {
        this.lightRects.set(canvas, rect);
      } else {
        this.lightRects.delete(canvas);
      }
    }
  }

  // A control whose light barely moved keeps sleeping, so a scene can push light every frame
  lightsChanged (): void {
    this.litGeneration = -1;

    const lights = this.litLights();

    // Point lights and regions care where the control sits, so a scroll counts
    const where = lights?.some(anchored)
      ? this.lightCanvases().map((canvas) => {
        const rect = this.lightRects.get(canvas);

        return rect ? `${Math.round(rect.left)},${Math.round(rect.top)}` : '';
      }).join(';')
      : '';

    const signature = `${lightSignature(lights, true)}@${where}`;

    if (signature === this.litSignature) {
      return;
    }

    this.litSignature = signature;
    this.requestFrame();
  }

  // null paints as unlit; a material's default rig stands in on a page with no lights
  litLights (): readonly Light[] | null {
    const generation = lightGeneration();

    if (this.litGeneration !== generation) {
      this.litGeneration = generation;

      const page = this.isConnected ? lightsFor(this) : null;

      this.litCache = page === null && this.materialRecordCache.defaultLight ? defaultRig(isRTL(this)) : page;
    }

    return this.litCache && this.litCache.length > 0 ? this.litCache : null;
  }

  materialText (): RGB | null {
    if (!(this.constructor as typeof DropletElement).textOnFill) {
      return null;
    }

    // The label token where a control sets one (button, select, badge), else the inherited text color
    if (this.textColorCache === undefined) {
      this.textColorCache = this.shadowRoot ? rgbOf(this.resolveColor('var(--jelly-label, var(--droplet-label, currentColor))')) : null;
    }

    return this.textColorCache;
  }

  // With painted false, redraw draws the body; solid says it only fills path with surface. points are in
  // ctx's current space: the canvas (cssW × cssH CSS px) translated to (centerX, centerY), rotated, then scaled.
  paintLit (
    ctx: CanvasRenderingContext2D,
    path: Path2D,
    points: ReadonlyArray<{ x: number; y: number }>,
    lights: readonly Light[],
    surface: string,
    place: { centerX: number; centerY: number; cssW: number; cssH: number; rotation: number; scaleX: number; scaleY: number },
    redraw: (target: CanvasRenderingContext2D) => void,
    painted = true,
    solid = false,
    owner: object | null = null,
  ): void {
    if (!points.length) {
      if (!painted) redraw(ctx);
      return;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const point of points) {
      if (point.x < minX) minX = point.x;
      if (point.y < minY) minY = point.y;
      if (point.x > maxX) maxX = point.x;
      if (point.y > maxY) maxY = point.y;
    }

    const bounds: Bounds = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };

    const { centerX, centerY, cssW, cssH, rotation, scaleX, scaleY } = place;

    const positional = lights.some(anchored);
    const canvas     = 'getBoundingClientRect' in ctx.canvas ? ctx.canvas as HTMLCanvasElement : null;

    let rect = canvas ? this.lightRects.get(canvas) : undefined;

    if (!rect && positional && canvas) {
      const measured = canvas.getBoundingClientRect();

      if (measured.width > 0 && measured.height > 0) {
        rect = measured;
        this.lightRects.set(canvas, rect);
      }
    }

    // Canvas CSS px to viewport px per axis (an ancestor transform can scale the canvas)
    const unitX = rect && cssW > 0 ? rect.width / cssW : 1;
    const unitY = rect && cssH > 0 ? rect.height / cssH : 1;
    const cos   = Math.cos(rotation);
    const sin   = Math.sin(rotation);
    const bx    = (bounds.x + bounds.w / 2) * scaleX;
    const by    = (bounds.y + bounds.h / 2) * scaleY;
    const hw    = (bounds.w / 2) * scaleX;
    const hh    = (bounds.h / 2) * scaleY;
    const vx    = (rect?.left ?? 0) + (centerX + cos * bx - sin * by) * unitX;
    const vy    = (rect?.top ?? 0) + (centerY + sin * bx + cos * by) * unitY;
    const ex    = (Math.abs(cos) * hw + Math.abs(sin) * hh) * unitX;
    const ey    = (Math.abs(sin) * hw + Math.abs(cos) * hh) * unitY;
    const box   = { left: vx - ex, right: vx + ex, top: vy - ey, bottom: vy + ey };

    // Lights everywhere on this surface, then one zone per region that only partly covers it
    const everywhere: Light[] = [];
    const zones = new Map<string, { region: ResolvedRegion; lights: Light[] }>();

    for (const light of lights) {
      const region = light.region;

      if (!region || covers(region, box)) {
        everywhere.push(light);
        continue;
      }

      if (!overlaps(region, box)) continue;

      const key  = regionKey(region);
      const zone = zones.get(key) ?? { region, lights: [] };

      zone.lights.push(light);
      zones.set(key, zone);
    }

    // The center zone paints unmasked when the others cover the rest, so complementary regions meet seamlessly
    let baseKey: string | null = null;

    for (const [key, zone] of zones) {
      const others = [...zones.values()].filter((other) => other !== zone).map((other) => other.region);

      if (contains(zone.region, vx, vy) && remainderCovered(zone.region, others, box)) {
        baseKey = key;
        break;
      }
    }

    const text     = this.materialText();
    const fill     = rgbOf(surface);
    const material = this.materialRecordCache;
    const gloss    = this.glossKnob;

    // The painting space to viewport px, so caustics run continuously across controls
    const toViewport = new DOMMatrix()
      .translateSelf(rect?.left ?? 0, rect?.top ?? 0)
      .scaleSelf(unitX, unitY)
      .translateSelf(centerX, centerY)
      .rotateSelf((rotation * 180) / Math.PI)
      .scaleSelf(scaleX, scaleY);
    const still = this.reducedMotion;
    const time  = still ? 0 : performance.now() / 1000;

    const shadingFor = (zoneLights: Light[]): Shaded => {
      const seen = incidences(zoneLights, vx, vy, rotation);

      return { shading: shade(fill, text, seen.ambient, seen.lights, material), ambient: seen.ambient, caustics: causticsOf(zoneLights) };
    };

    const shadeInto = (target: CanvasRenderingContext2D, zoneLights: Light[], phase: ShadePhase = 'all', known: Shaded | null = null): void => {
      if (!zoneLights.length) return;

      const { shading, ambient, caustics } = known ?? shadingFor(zoneLights);

      if (caustics.length && !still && phase !== 'fixed') this.lightMoving = true;

      target.save();
      paintShading(target, path, bounds, shading, material, gloss, { points, fill, toViewport, time, ambient, caustics }, phase);
      target.restore();
    };

    const device = ctx.getTransform();
    const pxW    = ctx.canvas.width;
    const pxH    = ctx.canvas.height;
    const area   = deviceArea(device, bounds, pxW, pxH);

    if (area.w <= 0 || area.h <= 0) {
      if (!painted) redraw(ctx);
      return;
    }

    // A blend over a partly covered pixel paints its neutral color (screen's black, multiply's white) into
    // the uncovered part, a fringe on every edge; so light shades an opaque copy that takes its alpha back
    const faint = ctx.globalAlpha < 0.999 || alphaOf(surface) < 0.999;
    const plain = solid && !faint;

    // A wobbling or sliding body under steady light reuses its shading, stretched to the new outline;
    // only the live layers repaint. A body a region boundary crosses always repaints in full.
    const cachedShade = (key: object, zoneLights: Light[]): ShadeEntry | null => {
      const scale = Math.hypot(device.a, device.b) || 1;
      const sig   = [
        surface, text?.join(',') ?? '', material.diffuse, material.specular, material.sharpness, material.rim, gloss,
        lightSignature(zoneLights, true), Math.round(rotation * 100), Math.round(scale * 20),
        zoneLights.some((light) => light.kind === 'point') ? `${Math.round(vx / 2)},${Math.round(vy / 2)}` : '',
      ].join('|');

      const entry   = shadeCaches.get(key);
      const stretch = entry ? Math.max(Math.abs(bounds.w / entry.bounds.w - 1), Math.abs(bounds.h / entry.bounds.h - 1)) : Infinity;

      if (entry && entry.key === sig && stretch < SHADE_STRETCH) return entry;

      const boxW   = bounds.w + 2 * AREA_PAD;
      const boxH   = bounds.h + 2 * AREA_PAD;
      const canvas = entry?.canvas ?? ctx.canvas.ownerDocument.createElement('canvas');
      const w      = Math.max(1, Math.ceil(boxW * scale));
      const h      = Math.max(1, Math.ceil(boxH * scale));

      if (canvas.width !== w)  canvas.width  = w;
      if (canvas.height !== h) canvas.height = h;

      const c = canvas.getContext('2d');

      if (!c) return null;

      c.setTransform(1, 0, 0, 1, 0, 0);
      c.globalCompositeOperation = 'source-over';
      c.globalAlpha = 1;
      c.clearRect(0, 0, w, h);
      c.setTransform(w / boxW, 0, 0, h / boxH, -(bounds.x - AREA_PAD) * (w / boxW), -(bounds.y - AREA_PAD) * (h / boxH));
      c.fillStyle = surface;
      c.fillRect(bounds.x - AREA_PAD, bounds.y - AREA_PAD, boxW, boxH);

      const known = shadingFor(zoneLights);

      shadeInto(c, zoneLights, 'fixed', known);

      const fresh: ShadeEntry = { key: sig, canvas, bounds: { ...bounds }, ...known, live: entry?.live ?? null, liveKey: '' };

      shadeCaches.set(key, fresh);

      return fresh;
    };

    const baseLights = baseKey ? [...everywhere, ...zones.get(baseKey)!.lights] : everywhere;
    const zoned      = rect !== undefined && zones.size > (baseKey ? 1 : 0);
    const cached     = plain && !painted && !zoned && owner && baseLights.length ? cachedShade(owner, baseLights) : null;

    // An opaque, pre-shaded block filled through the outline is an ordinary textured fill, so no blend
    // ever touches an edge pixel and the body needs no isolation
    if (cached) {
      const w    = cached.canvas.width;
      const h    = cached.canvas.height;
      const boxW = bounds.w + 2 * AREA_PAD;
      const boxH = bounds.h + 2 * AREA_PAD;

      let block: HTMLCanvasElement = cached.canvas;

      // The live layers redraw only when the outline moves (or caustics play), so a resting body is one fill
      const moving = cached.caustics.length > 0 || material.rim > 0 || material.glint > 0 || material.transmission > 0 || material.meniscus > 0;

      // A frame that reuses the caustics still has to keep the engine awake for the next one
      if (cached.caustics.length && !still) this.lightMoving = true;

      if (moving) {
        const step    = Math.max(1, Math.floor(points.length / 12));
        const outline = points.filter((_, i) => i % step === 0).map((p) => `${Math.round(p.x * 4)},${Math.round(p.y * 4)}`).join(';');
        const anchor  = cached.caustics.length ? `${Math.round(toViewport.e)},${Math.round(toViewport.f)},${still ? '' : Math.round(time * 30)}` : '';
        const liveKey = `${cached.key}#${material.glint},${material.transmission},${material.meniscus}#${outline}#${anchor}`;
        const live    = (cached.live ??= ctx.canvas.ownerDocument.createElement('canvas'));
        const lc      = live.getContext('2d');

        if (lc && cached.liveKey !== liveKey) {
          if (live.width !== w)  live.width  = w;
          if (live.height !== h) live.height = h;

          lc.setTransform(1, 0, 0, 1, 0, 0);
          lc.globalCompositeOperation = 'source-over';
          lc.globalAlpha = 1;
          lc.clearRect(0, 0, w, h);
          lc.drawImage(cached.canvas, 0, 0);
          lc.setTransform(w / boxW, 0, 0, h / boxH, -(bounds.x - AREA_PAD) * (w / boxW), -(bounds.y - AREA_PAD) * (h / boxH));
          shadeInto(lc, baseLights, 'live', cached);
          cached.liveKey = liveKey;
        }

        if (lc) block = live;
      }

      const pattern = ctx.createPattern(block, 'no-repeat');

      if (pattern) {
        pattern.setTransform(new DOMMatrix().translateSelf(bounds.x - AREA_PAD, bounds.y - AREA_PAD).scaleSelf(boxW / w, boxH / h));
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = pattern;
        ctx.fill(path);
        ctx.restore();
        return;
      }
    }

    const work  = scratchFor(0, area, device);

    if (!work) {
      if (!painted) redraw(ctx);
      return;
    }

    const base = (target: CanvasRenderingContext2D): void => {
      // A plain fill needs no edge at all: the mask cuts the shape out of an opaque block
      if (plain) {
        target.fillStyle = surface;
        target.fillRect(bounds.x - AREA_PAD, bounds.y - AREA_PAD, bounds.w + 2 * AREA_PAD, bounds.h + 2 * AREA_PAD);
        return;
      }

      if (faint) {
        redraw(target);
        thicken(target, area);
        return;
      }

      // Opaque but not plain (a two-tone track, a custom painter): dilate, then draw the original over it
      const m = target.getTransform();

      for (const [dx, dy] of DILATE) {
        target.setTransform(m.a, m.b, m.c, m.d, m.e + dx, m.f + dy);
        redraw(target);
      }

      target.setTransform(m);
    };

    base(work);
    shadeInto(work, baseLights);

    if (rect && zoned) {
      const dprX  = cssW > 0 ? pxW / cssW : 1;
      const dprY  = cssH > 0 ? pxH / cssH : 1;
      const parts = [...zones.entries()];

      // Every non-base zone gets a pass, then overlaps one size at a time, so larger overlaps paint over their zones
      type Pass = { region: ResolvedRegion; lights: Light[]; last: number };

      const passes: Pass[] = [];

      let level: Pass[] = parts.map(([, zone], i) => ({ region: zone.region, lights: zone.lights, last: i }));

      level.forEach((pass, i) => {
        if (parts[i]![0] !== baseKey) passes.push(pass);
      });

      while (level.length && passes.length < MAX_ZONE_PASSES) {
        const next: Pass[] = [];

        for (const pass of level) {
          for (let i = pass.last + 1; i < parts.length && passes.length < MAX_ZONE_PASSES; i++) {
            const shared = meet(pass.region, parts[i]![1].region);

            if (!shared || !overlaps(shared, box)) continue;

            const grown = { region: shared, lights: [...pass.lights, ...parts[i]![1].lights], last: i };

            next.push(grown);
            passes.push(grown);
          }
        }

        level = next;
      }

      for (const pass of passes) {
        const side = scratchFor(1, area, device);

        if (!side) break;

        side.globalAlpha = work.globalAlpha;

        base(side);
        shadeInto(side, [...everywhere, ...pass.lights]);

        // The mask works in this canvas's CSS px, not viewport px
        const r = pass.region;

        side.setTransform(dprX, 0, 0, dprY, 0, 0);
        side.globalAlpha = 1;
        maskRegion(side, {
          top:     (r.top - rect.top) / unitY,
          bottom:  (r.bottom - rect.top) / unitY,
          left:    (r.left - rect.left) / unitX,
          right:   (r.right - rect.left) / unitX,
          feather: (2 * r.feather) / (unitX + unitY),
        }, cssW, cssH);

        work.save();
        work.setTransform(1, 0, 0, 1, 0, 0);
        work.globalAlpha = 1;
        work.globalCompositeOperation = 'source-over';
        work.drawImage(side.canvas, area.x, area.y, area.w, area.h, area.x, area.y, area.w, area.h);
        work.restore();
      }
    }

    // An unpainted body takes back its alpha map (coverage, fill alpha, and the body's alpha)
    if (!painted) {
      work.save();
      work.setTransform(1, 0, 0, 1, 0, 0);
      work.beginPath();
      work.rect(area.x, area.y, area.w, area.h);
      work.clip();
      work.globalCompositeOperation = 'destination-in';

      if (plain) {
        work.setTransform(device);
        work.globalAlpha = ctx.globalAlpha;
        work.fillStyle   = surface;
        work.fill(path);
      } else {
        const mask = scratchFor(1, area, device);

        if (mask) {
          mask.globalAlpha = ctx.globalAlpha;
          redraw(mask);
          work.drawImage(mask.canvas, area.x, area.y, area.w, area.h, area.x, area.y, area.w, area.h);
        }
      }

      work.restore();
    }

    // A painted surface (a track) is the bottom layer of its canvas, so atop is exact
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = painted ? 'source-atop' : 'source-over';
    ctx.drawImage(work.canvas, area.x, area.y, area.w, area.h, area.x, area.y, area.w, area.h);
    ctx.restore();
  }

  // For a capsule track painted outside paintBody (slider, range)
  shadeTrack (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, surface: string, redraw: (target: CanvasRenderingContext2D) => void): void {
    const lights = this.litLights();

    if (!lights) {
      return;
    }

    const path = new Path2D();

    path.roundRect(x, y, width, height, height / 2);

    const place = { centerX: 0, centerY: 0, cssW: this.cssW, cssH: this.cssH, rotation: 0, scaleX: 1, scaleY: 1 };

    this.paintLit(ctx, path, [{ x, y }, { x: x + width, y: y + height }], lights, surface, place, redraw);
  }

  // Painting is synchronous: whatever a returned promise draws lands on a cleared canvas
  warnIfAsync (result: unknown): void {
    if (this.asyncPainterWarned || !result || typeof (result as PromiseLike<unknown>).then !== 'function') {
      return;
    }

    this.asyncPainterWarned = true;
    console.warn(`${LOG_PREFIX} paintSurface() is synchronous; the returned promise is ignored`, this);
  }

  defaultFrame (dt: number): boolean {
    const body = this.body;

    if (!body || !this.canPaint) {
      return false;
    }

    body.update(dt);

    this.clearCanvas();
    this.paintBody(body, { ring: this.focusRing(), border: this.surfaceBorder() });

    return !body.isResting();
  }

  surfaceBorder (): Border | null {
    return null;
  }

  // Focus ring

  // Width and gap resolve from --droplet-ring-width and --droplet-ring-gap
  focusRing (): Ring | null {
    if (!this.focusVisible) {
      return null;
    }

    const styles = getComputedStyle(this);
    const width  = parseFloat(readToken(styles, 'ring-width')) || FOCUS_RING.width;
    const gap    = parseFloat(readToken(styles, 'ring-gap'));

    return { color: this.ringColor(), width, gap: Number.isFinite(gap) ? gap : FOCUS_RING.gap };
  }

  // --droplet-ring (usually the fill hue), softened, so the ring reads as part of the control
  ringColor (): string {
    const [r, g, b, a] = this.rgbaTuple(
      `var(--jelly-ring, var(--droplet-ring, var(--jelly-color-border-focus, var(--droplet-color-border-focus, ${PALETTE['border-focus']}))))`,
    );

    // Canvas strokeStyle support for color(srgb … / .5) is inconsistent, so emit legacy rgba()
    return this.colorString([r, g, b, a * FOCUS_RING.alpha], { forceAlpha: true });
  }

  // One track per key; frame-rate independent, with a 0.1 s time constant
  easeColor (key: string, expr: string, dt: number): string {
    const target = this.rgbaTuple(expr);

    const current = this.eased[key];

    if (!current || this.reducedMotion) {
      this.eased[key] = target;
      return this.colorString(target);
    }

    const settled =
      Math.abs(target[0] - current[0]) <= 0.4 &&
      Math.abs(target[1] - current[1]) <= 0.4 &&
      Math.abs(target[2] - current[2]) <= 0.4 &&
      Math.abs(target[3] - current[3]) <= 0.002;

    if (settled) {
      this.eased[key] = target;
      return this.colorString(target);
    }

    // The first frame after a park can arrive with dt = 0, which must hold the color, not snap it
    this.colorEasing = true;

    if (dt > 0) {
      const k = 1 - Math.exp(-dt * 10);

      for (const i of [0, 1, 2, 3] as const) {
        current[i] += (target[i] - current[i]) * k;
      }
    }

    return this.colorString(current);
  }

  // Keeping alpha stops short hex colors such as #fff0 from turning opaque through canvas animation
  rgbaTuple (expr: string): RGBA {
    const resolved = this.resolveColor(String(expr));
    const match    = resolved.match(/[\d.]+/g);

    if (!match) {
      return [0, 0, 0, 1];
    }

    const triple = match.slice(0, 3).map(Number);
    const alpha  = Math.max(0, Math.min(1, Number(match[3] ?? 1)));
    const rgb    = resolved.startsWith('color(')
      ? triple.map((channel) => Math.round(channel * 255))
      : triple;

    return [rgb[0] ?? 0, rgb[1] ?? 0, rgb[2] ?? 0, alpha];
  }

  rgbTriple (expr: string): number[] {
    return this.rgbaTuple(expr).slice(0, 3);
  }

  // Canvas-safe legacy syntax
  colorString ([r = 0, g = 0, b = 0, a = 1]: number[], { forceAlpha = false }: { forceAlpha?: boolean } = {}): string {
    const red   = Math.round(r);
    const green = Math.round(g);
    const blue  = Math.round(b);
    const alpha = Math.max(0, Math.min(1, a));

    if (!forceAlpha && alpha >= 0.9995) {
      return `rgb(${red}, ${green}, ${blue})`;
    }

    return `rgba(${red}, ${green}, ${blue}, ${Number(alpha.toFixed(4))})`;
  }

  mixColor (from: string, to: string, amount: number): string {
    const start = this.rgbaTuple(from);
    const end   = this.rgbaTuple(to);
    const t     = Math.max(0, Math.min(1, amount));
    const mixed = start.map((channel, index) => channel + ((end[index] ?? channel) - channel) * t);

    return this.colorString(mixed);
  }

  // Computed style keeps oklch() as oklch(), which rgbaTuple would misread, so color-mix forces sRGB
  resolveColor (expr: string): string {
    if (!this.probe) {
      this.probe = document.createElement('span');
      this.probe.setAttribute('aria-hidden', 'true');
      this.probe.style.cssText =
        'position:absolute;width:0;height:0;visibility:hidden;pointer-events:none';
      this.shadowRoot!.appendChild(this.probe);
    }

    this.probe.style.color = `color-mix(in srgb, ${expr} 100%, transparent)`;

    return getComputedStyle(this.probe).color;
  }

  // :focus-visible on an inner control drives the ring
  trackFocus (el: HTMLElement): void {
    el.addEventListener('focus', () => {
      this.focusVisible = el.matches(':focus-visible') || this.matches(':focus-visible');
      this.requestFrame();
    });

    el.addEventListener('blur', () => {
      this.focusVisible = false;
      this.requestFrame();
    });
  }

  // Route host.focus() into an inner shadow control
  useHostFocusTarget (el: HTMLElement | null): void {
    if (!el) {
      return;
    }

    this.hostFocusTarget = el;
    this.syncHostFocusTarget();

    if (!this.hostFocusHandler) {
      this.hostFocusHandler = (event: FocusEvent): void => {
        // An inner control already holding focus keeps it, or a chip's remove button would bounce to the primary
        if (
          event.target !== this ||
          !this.hostFocusTarget ||
          this.shadowRoot?.activeElement
        ) {
          return;
        }
        this.hostFocusTarget.focus({ preventScroll: true });
      };

      this.addEventListener('focus', this.hostFocusHandler);
    }
  }

  syncHostFocusTarget (): void {
    if (!this.hostFocusTarget) {
      return;
    }

    this.hostFocusTarget.tabIndex = this.hasAttribute('disabled') ? -1 : 0;
    this.removeAttribute('tabindex');
  }

  // Interaction helpers

  requestFrame (): void {
    if (!this.canPaint) {
      return;
    }

    engine.wake(this);
  }

  toLocal (clientX: number, clientY: number, body: DropletBody | null = this.body): { x: number; y: number } {
    const box = this.dropletBox();

    // Divides out ancestor scale like dropletBox, so a press in a dialog mid-pop lands under the finger
    const hostRect = this.getBoundingClientRect();
    const sx       = this.offsetWidth > 0 ? hostRect.width / this.offsetWidth : 1;
    const sy       = this.offsetHeight > 0 ? hostRect.height / this.offsetHeight : 1;

    const dx = (clientX - box.screenX) / (sx > 0.001 ? sx : 1);
    const dy = (clientY - box.screenY) / (sy > 0.001 ? sy : 1);

    const a   = -(body ? body.state.rotateZ : 0);
    const cos = Math.cos(a);
    const sin = Math.sin(a);

    return { x: dx * cos - dy * sin, y: dx * sin + dy * cos };
  }

  pressAt (clientX: number, clientY: number, strength = 1.12): void {
    if (this.reducedMotion || !this.body) {
      return;
    }

    const local = this.toLocal(clientX, clientY);

    this.body.pressAtLocal(local.x, local.y, strength);
    this.requestFrame();
  }

  moveAt (clientX: number, clientY: number): void {
    if (this.reducedMotion || !this.body) {
      return;
    }

    const local = this.toLocal(clientX, clientY);

    this.body.moveToLocal(local.x, local.y);
    this.requestFrame();
  }

  releaseBody (): void {
    if (!this.body) {
      return;
    }

    this.body.release();
    this.requestFrame();
  }

  centerPulse (strength = 1): void {
    if (this.reducedMotion || !this.body) {
      return;
    }

    this.body.centerPulse(strength);
    this.requestFrame();
  }

  centerPop (strength = 1): void {
    if (this.reducedMotion || !this.body) {
      return;
    }

    this.body.centerPop(strength);
    this.requestFrame();
  }

  // One pointer at a time; capture loss or blur mid-press still releases
  wirePress (element: HTMLElement, { keyboard = true, disabled = () => this.hasAttribute('disabled') }: WirePressOptions = {}): void {
    this.pressPointerId = null;

    element.addEventListener('pointerdown', (event) => {
      if (disabled() || this.pressPointerId !== null) {
        return;
      }

      this.pressPointerId = event.pointerId;

      try {
        element.setPointerCapture(event.pointerId);
      } catch {
        // Pointer already gone
      }

      this.pressAt(event.clientX, event.clientY);
      triggerHaptic();
    });

    element.addEventListener('pointermove', (event) => {
      if (event.pointerId === this.pressPointerId) {
        this.moveAt(event.clientX, event.clientY);
      }
    });

    const endPress = (event: PointerEvent): void => {
      if (event.pointerId !== this.pressPointerId) {
        return;
      }

      this.pressPointerId = null;
      this.releaseBody();
    };

    element.addEventListener('pointerup', endPress);
    element.addEventListener('pointercancel', endPress);
    element.addEventListener('lostpointercapture', endPress);

    if (!keyboard) {
      return;
    }

    element.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') {
        return;
      }

      if (this.keyboardActive || event.repeat || disabled()) {
        return;
      }

      this.keyboardActive = true;
      // Matches pressAt()'s default, so a keypress deforms like a center pointer press
      this.centerPulse(1.12);
      triggerHaptic();
    });

    element.addEventListener('keyup', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') {
        return;
      }

      this.keyboardActive = false;
      this.releaseBody();
    });

    element.addEventListener('blur', () => {
      this.keyboardActive  = false;
      this.pressPointerId  = null;
      this.releaseBody();
    });
  }

}
