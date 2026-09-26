import { expect, test } from 'vitest';

import { mount, settle } from '../testing/index.js';

import '../components/input/index.js';
import '../components/textarea/index.js';
import { defineButton }       from '../components/button/index.js';
import type { JellyButton }   from '../components/button/index.js';
import type { JellyInput }    from '../components/input/index.js';
import type { JellyTextarea } from '../components/textarea/index.js';
import { implicitlySubmit }   from './form-field.js';

defineButton({ strict: false });

// A foreign form-associated element that claims to be a submit button
class SubmitProbe extends HTMLElement {
  static formAssociated = true;

  get type (): string {
    return this.getAttribute('type') ?? 'button';
  }

  get disabled (): boolean {
    return this.hasAttribute('disabled');
  }
}

customElements.define('form-field-submit-probe', SubmitProbe);

const track = (form: HTMLFormElement): { submits: number } => {
  const counts = { submits: 0 };

  form.addEventListener('submit', (event) => { event.preventDefault(); counts.submits++; });

  return counts;
};

// Throws from every getter implicit submission could once have read
class ThrowingProbe extends HTMLElement {
  static formAssociated = true;

  get type (): string {
    throw new Error('foreign getter');
  }

  get disabled (): boolean {
    throw new Error('foreign getter');
  }
}

customElements.define('form-field-throwing-probe', ThrowingProbe);

test('a jelly-button of type submit is the default button, skipped for clicks while disabled', () => {
  const host = mount('<form><jelly-input></jelly-input><jelly-button type="submit">S</jelly-button></form>');
  const form = host.querySelector('form') as HTMLFormElement;
  const button = host.querySelector('jelly-button') as JellyButton;
  const counts = track(form);
  let clicks = 0;

  button.addEventListener('click', () => clicks++);
  implicitlySubmit(form);
  expect(clicks).toBe(1);
  expect(counts.submits).toBe(1);

  button.disabled = true;
  implicitlySubmit(form);
  expect(clicks).toBe(1);
  expect(counts.submits).toBe(1);

  host.remove();
});

test('a foreign form-associated element is never the default button, whatever its getters do', () => {
  const host = mount(`
    <form><form-field-submit-probe type="submit"></form-field-submit-probe><form-field-throwing-probe></form-field-throwing-probe>
    <jelly-input></jelly-input><jelly-button type="button">B</jelly-button></form>`);
  const form = host.querySelector('form') as HTMLFormElement;
  const probe = host.querySelector('form-field-submit-probe') as SubmitProbe;
  const counts = track(form);
  let clicks = 0;

  probe.addEventListener('click', () => clicks++);
  expect(probe.type).toBe('submit');

  implicitlySubmit(form);
  expect(clicks).toBe(0);
  expect(counts.submits).toBe(1);

  host.remove();
});

test('textareas and non-text inputs never block implicit submission', () => {
  const host = mount('<form><jelly-input></jelly-input><jelly-textarea></jelly-textarea><input type="checkbox"><textarea></textarea></form>');
  const form = host.querySelector('form') as HTMLFormElement;
  const counts = track(form);

  implicitlySubmit(form);
  expect(counts.submits).toBe(1);

  host.remove();
});

test('two blocking fields, jelly or native, stop implicit submission', () => {
  const host = mount('<form><jelly-input type="email"></jelly-input><input type="number"></form>');
  const form = host.querySelector('form') as HTMLFormElement;
  const counts = track(form);

  implicitlySubmit(form);
  expect(counts.submits).toBe(0);

  host.remove();
});

const control = (el: JellyInput | JellyTextarea): HTMLInputElement | HTMLTextAreaElement => el.control!;

test('a file-type field ignores a markup default and throws on a scripted filename, as native does', () => {
  const host = mount('<form><jelly-input type="file" value="x"></jelly-input></form>');
  const form = host.querySelector('form') as HTMLFormElement;
  const el = host.querySelector('jelly-input') as JellyInput;

  expect(control(el).type).toBe('file');
  expect(el.value).toBe('');

  el.setAttribute('value', 'y');
  expect(() => { el.value = 'z'; }).toThrow(expect.objectContaining({ name: 'InvalidStateError' }));
  form.reset();
  el.value = '';
  expect(el.value).toBe('');

  // Leaving the file type restores the default (HTML type-change steps)
  el.type = 'text';
  expect(el.value).toBe('y');

  el.value = 'typed';
  el.type = 'file';
  expect(el.value).toBe('');

  el.type = 'text';
  expect(el.value).toBe('y');

  host.remove();
});

