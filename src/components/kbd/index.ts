import { DropletElement } from '../../element/index.js';
import type { Shape }   from '../../element/index.js';
import { defineStrict, TAGS } from '../../registry/index.js';
import type { DefineOptions, DefineResult } from '../../registry/index.js';

import kbdStyles         from './kbd.css?inline';

const NON_TEXT_INPUTS = new Set(['button', 'checkbox', 'color', 'file', 'image', 'radio', 'range', 'reset', 'submit']);

// composedPath()[0] reaches past retargeting to the field inside droplet-input
function isTyping (event: KeyboardEvent): boolean {
  const target = event.composedPath()[0] as HTMLElement | undefined;

  if (!target || target.nodeType !== Node.ELEMENT_NODE) {
    return false;
  }

  if (target.isContentEditable || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
    return true;
  }

  return target.tagName === 'INPUT' && !NON_TEXT_INPUTS.has((target as HTMLInputElement).type);
}

type Modifier = 'ctrlKey' | 'altKey' | 'metaKey' | 'shiftKey';

// A Map, not an object, so "constructor+k" isn't a modifier
const MODIFIER_NAMES = new Map<string, Modifier>([
  ['control', 'ctrlKey'], ['ctrl', 'ctrlKey'], ['alt', 'altKey'], ['meta', 'metaKey'], ['shift', 'shiftKey'],
]);

const MODIFIER_KEYS: Record<Modifier, string> = { ctrlKey: 'Control', altKey: 'Alt', metaKey: 'Meta', shiftKey: 'Shift' };

interface Chord {
  key: string;
  modifiers: Set<Modifier>;
}

const CHORD_STEP = /^([a-z]+)\+(.+)$/i;

function parseChord (value: string): Chord {
  const modifiers = new Set<Modifier>();
  let key = value;

  for (let match = CHORD_STEP.exec(key); match; match = CHORD_STEP.exec(key)) {
    const modifier = MODIFIER_NAMES.get(match[1]?.toLowerCase() ?? '');

    if (!modifier) {
      break;
    }

    modifiers.add(modifier);
    key = match[2] ?? '';
  }

  return { key: key.toLowerCase(), modifiers };
}

// Ctrl, Alt, and Meta must match exactly; Shift counts only when named, since it types characters.
// AltGr reports Ctrl+Alt on Windows.
function modifiersMatch (event: KeyboardEvent, chord: Chord): boolean {
  const altGraph = event.getModifierState?.('AltGraph') ?? false;

  for (const flag of ['ctrlKey', 'altKey', 'metaKey'] as const) {
    const held = event[flag] && !(altGraph && flag !== 'metaKey') && event.key !== MODIFIER_KEYS[flag];

    if (held !== chord.modifiers.has(flag)) {
      return false;
    }
  }

  return !chord.modifiers.has('shiftKey') || event.shiftKey;
}

// The nearest data-droplet-shortcuts ancestor wins, crossing shadow roots like the cascade
function shortcutsOff (el: Element): boolean {
  let node: Element | null = el;

  while (node) {
    const value = node.getAttribute('data-droplet-shortcuts');

    if (value !== null) {
      return value.trim().toLowerCase() === 'off';
    }

    node = node.parentElement ?? (node.getRootNode() as Partial<ShadowRoot>).host ?? null;
  }

  return false;
}

