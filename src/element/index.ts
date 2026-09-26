/*
 * JellyElement - the base class for every canvas-backed Jelly UI component
 *
 * Handles the parts every jelly component shares: a shadow-DOM <canvas>
 * sized to the host (plus padding so the wobble can overflow), device-
 * pixel-ratio and resize handling, converting pointer coordinates into
 * shape-local space, theme-change repaints and painting a JellyBody as a
 * flat solid fill. Subclasses provide the interactive markup, the shape,
 * the fill color and event wiring.
 */

import { JellyBody }            from '../core/index.js';
import { engine }               from '../core/index.js';
import { traceSmoothPath }      from '../core/index.js';
import type { JellyComponent }  from '../core/index.js';
import type { JellyConfig }     from '../core/index.js';
import type { SurfacePoint }    from '../core/index.js';

import { canonicalizeSize }     from '../utilities/index.js';
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
import { resolveConfig }         from '../resolve/index.js';
import type { Quality }          from '../resolve/index.js';
import type { Resolved }         from '../resolve/index.js';
import type { ResolveInputs }    from '../resolve/index.js';

import { HTMLElementBase }       from './base.js';

import { canonicalizeQualityAttribute } from './configure.js';
import { readQuality }                  from './configure.js';
import { replayProperties }             from './configure.js';
import { warnUnknownFeel }              from './configure.js';
import { writeQuality }                 from './configure.js';

import { buildFrame }            from './painter.js';
import type { PainterFrame }     from './painter.js';

import type { RGBA }             from './types.js';
import type { Shape }            from './types.js';
import type { Ring }             from './types.js';
import type { Border }           from './types.js';
import type { PaintOptions }     from './types.js';
import type { WirePressOptions } from './types.js';

// Re-export the shape / paint / wiring types so consumers import them from here
export type { RGBA, Shape, Ring, Border, PaintOptions, WirePressOptions } from './types.js';
export type { PainterFrame } from './painter.js';

// Keyed by body rather than by element so a component with several bodies keeps
// one applied record per membrane (the slider's thumb resolves separately)
const appliedRecords = new WeakMap<JellyBody, Resolved>();

export class JellyElement extends HTMLElementBase implements JellyComponent {

  // Padding around the shape so the wobble can overflow without clipping
  static PAD = 48;

  // Opt-in for the resolver half of this class; unconverted components leave it
  // false and keep exactly the connect path they had before the fork.
  static usesResolver = false;

  // Properties replayed through their setters on upgrade (state-and-reflection.md)
  static REPLAYED: readonly string[] = ['feel', 'quality'];

  body: JellyBody | null = null;
  built = false;
  dpr = 1;
  cssW = 0;
  cssH = 0;

  // Per-instance physics overrides; subclasses may assign before build. An
  // accessor, not a field, so a component can override it with a resolving setter.
  rawConfig: Partial<JellyConfig> | undefined = undefined;

  resolvedRecord: Resolved | undefined = undefined;
  configWarned: Set<string> | undefined = undefined;
  scopeUnsubscribe: (() => void) | null = null;

  // The raw override layer, returned as the stored copy; the resolved record is
  // read through resolvedConfig (resolver.md)
  get config (): Partial<JellyConfig> | undefined {
    return this.rawConfig;
  }

  set config (value: Partial<JellyConfig> | undefined) {
    if (!this.usesResolver) {
      this.rawConfig = value;
      return;
    }

    this.rawConfig = value ? this.validateConfig(value) : undefined;
    this.resolve();
  }

  get usesResolver (): boolean {
    return (this.constructor as typeof JellyElement).usesResolver;
  }

  // The effective feel after the cascade and the unknown-name fallback, never
  // the raw attribute (attribute-matrix.md)
  get feel (): string {
    return this.resolution().feel;
  }

  set feel (value: string | null) {
    if (value === null || value === undefined) {
      this.removeAttribute('feel');
    } else {
      this.setAttribute('feel', value);
    }
  }

  get quality (): Quality {
    return readQuality(this);
  }

  set quality (value: Quality | string | null) {
    writeQuality(this, value);
  }

  get resolvedConfig (): Readonly<JellyConfig> {
    return this.resolution().config;
  }