// A File list assigned through DataTransfer, where the engine lets script set input.files
function assignFiles (input: HTMLInputElement, files: File[]): boolean {
  try {
    const transfer = new DataTransfer();

    for (const file of files) {
      transfer.items.add(file);
    }

    input.files = transfer.files;
  } catch {
    return false;
  }

  return input.files?.length === files.length;
}

test('a file-type field submits its selected files under its name, and nothing when empty or unnamed', () => {
  const host = mount('<form><jelly-input type="file" name="upload"></jelly-input></form>');
  const form = host.querySelector('form') as HTMLFormElement;
  const el = host.querySelector('jelly-input') as JellyInput;
  const input = control(el) as HTMLInputElement;
  const files = [new File(['a'], 'a.txt', { type: 'text/plain' }), new File(['bb'], 'b.txt', { type: 'text/plain' })];

  expect(new FormData(form).getAll('upload')).toEqual([]);

  if (!assignFiles(input, files)) {
    host.remove();
    return;
  }

  input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));

  const sent = new FormData(form).getAll('upload') as File[];

  expect(sent.map((file) => file.name)).toEqual(['a.txt', 'b.txt']);
  expect(sent.every((file) => file instanceof File)).toBe(true);

  el.name = 'renamed';
  expect(new FormData(form).getAll('upload')).toEqual([]);
  expect((new FormData(form).getAll('renamed') as File[]).map((file) => file.name)).toEqual(['a.txt', 'b.txt']);

  el.removeAttribute('name');
  expect([...new FormData(form).keys()]).toEqual([]);

  // A reset empties the selection, as natively
  el.name = 'upload';
  form.reset();
  expect(input.files?.length ?? 0).toBe(0);
  expect([...new FormData(form).keys()]).toEqual([]);

  // A string state can never reach the file-type value setter
  expect(() => el.formStateRestoreCallback('C:\\fakepath\\a.txt')).not.toThrow();
  el.formStateRestoreCallback(new FormData());

  host.remove();
});

test('unsupported input types run the inner control as text and leave the attribute as authored', () => {
  const types = ['checkbox', 'radio', 'submit', 'reset', 'button', 'image', 'hidden', 'range', 'color', 'bogus'];
  const host = mount(`<form>${types.map((type) => `<jelly-input type="${type}" name="${type}" value="v-${type}"></jelly-input>`).join('')}</form>`);
  const form = host.querySelector('form') as HTMLFormElement;
  const data = new FormData(form);

  for (const el of Array.from(host.querySelectorAll('jelly-input')) as JellyInput[]) {
    const authored = el.getAttribute('type')!;

    expect(control(el).type, authored).toBe('text');
    expect(el.type, authored).toBe('text');
    expect(data.get(authored), authored).toBe(`v-${authored}`);
  }

  const late = host.querySelector('jelly-input') as JellyInput;

  late.type = 'EMAIL';
  expect(control(late).type).toBe('email');
  expect(late.getAttribute('type')).toBe('EMAIL');

  late.type = 'color';
  expect(control(late).type).toBe('text');
  expect(late.getAttribute('type')).toBe('color');

  const detached = document.createElement('jelly-input') as JellyInput;

  detached.setAttribute('type', 'range');
  expect(detached.type).toBe('text');

  host.remove();
});

// Gecko runs the attribute reaction of an ARIA element set from a microtask, not before the setter returns
const reactions = (): Promise<void> => Promise.resolve();

test('explicitly set host ARIA elements forward onto the inner control', async () => {
  const host = mount('<p>Hint</p><p>Other</p><jelly-input></jelly-input>');
  const el = host.querySelector('jelly-input') as JellyInput & { ariaDescribedByElements: Element[] | null };
  const input = control(el) as HTMLInputElement & { ariaDescribedByElements?: Element[] | null };
  const [hint, other] = Array.from(host.querySelectorAll('p'));

  if (!('ariaDescribedByElements' in input)) {
    host.remove();
    return;
  }

  el.ariaDescribedByElements = [hint!];
  await reactions();
  expect(input.ariaDescribedByElements).toEqual([hint]);

  el.ariaDescribedByElements = [other!];
  await reactions();
  expect(input.ariaDescribedByElements).toEqual([other]);

  // A later IDREF attribute replaces the explicit elements
  other!.id = 'ff-explicit-other';
  hint!.id  = 'ff-explicit-hint';
  el.setAttribute('aria-describedby', 'ff-explicit-hint');
  expect(input.ariaDescribedByElements).toEqual([hint]);

  host.remove();
});