/**
 * A tactile keyboard key. With `key="…"` it mirrors that physical key
 * document-wide, depressing whenever the key is held.
 *
 * The typing guard cannot see an editable control inside a closed shadow root; a component
 * with one should set `data-droplet-shortcuts="off"` on its host while editing.
 *
 * @element droplet-kbd
 *
 * @slot - The key label (a letter, symbol or icon).
 *
 * @attr {string} key - A `KeyboardEvent.key` value to mirror document-wide, optionally led by modifiers (`Meta+k`, `Control+Shift+p`). Skipped while typing in a field, with Ctrl, Alt, or Meta held that the value does not name, or inside a `data-droplet-shortcuts="off"` scope (WCAG 2.1.4).
 * @attr {boolean} decorative - A display-only hint: no role and no tab stop, so it can sit inside a button whose accessible name still includes the key text.
 * @attr {"small"|"medium"|"large"} size - Keycap size.
 * @attr {string} feel - Registered feel preset driving the physics; inherits from a `data-droplet-feel` scope.
 * @attr {"low"|"medium"|"high"} quality - Caps physics cost (med/lo/hi aliases accepted); inherits from a `data-droplet-quality` scope.
 * @attr {string} material - Registered material preset: "matte" (the default) or "gloss" (Experimental); inherits from a `data-droplet-material` scope.
 * @attr {number} gloss - Sheen sharpness 0–1 for a lit material (Experimental); defaults to the material's sharpness.
 * @attr {number} softness - Feel knob 0–1: how far the surface gives under a press; unset keeps the feel preset's setting, and 0.5 is neutral.
 * @attr {number} bounce - Feel knob 0–1: how long it keeps wobbling before it settles; unset keeps the feel preset's setting, and 0.5 is neutral.
 * @attr {number} viscosity - Feel knob 0–1: how thick and slow it moves; unset keeps the feel preset's setting, and 0.5 is neutral.
 * @attr {number} spread - Feel knob 0–1: how far a dent travels around the edge; unset keeps the feel preset's setting, and 0.5 is neutral.
 * @attr {number} depth - Feel knob 0–1: how far it presses in and tilts; unset keeps the feel preset's setting, and 0.5 is neutral.
 * @attr {number} intensity - Feel knob 0–1: master gain on every push the surface takes; unset keeps the feel preset's setting, and 0.5 is neutral.
 *
 * @csspart cap - The keycap surface.
 */
export class DropletKbd extends DropletElement implements EventListenerObject {

  static define (options?: DefineOptions): DefineResult {
    return defineKbd(options);
  }

  static override usesResolver = true;

  onDocumentKeyDown: ((event: KeyboardEvent) => void) | null = null;
  onDocumentKeyUp: ((event: KeyboardEvent) => void) | null = null;

  pointerPressed = false;
  mirrorPressed = false;

  static get observedAttributes (): string[] {
    return ['key', 'decorative', ...DropletElement.AXIS_ATTRIBUTES];
  }

  get decorative (): boolean {
    return this.hasAttribute('decorative');
  }

  set decorative (value: boolean) {
    this.toggleAttribute('decorative', Boolean(value));
  }

  override styles (): string {
    return kbdStyles;
  }

  override content (): string {
    return `<span class="cap" part="cap"><slot></slot></span>`;
  }

  override shape (width: number, height: number): Shape {
    return {
      width:  width - 2,
      height: height - 2,
      radius: Math.min(10, (height - 2) * 0.34),
    };
  }

  override onBuilt (): void {
    this.syncDecorative();
    this.trackFocus(this);

    this.addEventListener('pointerdown', this);
    this.addEventListener('pointerup', this);
    this.addEventListener('pointercancel', this);
    this.addEventListener('pointerleave', this);
    this.addEventListener('keydown', this);
    this.addEventListener('keyup', this);
    this.addEventListener('blur', this);

    this.armKeyMirror();
  }

  attributeChangedCallback (name: string): void {
    if (this.axisAttributeChanged(name)) {
      return;
    }

    if (!this.built) {
      return;
    }

    if (name === 'decorative') {
      this.syncDecorative();
    } else {
      this.armKeyMirror();
    }
  }

  syncDecorative (): void {
    if (!this.decorative) {
      this.tabIndex = 0;
      this.setAttribute('role', 'button');
      return;
    }

    this.removeAttribute('role');
    this.removeAttribute('tabindex');

    if (this.matches(':focus')) {
      this.blur();
    }
  }

  // Re-arms the mirror disconnectedCallback dropped
  override connectedCallback (): void {
    super.connectedCallback();

    if (this.built) {
      this.armKeyMirror();
    }
  }