  // The component's own physics layer, below any feel preset (resolver.md)
  profile (): Partial<JellyConfig> {
    return {};
  }

  // Drop what the resolver would silently ignore, but tell the author why -
  // once per element per key, so a bad value in a frame loop cannot spam
  validateConfig (value: Partial<JellyConfig>): Partial<JellyConfig> {
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
        console.warn(`[jelly] config.${key} is not a finite JellyConfig field; ignoring`, this);
      }
    }

    return copy as Partial<JellyConfig>;
  }

  // Every input change recomputes the whole record from canonical inputs, so
  // attribute order is unobservable (resolver.md)
  resolve (): Resolved {
    const inputs = this.axisInputs();
    const next   = resolveConfig({ profile: this.profile(), ...inputs });

    // A supplied name that resolved to something else is invalid, feel="" included
    if (inputs.feel !== null && next.feel !== inputs.feel) {
      warnUnknownFeel(inputs.feel, this.ownerDocument);
    }

    this.resolvedRecord = next;

    // Reading feel on an unconverted component must stay side-effect free
    if (this.usesResolver) {
      this.applyResolved(next);
    }

    return next;
  }

  resolution (): Resolved {
    return this.resolvedRecord ?? this.resolve();
  }

  // The canonical axis inputs every body of this element resolves from, so a
  // multi-membrane component cannot drift between its bodies
  axisInputs (): Omit<ResolveInputs, 'profile'> & { feel: string | null } {
    return {
      feel:     this.getAttribute('feel') ?? readScopedAxis(this, 'feel'),
      raw:      this.rawConfig,
      quality:  this.quality,
      document: this.ownerDocument,
    };
  }

  // A second membrane resolved through the same axis inputs but its own
  // component profile; the slider's thumb is the Phase 1 case (resolver.md)
  resolveFor (profile: Partial<JellyConfig>): Resolved {
    return resolveConfig({ profile, ...this.axisInputs() });
  }

  // Record what a freshly built body was seeded from, so the next applyResolved
  // compares against it instead of rebuilding a membrane that already matches
  seedResolved (body: JellyBody, resolved: Resolved): void {
    appliedRecords.set(body, resolved);
  }

  // Momentum-preserving resampling is Phase 6, so a membrane-shaping change
  // rebuilds the ring from rest for now.
  applyResolved (resolved: Resolved, body: JellyBody | null = this.body): void {
    if (!body) {
      return;
    }

    const next = resolved.config;
    // Against the last record applied to this body, not body.config: the body
    // rewrites some fields as it stores them, so that comparison never settles.
    const previous = appliedRecords.get(body)?.config;
    const rebuild  = !previous
      || previous.samples !== next.samples
      || previous.normalBlendPasses !== next.normalBlendPasses;

    body.config = { ...next };
    appliedRecords.set(body, resolved);

    if (rebuild) {
      body.resize(body.width, body.height, body.radius);
    }

    this.requestFrame();
  }

  // Populated in build(); ctx stays unset when getContext('2d') returns null
  canvas!: HTMLCanvasElement;
  ctx!: CanvasRenderingContext2D;
  overhang!: SVGForeignObjectElement;

  // Canvas is decoration: false means every paint path no-ops instead of throwing
  hasContext = false;
  contextLost = false;

  painterFailed = false;
  asyncPainterWarned = false;

  resizeObserver: ResizeObserver | null = null;
  attributeObserver: MutationObserver | null = null;

  focusVisible = false;
  frameDt = 0;
  colorEasing = false;
  eased: Record<string, RGBA | undefined> = {};
  probe?: HTMLSpanElement;
  hostFocusTarget?: HTMLElement | null;
  hostFocusHandler?: (event: FocusEvent) => void;
  pressPointerId: number | null = null;
  keyboardActive = false;

  /*
   * Base-class listeners are bound as fields so subclasses keep handleEvent to
   * themselves. A theme (or direction) change can move the jelly box without
   * resizing the host - the ResizeObserver won't fire - so reposition the
   * canvas and let the subclass re-seat any direction-dependent geometry
   * before repainting.
   */
  onThemeChange = (): void => {
    if (this.built) {
      this.applyShape();
      this.onShape();
    }

    this.requestFrame();
  };

  // An in-page reduced-motion preview can change independently of the OS
  // media query. Wake parked components so continuous indicators stop or
  // resume immediately and every canvas repaints in its new motion mode.
  onMotionChange = (): void => this.requestFrame();

  onWindowResize = (): void => this.applyShape();

  // Don't preventDefault: the browser only attempts a restore if the event
  // goes unhandled. Painting stops and the CSS focus fallback takes over.
  onContextLost = (): void => {
    this.contextLost = true;
    this.setAttribute('data-jelly-nocanvas', '');
    engine.drop(this);
  };

  // The restored context comes back untransformed and with no cached paths
  onContextRestored = (): void => {
    this.contextLost = false;
    this.removeAttribute('data-jelly-nocanvas');
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    // applyShape early-returns while the context is lost, so any resize that
    // fired during the loss is only picked up here.
    this.applyShape();
  };

  constructor () {
    super();

    this.attachShadow({ mode: 'open', delegatesFocus: true });
  }

  /* ---- Subclass hooks ---------------------------------------------- */

  // Extra CSS (string) for the shadow root
  styles (): string {
    return '';
  }

  // Interactive markup that sits above the canvas
  content (): string {
    return '<slot></slot>';
  }

  // Given the measured host size, return the jelly shape to build
  shape (width: number, height: number): Shape {
    return { width, height, radius: Math.min(width, height) / 2 };
  }

  // Resolve the current fill color (the canvas reads the computed token)
  fill (): string {
    const custom = getComputedStyle(this).getPropertyValue('--jelly-fill').trim();

    return custom || PALETTE['background-accent']!;
  }

  // Called once after the shadow DOM and canvas exist. Wire events here.
  onBuilt (): void {}

  // Called whenever the shape (re)builds
  onShape (): void {}

  // One animation step. Return true to keep animating.
  frame (dt: number): boolean {
    return this.defaultFrame(dt);
  }

  // Paints the body surface with fillStyle already eased and globalAlpha set.
  // paintTrack, paintFill and paintFocus are reserved for Phase 6 slots.
  paintSurface (frame: PainterFrame): void {
    frame.ctx.fill(frame.path);
  }

  /* ---- Lifecycle --------------------------------------------------- */

  // Lifecycle method: Called automatically when the element is appended to the DOM
  connectedCallback (): void {
    if (this.usesResolver) {
      this.connectResolver();
    }

    ensureThemeTokens(this.ownerDocument);
    canonicalizeSize(this);

    // A painter disabled by a throw gets one more chance per reconnect
    this.painterFailed = false;

    if (!this.built) {
      this.build();
    }

    this.observeResize();

    // Many components style themselves entirely from host attributes the
    // subclass doesn't observe (variant → --jelly-fill via CSS, inline
    // --jelly-* overrides, state classes). Repaint the canvas on any host
    // attribute change so a dynamically set variant / token takes effect
    // immediately instead of waiting for the next interaction.
    if (!this.attributeObserver) {
      this.attributeObserver = new MutationObserver(() => this.requestFrame());
      this.attributeObserver.observe(this, { attributes: true });
    }

    // Theme flips change the computed fill; zoom changes the device pixel
    // ratio without firing the ResizeObserver - both need a repaint
    window.addEventListener('jelly-theme-change', this.onThemeChange);
    window.addEventListener('jelly-motion-change', this.onMotionChange);
    window.addEventListener('resize', this.onWindowResize, { passive: true });

    this.requestFrame();
  }

  // Replay, canonicalize and resolve before the base connect path builds the
  // body, so the first membrane is seeded from the record it will keep
  connectResolver (): void {
    installScopeBridge(this.ownerDocument);

    replayProperties(this, (this.constructor as typeof JellyElement).REPLAYED);
    canonicalizeQualityAttribute(this);
    this.resolve();

    if (!this.scopeUnsubscribe) {
      this.scopeUnsubscribe = onScopeChange(this.ownerDocument, () => this.resolve());
    }
  }

  adoptedCallback (): void {
    ensureThemeTokens(this.ownerDocument);
  }

  // Lifecycle method: Called automatically when the element leaves the DOM
  disconnectedCallback (): void {
    engine.drop(this);

    this.scopeUnsubscribe?.();
    this.scopeUnsubscribe = null;

    window.removeEventListener('jelly-theme-change', this.onThemeChange);
    window.removeEventListener('jelly-motion-change', this.onMotionChange);
    window.removeEventListener('resize', this.onWindowResize);

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    if (this.attributeObserver) {
      this.attributeObserver.disconnect();
      this.attributeObserver = null;
    }
  }

  // False while there is no 2D context (or it is lost): every paint path
  // no-ops so semantics and interaction survive without the canvas
  get canPaint (): boolean {
    return this.hasContext && !this.contextLost;
  }

  // True when the user prefers reduced motion (checked live, not cached)
  get reducedMotion (): boolean {
    return prefersReducedMotion();
  }

  // The canvas sits in an SVG foreignObject because SVG overflow is ink overflow
  // in every engine: the PAD overhang paints but never makes an ancestor scroll.
  build (): void {
    this.shadowRoot!.innerHTML =
      `<style>${baseStyles}${this.styles()}</style>` +
      `<svg class="jelly-overhang" aria-hidden="true"><foreignObject>` +
      `<canvas class="jelly-canvas" part="jelly" aria-hidden="true"></canvas>` +
      `</foreignObject></svg>` +
      `<div class="jelly-content">${this.content()}</div>`;

    this.canvas   = this.shadowRoot!.querySelector<HTMLCanvasElement>('.jelly-canvas')!;
    this.overhang = this.shadowRoot!.querySelector<SVGForeignObjectElement>('.jelly-overhang > foreignObject')!;
    this.built    = true;

    const ctx = this.canvas.getContext('2d');

    if (ctx) {
      this.ctx        = ctx;
      this.hasContext = true;

      this.canvas.addEventListener('contextlost', this.onContextLost);
      this.canvas.addEventListener('contextrestored', this.onContextRestored);
    } else {
      this.setAttribute('data-jelly-nocanvas', '');
    }

    this.onBuilt();
  }

  // Rebuild the shape whenever the host's layout size changes
  observeResize (): void {
    if (this.resizeObserver) {
      return;
    }

    this.resizeObserver = new ResizeObserver(() => this.applyShape());
    this.resizeObserver.observe(this);

    this.applyShape();
  }

  /*
   * The region the jelly shape occupies, in host-local pixels. Defaults to
   * the whole host; a component can mark an inner element with
   * `data-jelly-box` to render the jelly over just that sub-region
   * (e.g. a checkbox next to its label).
   */
  jellyBox (): { width: number; height: number; offsetX: number; offsetY: number; screenX: number; screenY: number } {
    const hostRect = this.getBoundingClientRect();

    // Divide out any ancestor CSS transform (e.g. a dialog's open-scale pop
    // scales x/y by different amounts) so the canvas sizes in the element's
    // own layout units — otherwise a jelly built mid-animation bakes in the
    // wrong size/aspect ratio. Untransformed: sx/sy ≈ 1, a no-op.
    const sx   = this.offsetWidth > 0 ? hostRect.width / this.offsetWidth : 1;
    const sy   = this.offsetHeight > 0 ? hostRect.height / this.offsetHeight : 1;
    const invX = sx > 0.001 ? 1 / sx : 1;
    const invY = sy > 0.001 ? 1 / sy : 1;

    const boxEl = this.shadowRoot!.querySelector('[data-jelly-box]');
    const b     = boxEl ? boxEl.getBoundingClientRect() : hostRect;

    return {
      width:   b.width * invX,
      height:  b.height * invY,
      offsetX: (b.left + b.width / 2 - hostRect.left) * invX,
      offsetY: (b.top + b.height / 2 - hostRect.top) * invY,

      // Screen coords stay in screen space for pointer → local mapping
      screenX: b.left + b.width / 2,
      screenY: b.top + b.height / 2,
    };
  }

  // Size the canvas for the current shape and (re)build the physics body
  applyShape (): void {
    if (!this.built || !this.canPaint) {
      return;
    }

    const box = this.jellyBox();

    if (box.width < 1 || box.height < 1) {
      return;
    }

    const shape = this.shape(box.width, box.height);
    const pad   = (this.constructor as typeof JellyElement).PAD;
    const cssW  = shape.width + pad * 2;
    const cssH  = shape.height + pad * 2;
    const dpr   = Math.min(window.devicePixelRatio || 1, 3);
    const pxW   = Math.round(cssW * dpr);
    const pxH   = Math.round(cssH * dpr);

    // Resizing the canvas clears it (a visible flicker) and rebuilds the
    // membrane. Only do that when the pixel size actually changes - a sub-pixel
    // reflow (e.g. a tab's active label going bold) must not trigger it.
    const resize = !this.body || this.canvas.width !== pxW || this.canvas.height !== pxH;

    if (resize) {
      this.dpr  = dpr;
      this.cssW = cssW;
      this.cssH = cssH;

      this.canvas.style.width  = `${this.cssW}px`;
      this.canvas.style.height = `${this.cssH}px`;
    }

    // Repositioning never clears the canvas, so always do it. SVG user units are
    // the host's CSS pixels, with the origin at its padding box.
    this.overhang.setAttribute('x',      String(box.offsetX - this.cssW / 2));
    this.overhang.setAttribute('y',      String(box.offsetY - this.cssH / 2));
    this.overhang.setAttribute('width',  String(this.cssW));
    this.overhang.setAttribute('height', String(this.cssH));

    if (!resize) {
      return;
    }

    this.canvas.width  = pxW;
    this.canvas.height = pxH;

    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (!this.body) {
      // Seeding from the resolved record is what keeps the first build single:
      // the membrane is born with its final sample count, not rebuilt after.
      const resolved = this.usesResolver ? this.resolution() : null;

      this.body = new JellyBody({
        width:  shape.width,
        height: shape.height,
        radius: shape.radius,
        config: resolved ? { ...resolved.config } : this.config,
      });

      if (resolved) {
        appliedRecords.set(this.body, resolved);
      }
    } else {
      this.body.resize(shape.width, shape.height, shape.radius);
    }

    this.onShape();

    // Resizing the canvas above cleared it. Repaint synchronously so a fast
    // size transition (the ResizeObserver fires every frame) never flashes a
    // blank frame between the resize and the engine's next tick, then wake the
    // engine to let the physics settle.
    try {
      this.frame(0);
    } catch (error) {
      console.error('Jelly UI paint error', error);
    }

    this.requestFrame();
  }

  /*
   * Rebuild the membrane in place after a shape attribute change (e.g. a
   * radius swap) that doesn't resize the box - applyShape would early-return
   * since the canvas pixel size is unchanged, so reshape the body directly.
   */
  reshapeMembrane (): void {
    if (!this.built || !this.body) {
      return;
    }

    const box = this.jellyBox();

    if (box.width < 1 || box.height < 1) {
      return;
    }

    const next = this.shape(box.width, box.height);

    this.body.resize(next.width, next.height, next.radius);
    this.requestFrame();
  }

  /* ---- Rendering --------------------------------------------------- */

  // Wipe the canvas for the next paint
  clearCanvas (): void {
    if (!this.canPaint) {
      return;
    }

    this.ctx.clearRect(0, 0, this.cssW, this.cssH);
  }

  /*
   * Paint one body centered in the canvas (with optional pixel offset).
   * Flat solid fill - no gradients or shading.
   */
  paintBody (body: JellyBody, options: PaintOptions = {}): void {
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

      // Optional per-point post-projection deform (x, y, z) → (x, y, z).
      // Used for effects the physics shouldn't carry, e.g. tapering a
      // slider thumb's tail.
      warp   = null,

      // Crossfade the fill toward its target instead of snapping (so variant /
      // state changes ease). Components that paint more than one body per frame
      // pass a distinct easeKey per body so their colours don't share a track.
      ease    = true,
      easeKey = 'body',
    } = options;

    // Ease the surface colour; ring / border stay exact (structural)
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

    // Focus ring: the same deformed surface pushed outward, so it jiggles too
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

    let painted = false;

    if (!this.painterFailed) {
      // A custom painter must not leak fill style, transforms, clips or filters
      // into the border pass, another body, or the next frame
      ctx.save();

      try {
        this.warnIfAsync(this.paintSurface(frame));
        painted = true;
      } catch (error) {
        this.painterFailed = true;
        console.error('Jelly UI painter error', error);
      } finally {
        ctx.restore();
      }
    }

    // Fall back outside the save/restore so a half-applied clip or transform
    // from the failed painter cannot distort the matte fill
    if (!painted) {
      ctx.fill(frame.path);
    }

    if (border) {
      ctx.lineWidth   = border.width;
      ctx.strokeStyle = border.color;
      ctx.lineJoin    = 'round';
      ctx.stroke(frame.path);
    }

    ctx.restore();
  }

  /*
   * Painting is synchronous; whatever a returned promise draws later lands on
   * an already-cleared canvas. Warn once per element and ignore the value.
   */
  warnIfAsync (result: unknown): void {
    if (this.asyncPainterWarned || !result || typeof (result as PromiseLike<unknown>).then !== 'function') {
      return;
    }

    this.asyncPainterWarned = true;
    console.warn('Jelly UI: paintSurface() is synchronous; the returned promise is ignored', this);
  }

  // The standard frame: advance physics, repaint, sleep when at rest
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

  // Border descriptor painted on the jelly surface, else null
  surfaceBorder (): Border | null {
    return null;
  }

  /* ---- Focus ring -------------------------------------------------- */

  // Ring descriptor when keyboard-focused, else null. Override as needed.
  // Width and gap resolve from --jelly-ring-width / --jelly-ring-gap so the
  // ring geometry is themeable, not only its color.
  focusRing (): Ring | null {
    if (!this.focusVisible) {
      return null;
    }

    const styles = getComputedStyle(this);
    const width  = parseFloat(styles.getPropertyValue('--jelly-ring-width')) || FOCUS_RING.width;
    const gap    = parseFloat(styles.getPropertyValue('--jelly-ring-gap'));

    return { color: this.ringColor(), width, gap: Number.isFinite(gap) ? gap : FOCUS_RING.gap };
  }

  // The focus ring color, softly blended toward transparent - it tracks the
  // component's own --jelly-ring (usually its fill hue) so the ring reads as
  // part of the control rather than a generic blue outline.
  ringColor (): string {
    const [r, g, b, a] = this.rgbaTuple(
      `var(--jelly-ring, var(--jelly-color-border-focus, ${PALETTE['border-focus']}))`,
    );

    /* Canvas strokeStyle support for CSS Color 4's color(srgb … / .5)
       serialization is inconsistent. Emit legacy rgba() so the alpha cannot
       be rejected while CSS-rendered rings keep using color-mix(). */
    return this.colorString([r, g, b, a * FOCUS_RING.alpha], { forceAlpha: true });
  }

  /*
   * Ease a fill color toward its target so a variant / state change crossfades
   * rather than snapping. Keyed so a component painting several bodies a frame
   * eases each on its own track. Frame-rate independent; settles in ~0.3s and
   * jumps straight to the target under reduced motion or on the first paint.
   * Raises `colorEasing` (read by the engine) so the frame keeps running.
   */
  easeColor (key: string, expr: string, dt: number): string {
    const target = this.rgbaTuple(expr);

    const current = this.eased[key];

    // First paint or reduced motion → adopt the target immediately
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

    // Still crossfading: keep the frame alive (the engine reads this) and only
    // advance when time actually elapsed - the first frame after a park can
    // arrive with dt = 0, which must hold the colour, not snap it.
    this.colorEasing = true;

    if (dt > 0) {
      const k = 1 - Math.exp(-dt * 10);

      for (const i of [0, 1, 2, 3] as const) {
        current[i] += (target[i] - current[i]) * k;
      }
    }

    return this.colorString(current);
  }

  // Resolve a color expression to an [r, g, b, a] tuple. RGB channels use
  // 0–255; alpha uses 0–1. Keeping alpha here prevents short hex colors such
  // as #fff0 from becoming opaque as they pass through canvas animation.
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

  // Backward-compatible RGB-only view for calculations that do not need alpha
  rgbTriple (expr: string): number[] {
    return this.rgbaTuple(expr).slice(0, 3);
  }

  // Serialize a tuple to a canvas-safe legacy color. Keep opaque colors as
  // rgb() for compactness; rgba() is required whenever transparency matters.
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

  // Blend two live CSS color expressions. Shared by controls that animate
  // between semantic off/on colors, including their alpha channels.
  mixColor (from: string, to: string, amount: number): string {
    const start = this.rgbaTuple(from);
    const end   = this.rgbaTuple(to);
    const t     = Math.max(0, Math.min(1, amount));
    const mixed = start.map((channel, index) => channel + ((end[index] ?? channel) - channel) * t);

    return this.colorString(mixed);
  }

  // Resolve a CSS color expression (var(), color-mix(), …) to a concrete sRGB
  // color. The token values are oklch(), and getComputedStyle preserves oklch()
  // in modern browsers - so we wrap the expression in color-mix(in srgb, …) to
  // force the computed value into sRGB (color(srgb …) / rgb()). rgbaTuple reads
  // the channels numerically and would misread a raw oklch triple as RGB.
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

  // Track keyboard-focus (:focus-visible) on an inner control for the ring
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
        /* Focus events crossing a shadow boundary are retargeted to the host.
           If an inner control already owns focus, leave it there; otherwise a
           second tabbable control (for example a chip's remove button) gets
           bounced back to the primary control. */
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

  // Keep the inner focus target's tab order in sync with disabled state
  syncHostFocusTarget (): void {
    if (!this.hostFocusTarget) {
      return;
    }

    this.hostFocusTarget.tabIndex = this.hasAttribute('disabled') ? -1 : 0;
    this.removeAttribute('tabindex');
  }

  /* ---- Interaction helpers ----------------------------------------- */

  // Ask the shared engine for animation frames until the body rests
  requestFrame (): void {
    if (!this.canPaint) {
      return;
    }

    engine.wake(this);
  }

  // Convert client coords into the body's local (shape-centered) frame
  toLocal (clientX: number, clientY: number, body: JellyBody | null = this.body): { x: number; y: number } {
    const box = this.jellyBox();

    // Divide out ancestor CSS scale the same way jellyBox does, so a press
    // inside a transformed ancestor (a dialog mid-pop) still lands where the
    // finger is instead of drifting toward the center
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

  // Press the jelly at a screen coordinate
  pressAt (clientX: number, clientY: number, strength = 1.12): void {
    if (this.reducedMotion || !this.body) {
      return;
    }

    const local = this.toLocal(clientX, clientY);

    this.body.pressAtLocal(local.x, local.y, strength);
    this.requestFrame();
  }

  // Drag the held press to a new screen coordinate
  moveAt (clientX: number, clientY: number): void {
    if (this.reducedMotion || !this.body) {
      return;
    }

    const local = this.toLocal(clientX, clientY);

    this.body.moveToLocal(local.x, local.y);
    this.requestFrame();
  }

  // Release the held press and let the body settle
  releaseBody (): void {
    if (!this.body) {
      return;
    }

    this.body.release();
    this.requestFrame();
  }

  // Sustained center squish (keyboard press-and-hold)
  centerPulse (strength = 1): void {
    if (this.reducedMotion || !this.body) {
      return;
    }

    this.body.centerPulse(strength);
    this.requestFrame();
  }

  // One-shot center squish that settles on its own (focus, toggle, grab)
  centerPop (strength = 1): void {
    if (this.reducedMotion || !this.body) {
      return;
    }

    this.body.centerPop(strength);
    this.requestFrame();
  }

  /*
   * Wire the standard press feel onto an inner control: pointer presses
   * dent the jelly under the finger and follow it, Enter / Space squish
   * from the center and everything releases cleanly - including pointer
   * capture loss and blur mid-press. Handles one pointer at a time; extra
   * touches are ignored rather than fighting over the membrane.
   */
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
        // Capture can fail if the pointer is already gone; the press still works
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
      // pressAt() uses 1.12 by default; match that strength so keyboard and a
      // pointer pressed at the exact center share the same deformation.
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