test('aria-invalid tokens are case-insensitive: false, empty, and absent paint valid', () => {
  const host = mount('<jelly-input></jelly-input>');
  const el = host.querySelector('jelly-input') as JellyInput;
  const cases: Array<[string, boolean]> = [
    ['False', false], ['FALSE', false], [' false ', false], ['', false],
    ['true', true], ['TRUE', true], ['grammar', true], ['Spelling', true], ['mixed', true],
  ];

  for (const [value, invalid] of cases) {
    el.setAttribute('aria-invalid', value);
    expect(el.paintsInvalid, value).toBe(invalid);
  }

  el.removeAttribute('aria-invalid');
  expect(el.paintsInvalid).toBe(false);

  host.remove();
});

// Hide ARIA element reflection so the text fallback path runs in every engine
function withoutLabelReflection (run: () => void): void {
  let owner: object | null = HTMLInputElement.prototype;

  while (owner && !Object.hasOwn(owner, 'ariaLabelledByElements')) {
    owner = Object.getPrototypeOf(owner) as object | null;
  }

  const descriptor = owner ? Object.getOwnPropertyDescriptor(owner, 'ariaLabelledByElements') : undefined;

  if (owner) {
    delete (owner as Record<string, unknown>).ariaLabelledByElements;
  }

  try {
    run();
  } finally {
    if (owner && descriptor) {
      Object.defineProperty(owner, 'ariaLabelledByElements', descriptor);
    }
  }
}

test('without element reflection the label text fallback clears once its label is gone', () => {
  withoutLabelReflection(() => {
    const host = mount(`
      <label for="ff-fallback">Caption</label><jelly-input id="ff-fallback"></jelly-input>
      <label for="ff-own">Other</label><jelly-input id="ff-own" aria-label="Own"></jelly-input>`);
    const [fallback, own] = Array.from(host.querySelectorAll('jelly-input')) as JellyInput[];
    const focusin = (el: JellyInput): boolean => control(el).dispatchEvent(new FocusEvent('focusin', { bubbles: true, composed: true }));

    expect(control(fallback!).getAttribute('aria-label')).toBe('Caption');
    expect(control(own!).getAttribute('aria-label')).toBe('Own');

    for (const label of Array.from(host.querySelectorAll('label'))) {
      label.remove();
    }

    focusin(fallback!);
    focusin(own!);
    expect(control(fallback!).hasAttribute('aria-label')).toBe(false);
    expect(control(own!).getAttribute('aria-label')).toBe('Own');

    host.remove();
  });
});

test('an IDREF target inserted after connect links when the field takes focus', async () => {
  const host = mount('<jelly-input aria-describedby="ff-late"></jelly-input>');
  const el = host.querySelector('jelly-input') as JellyInput;
  const input = control(el) as HTMLInputElement & { ariaDescribedByElements?: Element[] | null };

  if (!('ariaDescribedByElements' in input)) {
    host.remove();
    return;
  }

  const late = document.createElement('p');
  late.id = 'ff-late';
  host.append(late);

  el.focus();
  await settle(1);
  expect(input.ariaDescribedByElements).toEqual([late]);

  host.remove();
});

test('reassigning a shared reflected property to its current value writes no attribute', () => {
  const host = mount('<jelly-input></jelly-input><jelly-textarea></jelly-textarea>');
  const writes: Array<[string, unknown]> = [
    ['maxLength', 5], ['minLength', 2], ['name', 'n'], ['placeholder', 'p'], ['autocomplete', 'off'],
    ['defaultValue', 'd'], ['disabled', true], ['required', true], ['readOnly', true],
  ];

  for (const el of Array.from(host.children)) {
    const observer = new MutationObserver(() => {});

    observer.observe(el, { attributes: true });

    for (const [prop, value] of writes) {
      (el as unknown as Record<string, unknown>)[prop] = value;
      observer.takeRecords();

      (el as unknown as Record<string, unknown>)[prop] = value;
      expect(observer.takeRecords(), `${el.localName}.${prop}`).toEqual([]);
    }

    observer.disconnect();
  }

  host.remove();
});