  armKeyMirror (): void {
    this.disarmKeyMirror();

    const value = this.getAttribute('key');

    if (!value) {
      return;
    }

    const chord = parseChord(value);

    // Chrome's autofill fires keydown as a plain Event with no key
    const matches = (event: KeyboardEvent): boolean => (
      typeof event.key === 'string' && event.key.toLowerCase() === chord.key
    );

    this.onDocumentKeyDown = (event) => {
      if (!matches(event) || event.repeat || !modifiersMatch(event, chord) || isTyping(event) || shortcutsOff(this)) {
        return;
      }

      this.mirrorPressed = true;
      this.press();
    };

    // Ungated, so a cap pressed before focus moved into a field still rises.
    // Releasing a modifier releases too: macOS drops a key's keyup while Meta is held.
    this.onDocumentKeyUp = (event) => {
      if (matches(event) || [...chord.modifiers].some((flag) => MODIFIER_KEYS[flag] === event.key)) {
        this.releaseMirror();
      }
    };

    document.addEventListener('keydown', this.onDocumentKeyDown);
    document.addEventListener('keyup', this.onDocumentKeyUp);
  }

  // Releases first: a held key's keyup never arrives once the listeners are gone
  disarmKeyMirror (): void {
    this.releaseMirror();

    if (this.onDocumentKeyDown && this.onDocumentKeyUp) {
      document.removeEventListener('keydown', this.onDocumentKeyDown);
      document.removeEventListener('keyup', this.onDocumentKeyUp);
      this.onDocumentKeyDown = null;
      this.onDocumentKeyUp = null;
    }
  }

  handleEvent (event: Event): void {
    switch (event.type) {
      case 'pointerdown': {
        const pointer = event as PointerEvent;
        try {
          this.setPointerCapture(pointer.pointerId);
        } catch {
          // Pointer already gone
        }
        this.pointerPressed = true;
        this.press(pointer.clientX, pointer.clientY);
        break;
      }

      case 'pointerup':
      case 'pointercancel':
      case 'pointerleave':
        this.pointerPressed = false;
        this.release();
        break;

      case 'keydown': {
        const keyEvent = event as KeyboardEvent;
        if (keyEvent.key !== 'Enter' && keyEvent.key !== ' ') {
          return;
        }

        if (this.keyboardActive || keyEvent.repeat) {
          return;
        }
        keyEvent.preventDefault();
        this.keyboardActive = true;
        this.press();
        break;
      }

      case 'keyup': {
        const keyEvent = event as KeyboardEvent;
        if (keyEvent.key !== 'Enter' && keyEvent.key !== ' ') {
          return;
        }
        keyEvent.preventDefault();
        this.keyboardActive = false;
        this.release();
        break;
      }

      case 'blur':
        this.keyboardActive = false;
        this.release();
        break;
    }
  }

  press (clientX?: number, clientY?: number): void {
    this.classList.add('pressed');

    if (clientX != null && clientY != null) {
      this.pressAt(clientX, clientY, 1);
    } else {
      this.centerPulse(0.9);
    }
  }

  releaseMirror (): void {
    if (this.mirrorPressed) {
      this.mirrorPressed = false;
      this.release();
    }
  }

  // Rises only once no press source still holds it
  release (): void {
    if (this.pointerPressed || this.keyboardActive || this.mirrorPressed || !this.classList.contains('pressed')) {
      return;
    }

    this.classList.remove('pressed');
    this.releaseBody();
  }

  // A detached cap never hears its pending pointerup or keyup
  override disconnectedCallback (): void {
    this.pointerPressed = false;
    this.keyboardActive = false;
    this.disarmKeyMirror();
    this.release();

    super.disconnectedCallback();
  }

}

export function defineKbd (options: DefineOptions = {}): DefineResult {
  return defineStrict([[TAGS.kbd, DropletKbd]], options);
}

declare global {
  interface HTMLElementTagNameMap {
    'droplet-kbd': DropletKbd;
  }
}
