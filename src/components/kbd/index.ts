/*
 * A jelly keyboard key. Poke it with the pointer, or give it `key="k"`
 * and it depresses and squishes for real whenever that key is held
 * anywhere on the page
 */

import { JellyElement } from '../../element/index.js';
import type { Shape }   from '../../element/index.js';

import kbdStyles         from './kbd.css?inline';

// Input types that take no text, so a keystroke there is not typing
const NON_TEXT_INPUTS = new Set(['button', 'checkbox', 'color', 'file', 'image', 'radio', 'range', 'reset', 'submit']);

// composedPath()[0] reaches past shadow retargeting to the field inside jelly-input and friends
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

// A key="…" value may lead with modifiers, as in key="Meta+k"; a Map so "constructor+k" is not a modifier
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

// Ctrl, Alt, and Meta must be held exactly as the chord names them; Shift is only checked when named,
// since it is how many characters get typed. AltGr reports Ctrl+Alt on Windows yet only types a character.
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

// The closest data-droplet-shortcuts ancestor decides, crossing shadow roots the way the cascade inherits
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
 * @element jelly-kbd
 *
 * @slot - The key label (a letter, symbol or icon).
 *
 * @attr {string} key - A `KeyboardEvent.key` value to mirror document-wide, optionally led by modifiers (`Meta+k`, `Control+Shift+p`). Skipped while typing in a field, with Ctrl, Alt, or Meta held that the value does not name, or inside a `data-droplet-shortcuts="off"` scope (WCAG 2.1.4).
 * @attr {boolean} decorative - A display-only hint: no role and no tab stop, so it can sit inside a button whose accessible name still includes the key text.
 * @attr {"small"|"medium"|"large"} size - Keycap size.
 *
 * @csspart cap - The keycap surface.
 */
export class JellyKbd extends JellyElement implements EventListenerObject {

  onDocumentKeyDown: ((event: KeyboardEvent) => void) | null = null;
  onDocumentKeyUp: ((event: KeyboardEvent) => void) | null = null;

  // Each press source releases on its own; the cap rises once none is left holding it
  pointerPressed = false;
  mirrorPressed = false;

  // Tells the browser to trigger attributeChangedCallback when these attributes change
  static get observedAttributes (): string[] {
    return ['key', 'decorative'];
  }

  // Reflects the decorative attribute
  get decorative (): boolean {
    return this.hasAttribute('decorative');
  }

  set decorative (value: boolean) {
    this.toggleAttribute('decorative', Boolean(value));
  }

  // Component styles layered over the shared jelly base styles
  override styles (): string {
    return kbdStyles;
  }

  // The interactive markup that sits above the canvas
  override content (): string {
    return `<span class="cap" part="cap"><slot></slot></span>`;
  }

  // The keycap the physics body takes, with gently squared corners
  override shape (width: number, height: number): Shape {
    return {
      width:  width - 2,
      height: height - 2,
      radius: Math.min(10, (height - 2) * 0.34),
    };
  }

  // Called once after the shadow DOM and canvas exist. Wire events here.
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

  // Lifecycle method: Fires when observed HTML attributes change dynamically
  attributeChangedCallback (name: string): void {
    if (!this.built) {
      return;
    }

    if (name === 'decorative') {
      this.syncDecorative();
    } else {
      this.armKeyMirror();
    }
  }

  // A standalone cap is its own pressable control; a decorative one only labels its container
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

  // Lifecycle method: Called automatically when the element is appended to the
  // DOM. Re-arm the document-wide key mirror - disconnectedCallback dropped it,
  // and a kbd that is detached and re-appended should keep mirroring its key.
  override connectedCallback (): void {
    super.connectedCallback();

    if (this.built) {
      this.armKeyMirror();
    }
  }

  /*
   * With key="…" the cap mirrors that physical key document-wide. Idempotent:
   * the old listener pair is always dropped first, so connect / re-connect /
   * key changes never stack listeners.
   */
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

    // Never gated, so a cap pressed before focus moved into a field still comes back up. A chord also
    // releases with its modifier: macOS drops the keyup of a key released while Meta is held.
    this.onDocumentKeyUp = (event) => {
      if (matches(event) || [...chord.modifiers].some((flag) => MODIFIER_KEYS[flag] === event.key)) {
        this.releaseMirror();
      }
    };

    document.addEventListener('keydown', this.onDocumentKeyDown);
    document.addEventListener('keyup', this.onDocumentKeyUp);
  }

  // Drop the document-wide key mirror listeners, if any are wired. A held key's
  // keyup would never arrive once they are gone, so its press is released first.
  disarmKeyMirror (): void {
    this.releaseMirror();

    if (this.onDocumentKeyDown && this.onDocumentKeyUp) {
      document.removeEventListener('keydown', this.onDocumentKeyDown);
      document.removeEventListener('keyup', this.onDocumentKeyUp);
      this.onDocumentKeyDown = null;
      this.onDocumentKeyUp = null;
    }
  }

  // Handle callback events
  handleEvent (event: Event): void {
    switch (event.type) {
      case 'pointerdown': {
        const pointer = event as PointerEvent;
        try {
          this.setPointerCapture(pointer.pointerId);
        } catch {
          // Capture can fail if the pointer is already gone; the press still works
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

  // Depress the cap: bulge from the pointer, or squish from the center
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

  // Let the cap travel back up and the jelly settle, unless another source still holds it
  release (): void {
    if (this.pointerPressed || this.keyboardActive || this.mirrorPressed || !this.classList.contains('pressed')) {
      return;
    }

    this.classList.remove('pressed');
    this.releaseBody();
  }

  // A detached cap never hears its pending pointerup or keyup, so every source lets go here
  override disconnectedCallback (): void {
    this.pointerPressed = false;
    this.keyboardActive = false;
    this.disarmKeyMirror();
    this.release();

    super.disconnectedCallback();
  }

}

// Register the custom element
customElements.define('jelly-kbd', JellyKbd);

declare global {
  interface HTMLElementTagNameMap {
    'jelly-kbd': JellyKbd;
  }
}
