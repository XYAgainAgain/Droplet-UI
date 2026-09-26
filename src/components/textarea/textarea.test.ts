import { expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';

import { mount, settle } from '../../testing/index.js';

import './index.js';
import type { JellyTextarea } from './index.js';

const inner = (el: JellyTextarea): HTMLTextAreaElement => el.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;

type Reflected = { ariaDescribedByElements?: Element[] | null; ariaLabelledByElements?: Element[] | null };

test('upgrades with a native textarea', async () => {
  const host = mount('<jelly-textarea value="hi" placeholder="Notes"></jelly-textarea>');
  const el = host.querySelector('jelly-textarea') as JellyTextarea;

  await settle(3);
  const ta = el.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
  expect(ta).toBeInstanceOf(HTMLTextAreaElement);
  expect(ta.value).toBe('hi');
  expect(ta.placeholder).toBe('Notes');

  host.remove();
});

test('the value property round-trips through the inner textarea', async () => {
  const host = mount('<jelly-textarea></jelly-textarea>');
  const el = host.querySelector('jelly-textarea') as JellyTextarea;

  await settle(3);
  el.value = 'line one\nline two';
  expect((el.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement).value).toBe('line one\nline two');
  expect(el.value).toBe('line one\nline two');

  host.remove();
});

test('participates in a form under its name', async () => {
  const host = mount('<form><jelly-textarea name="notes" value="body"></jelly-textarea></form>');
  await settle(3);

  const data = new FormData(host.querySelector('form') as HTMLFormElement);
  expect(data.get('notes')).toBe('body');

  host.remove();
});

test('IDL properties reflect their attributes with native semantics', () => {
  const host = mount('<form><jelly-textarea></jelly-textarea></form>');
  const el = host.querySelector('jelly-textarea') as JellyTextarea;

  expect(el.maxLength).toBe(-1);

  el.name = 'notes';
  el.required = true;
  el.readOnly = true;
  el.disabled = true;
  el.placeholder = 'Say hi';
  el.minLength = 1;
  el.maxLength = 200;
  el.autocomplete = 'off';
  el.defaultValue = 'draft';

  expect(el.getAttribute('name')).toBe('notes');
  expect(el.hasAttribute('required')).toBe(true);
  expect(el.hasAttribute('readonly')).toBe(true);
  expect(el.hasAttribute('disabled')).toBe(true);
  expect(el.getAttribute('placeholder')).toBe('Say hi');
  expect(el.getAttribute('minlength')).toBe('1');
  expect(el.getAttribute('maxlength')).toBe('200');
  expect(el.getAttribute('autocomplete')).toBe('off');
  expect(el.value).toBe('draft');
  expect(el.form).toBe(host.querySelector('form'));

  host.remove();
});

test('constraint and hint attributes reach the inner textarea, maxlength included', () => {
  const host = mount('<jelly-textarea required minlength="2" maxlength="140" inputmode="text" enterkeyhint="enter"></jelly-textarea>');
  const el = host.querySelector('jelly-textarea') as JellyTextarea;
  const ta = inner(el);

  expect(ta.required).toBe(true);
  expect(ta.minLength).toBe(2);
  expect(ta.maxLength).toBe(140);
  expect(ta.getAttribute('inputmode')).toBe('text');
  expect(ta.getAttribute('enterkeyhint')).toBe('enter');

  el.removeAttribute('maxlength');
  expect(ta.hasAttribute('maxlength')).toBe(false);

  host.remove();
});

test('validity mirrors the inner textarea, so form.checkValidity() works on the host', () => {
  const host = mount('<form><jelly-textarea name="notes" required></jelly-textarea></form>');
  const form = host.querySelector('form') as HTMLFormElement;
  const el = host.querySelector('jelly-textarea') as JellyTextarea;

  expect(el.validity.valueMissing).toBe(true);
  expect(el.matches(':invalid')).toBe(true);
  expect(form.checkValidity()).toBe(false);

  el.value = 'filled';
  expect(el.validity.valid).toBe(true);
  expect(form.checkValidity()).toBe(true);

  el.setCustomValidity('Too rude');
  expect(el.validationMessage).toBe('Too rude');
  expect(el.checkValidity()).toBe(false);

  el.setCustomValidity('');
  expect(el.checkValidity()).toBe(true);

  host.remove();
});

test('the value attribute is the default until the value is dirty', () => {
  const host = mount('<jelly-textarea value="a"></jelly-textarea>');
  const el = host.querySelector('jelly-textarea') as JellyTextarea;

  el.setAttribute('value', 'b');
  expect(el.value).toBe('b');

  el.value = 'live';
  el.setAttribute('value', 'c');
  expect(el.value).toBe('live');

  host.remove();
});

test('a value set before build survives to the inner textarea and the form', () => {
  const form = document.createElement('form');
  const el = document.createElement('jelly-textarea');

  el.name = 'notes';
  el.value = 'early';
  form.appendChild(el);
  document.body.appendChild(form);

  expect(inner(el).value).toBe('early');
  expect(new FormData(form).get('notes')).toBe('early');

  form.remove();
});

test('form.reset() restores the default; a disabled fieldset disables the inner textarea', () => {
  const host = mount('<form><fieldset><jelly-textarea name="notes" value="start"></jelly-textarea></fieldset></form>');
  const form = host.querySelector('form') as HTMLFormElement;
  const fieldset = host.querySelector('fieldset') as HTMLFieldSetElement;
  const el = host.querySelector('jelly-textarea') as JellyTextarea;

  el.value = 'changed';
  form.reset();
  expect(el.value).toBe('start');
  expect(new FormData(form).get('notes')).toBe('start');

  fieldset.disabled = true;
  expect(inner(el).disabled).toBe(true);
  expect(el.hasAttribute('disabled')).toBe(false);
  expect(new FormData(form).has('notes')).toBe(false);

  fieldset.disabled = false;
  expect(inner(el).disabled).toBe(false);

  host.remove();
});

test('formStateRestoreCallback restores the value', () => {
  const host = mount('<jelly-textarea></jelly-textarea>');
  const el = host.querySelector('jelly-textarea') as JellyTextarea;

  el.formStateRestoreCallback('back again');
  expect(el.value).toBe('back again');

  host.remove();
});

test(':state(user-invalid) follows a committed edit and paints the danger border', async () => {
  const host = mount('<form><jelly-textarea minlength="5"></jelly-textarea></form>');
  const form = host.querySelector('form') as HTMLFormElement;
  const el = host.querySelector('jelly-textarea') as JellyTextarea;

  el.focus();
  await userEvent.keyboard('abc');
  expect(el.matches(':state(user-invalid)')).toBe(false);

  inner(el).blur();
  expect(el.matches(':state(user-invalid)')).toBe(true);
  expect(el.surfaceBorder().color).toBe(el.resolveColor('var(--jelly-color-background-rose)'));

  form.reset();
  expect(el.matches(':state(user-invalid)')).toBe(false);

  host.remove();
});

test('host ARIA and labels reach the inner textarea', async () => {
  const host = mount('<p id="t-hint">Markdown works</p><label for="t">Notes</label><jelly-textarea id="t" aria-describedby="t-hint"></jelly-textarea>');
  const el = host.querySelector('jelly-textarea') as JellyTextarea;
  const ta = inner(el);

  if ('ariaDescribedByElements' in ta) {
    expect((ta as Reflected).ariaDescribedByElements).toEqual([host.querySelector('#t-hint')]);
    expect((ta as Reflected).ariaLabelledByElements).toEqual([host.querySelector('label')]);
  }

  await settle(2);
  await userEvent.click(host.querySelector('label')!);
  expect(el.shadowRoot!.activeElement).toBe(ta);

  host.remove();
});

test('Enter inserts a newline and never submits the form', async () => {
  const host = mount('<form><jelly-textarea name="notes"></jelly-textarea></form>');
  const form = host.querySelector('form') as HTMLFormElement;
  const el = host.querySelector('jelly-textarea') as JellyTextarea;
  let submits = 0;

  form.addEventListener('submit', (event) => { event.preventDefault(); submits++; });

  el.focus();
  await userEvent.keyboard('a{Enter}b');
  await new Promise((resolve) => setTimeout(resolve, 20));

  expect(submits).toBe(0);
  expect(el.value).toBe('a\nb');

  host.remove();
});
