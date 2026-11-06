import { readScopedAxis } from '../cascade/index.js';

export type LightKind = 'point' | 'directional' | 'ambient';

// A CSS color, or an [r, g, b] triple in 0–1 from a shader uniform
export type LightColor = string | readonly [number, number, number];

// Viewport CSS px; a missing edge is unbounded, so { top: y } means everything below y
export interface LightRegion {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
  feather?: number;
}

export interface DropletLight {
  kind: LightKind;
  x?: number;
  y?: number;
  height?: number;
  angle?: number;
  elevation?: number;
  color?: LightColor;
  intensity?: number;
  softness?: number;
  region?: LightRegion | null;
  // 0–1: how strongly this light's caustic pattern shows, as when it arrives through moving water
  caustics?: number;
  id?: string;
}

export interface LightOptions {
  scope?: Element | Document;
  flashSafety?: boolean;
}

export interface ResolvedRegion {
  top: number;
  right: number;
  bottom: number;
  left: number;
  feather: number;
}

export interface Light {
  readonly kind: LightKind;
  readonly x: number;
  readonly y: number;
  readonly height: number;
  readonly angle: number;
  readonly elevation: number;
  readonly rgb: readonly [number, number, number];
  readonly intensity: number;
  readonly softness: number;
  readonly region: ResolvedRegion | null;
  readonly caustics: number;
  readonly id: string;
}

export const MAX_LIGHTS_PER_CONTROL = 4;
export const MAX_LIGHTS_PER_SCOPE = 16;

const DEFAULT_POINT_HEIGHT = 400;
const DEFAULT_ELEVATION = 45;
const DEFAULT_FEATHER = 3;

// Far past anything a control shows, yet small enough that sums stay finite
const MAX_INTENSITY = 1000;

// A change above this share of total light is a transition
const TRANSITION = 0.1;
const WINDOW_MS = 1000;
const MAX_TRANSITIONS = 3;
const MAX_TRANSITIONS_REDUCED = 2;
const MAX_RISE = 1.6;
const MAX_RISE_REDUCED = 1.25;

export const LIGHT_CHANGE_EVENT = 'droplet-light-change';

interface ScopeState {
  applied: readonly Light[];
  pending: readonly Light[] | null;
  history: number[];
  timer: ReturnType<typeof setTimeout> | undefined;
  flashSafety: boolean;
  clearing: boolean;
}

const scopes = new WeakMap<Element | Document, ScopeState>();

// Flash history outlives a cleared scope, so clearing and setting again stays in the envelope
const afterimages = new WeakMap<Element | Document, { history: number[]; at: number }>();

// Scopes with anchored lights (point, region, or caustics), the only ones where position and scroll matter
const positionalScopes = new Set<Element | Document>();
const colorCache = new Map<string, readonly [number, number, number]>();

let colorCtx: CanvasRenderingContext2D | null | undefined;

// Canvas normalizes any CSS color the engine knows, oklch() and named colors included
function parseColor (color: LightColor | undefined): readonly [number, number, number] {
  if (color === undefined) {
    return [1, 1, 1];
  }

  if (typeof color !== 'string') {
    return [clamp01(color[0]), clamp01(color[1]), clamp01(color[2])];
  }

  const cached = colorCache.get(color);

  if (cached) {
    return cached;
  }

  if (colorCtx === undefined) {
    colorCtx = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  }

  if (!colorCtx) {
    return [1, 1, 1];
  }

  colorCtx.canvas.width = colorCtx.canvas.height = 1;
  colorCtx.clearRect(0, 0, 1, 1);
  colorCtx.fillStyle = '#fff';
  colorCtx.fillStyle = color;
  colorCtx.fillRect(0, 0, 1, 1);

  const [r = 255, g = 255, b = 255] = colorCtx.getImageData(0, 0, 1, 1).data;
  const rgb = [r / 255, g / 255, b / 255] as const;

  colorCache.set(color, rgb);

  return rgb;
}

function clamp01 (value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

function finite (value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function normalizeRegion (region: LightRegion | null | undefined): ResolvedRegion | null {
  if (!region) {
    return null;
  }

  return {
    top:     finite(region.top, -Infinity),
    right:   finite(region.right, Infinity),
    bottom:  finite(region.bottom, Infinity),
    left:    finite(region.left, -Infinity),
    feather: Math.max(0, finite(region.feather, DEFAULT_FEATHER)),
  };
}

export function normalizeLight (light: DropletLight, index = 0): Light {
  const kind: LightKind = light.kind === 'point' || light.kind === 'ambient' ? light.kind : 'directional';

  // A shader's HDR color above 1 folds its excess into intensity
  const raw   = typeof light.color === 'string' || light.color === undefined ? null : light.color;
  const peak  = raw ? Math.max(finite(raw[0], 0), finite(raw[1], 0), finite(raw[2], 0)) : 0;
  const color = raw && peak > 1 ? [raw[0] / peak, raw[1] / peak, raw[2] / peak] as const : light.color;
  const boost = raw && peak > 1 ? peak : 1;

  // A point light with an elevation keeps that angle at every control; NaN means "from height"
  const elevation = kind === 'point' && light.elevation === undefined
    ? NaN
    : Math.min(90, Math.max(0, finite(light.elevation, DEFAULT_ELEVATION)));

  return Object.freeze({
    kind,
    x:         finite(light.x, 0),
    y:         finite(light.y, 0),
    height:    Math.max(1, finite(light.height, DEFAULT_POINT_HEIGHT)),
    angle:     finite(light.angle, 0),
    elevation,
    rgb:       parseColor(color),
    intensity: Math.min(MAX_INTENSITY, Math.max(0, finite(light.intensity, 1)) * boost),
    softness:  clamp01(finite(light.softness, 0.5)),
    region:    normalizeRegion(light.region),
    caustics:  clamp01(finite(light.caustics, 0)),
    id:        light.id ?? `light-${index}`,
  });
}

// Rec. 709 luma, a cheap stand-in for how bright a light set reads
export function totalLight (lights: readonly Light[]): number {
  let sum = 0;

  for (const light of lights) {
    sum += light.intensity * (0.2126 * light.rgb[0] + 0.7152 * light.rgb[1] + 0.0722 * light.rgb[2]);
  }

  return sum;
}

// The scope's document decides, so an iframe's motion setting governs its lights
function reducedMotion (doc: Document | null = typeof document === 'undefined' ? null : document): boolean {
  if (!doc) {
    return false;
  }

  const root = doc.documentElement;
  const forced = root.getAttribute('data-droplet-motion') ?? root.getAttribute('data-jelly-motion');

  if (forced === 'reduce') return true;
  if (forced === 'no-preference') return false;

  const view = doc.defaultView;

  return typeof view?.matchMedia === 'function' && view.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

const glow = (light: Light): number => light.intensity * (0.2126 * light.rgb[0] + 0.7152 * light.rgb[1] + 0.0722 * light.rgb[2]);

function atGlow (light: Light, target: number): Light {
  const own = glow(light);

  return Object.freeze({ ...light, intensity: own > 0 ? light.intensity * (target / own) : 0 });
}

// A flash is a rise and its fall, so this counts rises by id: three a second, two reduced (WCAG 2.2 SC 2.3.1).
// Each rise is capped in size; falls land at once, and the rest of a capped rise lands in later steps.
function admit (state: ScopeState, next: readonly Light[], doc: Document): { lights: readonly Light[]; owed: boolean; wait: number } {
  const before = new Map(state.applied.map((light) => [light.id, glow(light)]));
  const total  = Math.max(totalLight(state.applied), totalLight(next), 0.05);

  let climb = 0;

  for (const light of next) climb += Math.max(0, glow(light) - (before.get(light.id) ?? 0));

  if (!state.flashSafety || climb / total <= TRANSITION) {
    return { lights: next, owed: false, wait: 0 };
  }

  const now     = Date.now();
  const reduced = reducedMotion(doc);
  const limit   = reduced ? MAX_TRANSITIONS_REDUCED : MAX_TRANSITIONS;

  state.history = state.history.filter((time) => now - time < WINDOW_MS);

  // Out of rises this second: rising lights hold, falls still land
  if (state.history.length >= limit) {
    const lights = next.map((light) => {
      const was = before.get(light.id) ?? 0;

      return glow(light) > was ? atGlow(light, was) : light;
    });

    return { lights, owed: true, wait: WINDOW_MS - (now - (state.history[0] ?? now)) };
  }

  state.history.push(now);

  // A light may grow by the rise factor per step; a new one by that share of the old total
  const rise  = reduced ? MAX_RISE_REDUCED : MAX_RISE;
  const floor = (rise - 1) * Math.max(totalLight(state.applied), 0.05);

  let owed = false;

  const lights = next.map((light) => {
    const was  = before.get(light.id) ?? 0;
    const most = was > 0 ? was * rise : floor;

    if (glow(light) <= most) {
      return light;
    }

    owed = true;

    return atGlow(light, most);
  });

  return { lights, owed, wait: WINDOW_MS / limit };
}

function commit (state: ScopeState, next: readonly Light[], target: Element | Document): void {
  const { lights, owed, wait } = admit(state, next, isDocument(target) ? target : target.ownerDocument);

  state.applied = Object.freeze([...lights]);

  if (owed) {
    state.pending = next;

    state.timer ??= setTimeout(() => {
      state.timer = undefined;

      const pending = state.pending;

      state.pending = null;

      if (pending) {
        commit(state, pending, target);
      }
    }, Math.max(0, wait));
  } else {
    // Nothing owed: a queued continuation would only replay stale light
    clearTimeout(state.timer);
    state.timer   = undefined;
    state.pending = null;
  }

  announce(target);
}

// Node-type checks instead of instanceof, so a scope from a same-origin iframe works
function isDocument (node: Element | Document | Node): node is Document {
  return node.nodeType === 9;
}

// Point lights, regions, and viewport-anchored caustics all depend on where a control sits
export function anchored (light: Light): boolean {
  return light.kind === 'point' || light.region !== null || light.caustics > 0;
}

function announce (target: Element | Document): void {
  const doc = isDocument(target) ? target : target.ownerDocument;
  const lit = scopes.get(target)?.applied.some(anchored) ?? false;

  if (lit) positionalScopes.add(target);
  else positionalScopes.delete(target);

  generation += 1;
  queueRefresh(doc);

  const Event = doc.defaultView?.CustomEvent ?? CustomEvent;

  doc.dispatchEvent(new Event(LIGHT_CHANGE_EVENT));
}

// Lets a control check its cached lights with one compare
let generation = 0;

export function lightGeneration (): number {
  return generation;
}

export interface LightSubscriber {
  readonly ownerDocument: Document;
  measureLight (): void;
  lightsChanged (): void;
}

// Across documents, for news that isn't about one document's light
const everySubscriber = new Set<LightSubscriber>();

export function forEachLightSubscriber (callback: (subscriber: LightSubscriber) => void): void {
  for (const subscriber of everySubscriber) callback(subscriber);
}

interface Service {
  subscribers: Set<LightSubscriber>;
  scrolling: boolean;
  queued: boolean;
}

const services = new WeakMap<Document, Service>();

// Every rect read before any repaint, so layout reads never interleave with paints
function queueRefresh (doc: Document): void {
  const service = services.get(doc);

  if (!service || service.queued) {
    return;
  }

  service.queued = true;

  const run = (): void => {
    service.queued = false;
    refreshService(doc);
  };

  if (doc.defaultView) doc.defaultView.requestAnimationFrame(run);
  else run();
}

function refreshService (doc: Document): void {
  const service = services.get(doc);

  if (!service) {
    return;
  }

  if (positional(doc)) {
    for (const subscriber of service.subscribers) subscriber.measureLight();
  }

  for (const subscriber of service.subscribers) subscriber.lightsChanged();

  syncScrollWatch(doc, service);
}

// Also prunes scope elements dropped from the page without clearing their lights
function positional (doc: Document): boolean {
  let found = false;

  for (const target of positionalScopes) {
    if (isDocument(target)) {
      found ||= target === doc;
    } else if (!target.isConnected) {
      positionalScopes.delete(target);
    } else {
      found ||= target.ownerDocument === doc;
    }
  }

  return found;
}

function syncScrollWatch (doc: Document, service: Service): void {
  const view = doc.defaultView;

  if (!view) {
    return;
  }

  const wanted = service.subscribers.size > 0 && positional(doc);

  if (wanted === service.scrolling) {
    return;
  }

  service.scrolling = wanted;

  if (wanted) {
    view.addEventListener('scroll', onScroll, true);
  } else {
    view.removeEventListener('scroll', onScroll, true);
  }
}

function onScroll (event: Event): void {
  const target = event.target as Node | null;
  const doc    = target && isDocument(target) ? target : target?.ownerDocument;

  if (doc) {
    queueRefresh(doc);
  }
}

export function subscribeLights (subscriber: LightSubscriber): () => void {
  const doc = subscriber.ownerDocument;

  let service = services.get(doc);

  if (!service) {
    service = { subscribers: new Set(), scrolling: false, queued: false };
    services.set(doc, service);
  }

  service.subscribers.add(subscriber);
  everySubscriber.add(subscriber);

  // positional() prunes scopes that left the page, so re-add positional ancestors a later clear could uncover
  if ('nodeType' in subscriber) {
    for (const scope of scopesAbove(subscriber as unknown as Element)) {
      if (scopes.get(scope)?.applied.some(anchored)) {
        positionalScopes.add(scope);
      }
    }
  }

  syncScrollWatch(doc, service);

  const owned = service;

  return () => {
    owned.subscribers.delete(subscriber);
    everySubscriber.delete(subscriber);

    if (owned.subscribers.size === 0) {
      syncScrollWatch(doc, owned);
    }
  };
}

// A scope's lights replace the document's for everything inside it; null or [] clears them
export function setLights (lights: readonly DropletLight[] | null, options: LightOptions = {}): void {
  const target = options.scope ?? (typeof document === 'undefined' ? null : document);

  if (!target) {
    return;
  }

  let state = scopes.get(target);

  if (!lights || lights.length === 0) {
    if (state) {
      release(target, state, state.flashSafety && options.flashSafety !== false);
    } else if (options.flashSafety === false) {
      afterimages.delete(target);
    }

    return;
  }

  // Ids match lights across updates for flash safety, so a repeated id gets a distinct one
  const ids        = new Set<string>();
  const normalized = lights.slice(0, MAX_LIGHTS_PER_SCOPE).map((light, index) => {
    const base = normalizeLight(light, index);

    let id = base.id;

    for (let n = 2; ids.has(id); n++) id = `${base.id}~${n}`;

    ids.add(id);

    return id === base.id ? base : Object.freeze({ ...base, id });
  });

  const safe = options.flashSafety !== false;

  if (!state) {
    const now  = Date.now();
    const past = afterimages.get(target);

    afterimages.delete(target);

    state = { applied: [], pending: null, history: [], timer: undefined, flashSafety: safe, clearing: false };
    scopes.set(target, state);

    // Soon after a clear the lights rise from what the clear uncovered; a first set lands whole
    if (safe && past && now - past.at < WINDOW_MS) {
      state.history = past.history.filter((time) => now - time < WINDOW_MS);
      state.applied = Object.freeze([...underneath(target)]);
      commit(state, normalized, target);
      return;
    }

    if (safe && rises(underneath(target), normalized)) {
      state.history.push(now);
    }

    state.applied = Object.freeze(normalized);
    announce(target);
    return;
  }

  // A set supersedes a clear still waiting for its turn
  if (state.clearing) {
    clearTimeout(state.timer);
    state.timer    = undefined;
    state.clearing = false;
  }

  state.flashSafety = safe;

  commit(state, normalized, target);
}

// What a scope's controls fall back to without it: the lights above it, else the default rig
function underneath (target: Element | Document): readonly Light[] {
  if (!isDocument(target)) {
    for (let node = parentOrHost(target); node; node = parentOrHost(node)) {
      if (node.nodeType === 1) {
        return lightsFor(node as Element) ?? defaultRig(false);
      }
    }

    // The root element (or a detached one) falls back to its document's lights
    return scopes.get(target.ownerDocument)?.applied ?? defaultRig(false);
  }

  return defaultRig(false);
}

function rises (from: readonly Light[], to: readonly Light[]): boolean {
  const before = totalLight(from);
  const after  = totalLight(to);

  return after - before > TRANSITION * Math.max(before, after, 0.05);
}

// A clear that uncovers brighter light is a rise too, so it waits when the second is spent
function release (target: Element | Document, state: ScopeState, safe: boolean): void {
  clearTimeout(state.timer);
  state.timer   = undefined;
  state.pending = null;

  if (safe && rises(state.applied, underneath(target))) {
    const now   = Date.now();
    const limit = reducedMotion(isDocument(target) ? target : target.ownerDocument) ? MAX_TRANSITIONS_REDUCED : MAX_TRANSITIONS;

    state.history = state.history.filter((time) => now - time < WINDOW_MS);

    if (state.history.length >= limit) {
      state.clearing = true;
      state.timer    = setTimeout(() => {
        state.timer = undefined;

        if (state.clearing) release(target, state, true);
      }, WINDOW_MS - (now - (state.history[0] ?? now)));

      return;
    }

    state.history.push(now);
  }

  state.clearing = false;
  scopes.delete(target);

  // Opting out of flash safety on a clear also forgets the scope's history
  if (safe) afterimages.set(target, { history: state.history, at: Date.now() });
  else afterimages.delete(target);

  announce(target);
}

export function getLights (scope?: Element | Document): readonly Light[] {
  const target = scope ?? (typeof document === 'undefined' ? null : document);

  return target ? scopes.get(target)?.applied ?? [] : [];
}

function parentOrHost (node: Node): Node | null {
  const parent = node.parentNode;

  // A shadow root is a document fragment with a host
  return parent && parent.nodeType === 11 && 'host' in parent ? (parent as ShadowRoot).host : parent;
}

const STATIC_ANGLES: Readonly<Record<string, number>> = {
  'top': 0, 'top-right': 45, 'right': 90, 'bottom-right': 135, 'bottom': 180,
  'bottom-left': 225, 'left': 270, 'top-left': 315,
};

const LOGICAL_ANGLES: Readonly<Record<string, number>> = {
  'top-start': 330, 'top-end': 30, 'start': 270, 'end': 90, 'bottom-start': 210, 'bottom-end': 150,
};

// Soft key plus ambient, for a static direction or a lit material's default
export function keyRig (angle: number, elevation = 50): Light[] {
  return [
    normalizeLight({ kind: 'ambient', intensity: 0.72, id: 'rig-ambient' }),
    normalizeLight({ kind: 'directional', angle, elevation, intensity: 0.4, softness: 0.4, id: 'rig-key' }),
  ];
}

// Logical keywords mirror in RTL; "overhead" points straight down at the page
export function staticLights (value: string, rtl: boolean): Light[] | null {
  const word = value.trim().toLowerCase();

  if (word === '') return null;
  if (word === 'none') return [];
  if (word === 'overhead') return keyRig(0, 90);

  if (Object.hasOwn(STATIC_ANGLES, word)) {
    return keyRig(STATIC_ANGLES[word]!);
  }

  if (Object.hasOwn(LOGICAL_ANGLES, word)) {
    const angle = LOGICAL_ANGLES[word]!;

    return keyRig(rtl ? (360 - angle) % 360 : angle);
  }

  const degrees = parseFloat(word);

  return Number.isFinite(degrees) && /^-?[\d.]+(deg)?$/.test(word) ? keyRig(((degrees % 360) + 360) % 360) : null;
}

export function defaultRig (rtl: boolean): Light[] {
  return keyRig(rtl ? 30 : 330);
}

// Nearest first, through shadow hosts
function scopesAbove (el: Element): Element[] {
  const found: Element[] = [];

  for (let node: Node | null = el; node; node = parentOrHost(node)) {
    if (node.nodeType === 1 && scopes.has(node as Element)) {
      found.push(node as Element);
    }
  }

  return found;
}

// Nearest scope across shadow boundaries, else the document's, else a static data-droplet-light, else null (material default)
export function lightsFor (el: Element): readonly Light[] | null {
  for (let node: Node | null = el; node; node = parentOrHost(node)) {
    if (node.nodeType === 1) {
      const state = scopes.get(node as Element);

      if (state) {
        return state.applied;
      }
    }
  }

  const docState = scopes.get(el.ownerDocument);

  if (docState) {
    return docState.applied;
  }

  const authored = readScopedAxis(el, 'light');

  if (authored === null) {
    return null;
  }

  return staticLights(authored, getComputedStyle(el).direction === 'rtl');
}

// Drawing-buffer pixels (render scale and DPR folded in) → viewport CSS px
export function canvasPointToViewport (canvas: HTMLCanvasElement, x: number, y: number): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();

  return {
    x: rect.left + (x / (canvas.width || 1)) * rect.width,
    y: rect.top + (y / (canvas.height || 1)) * rect.height,
  };
}
