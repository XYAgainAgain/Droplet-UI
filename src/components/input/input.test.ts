import { expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';

import { mount, settle } from '../../testing/index.js';

import './index.js';
import { JellyInput } from './index.js';

const inner = (el: JellyInput): HTMLInputElement => el.shadowRoot!.querySelector('input') as HTMLInputElement;

type Reflected = { ariaDescribedByElements?: Element[] | null; ariaLabelledByElements?: Element[] | null };

test('upgrades with a native input carrying value/type/placeholder', async () => {
  const host = mount('<jelly-input value="hi" type="email" placeholder="you@x.com"></jelly-input>');
  const el = host.querySelector('jelly-input') as JellyInput;

  await settle(3);
  const input = el.shadowRoot!.querySelector('input') as HTMLInputElement;
  expect(input.value).toBe('hi');
  expect(input.type).toBe('email');
  expect(input.placeholder).toBe('you@x.com');

  host.remove();
});

test('the value property round-trips through the inner input', async () => {
  const host = mount('<jelly-input></jelly-input>');
  const el = host.querySelector('jelly-input') as JellyInput;

  await settle(3);
  el.value = 'typed';
  expect((el.shadowRoot!.querySelector('input') as HTMLInputElement).value).toBe('typed');
  expect(el.value).toBe('typed');

  host.remove();
});

test('participates in a form under its name', async () => {
  const host = mount('<form><jelly-input name="q" value="typed"></jelly-input></form>');
  await settle(3);

  const data = new FormData(host.querySelector('form') as HTMLFormElement);
  expect(data.get('q')).toBe('typed');

  host.remove();
});

test('no-autofill opts the inner input out of autocomplete', async () => {
  const host = mount('<jelly-input no-autofill></jelly-input>');
  const el = host.querySelector('jelly-input') as JellyInput;

  await settle(3);
  const input = el.shadowRoot!.querySelector('input') as HTMLInputElement;
  expect(input.autocomplete).toBe('off');
  expect(input.hasAttribute('data-1p-ignore')).toBe(true);

  host.remove();
});

test('IDL properties reflect their attributes with native semantics', () => {
  const host = mount('<form><jelly-input></jelly-input></form>');
  const el = host.querySelector('jelly-input') as JellyInput;

  expect(el.name).toBe('');
  expect(el.minLength).toBe(-1);
  expect(el.maxLength).toBe(-1);
  expect(el.type).toBe('text');

  el.name = 'email';
  el.disabled = true;
  el.required = true;
  el.readOnly = true;
  el.placeholder = 'you@x.com';
  el.type = 'email';
  el.minLength = 2;
  el.maxLength = 10;
  el.pattern = '[a-z@.]+';
  el.min = '1';
  el.max = '9';
  el.step = '2';
  el.autocomplete = 'email';
  el.defaultValue = 'a@b.c';

  expect(el.getAttribute('name')).toBe('email');
  expect(el.hasAttribute('disabled')).toBe(true);
  expect(el.hasAttribute('required')).toBe(true);
  expect(el.hasAttribute('readonly')).toBe(true);
  expect(el.getAttribute('placeholder')).toBe('you@x.com');
  expect(el.getAttribute('type')).toBe('email');
  expect(el.getAttribute('minlength')).toBe('2');
  expect(el.getAttribute('maxlength')).toBe('10');
  expect(el.getAttribute('pattern')).toBe('[a-z@.]+');
  expect(el.getAttribute('min')).toBe('1');
  expect(el.getAttribute('max')).toBe('9');
  expect(el.getAttribute('step')).toBe('2');
  expect(el.getAttribute('autocomplete')).toBe('email');
  expect(el.getAttribute('value')).toBe('a@b.c');
  expect(el.value).toBe('a@b.c');

  el.disabled = false;
  el.readOnly = false;
  expect(el.hasAttribute('disabled')).toBe(false);
  expect(el.hasAttribute('readonly')).toBe(false);

  expect(() => { el.maxLength = -1; }).toThrow();
  expect(el.form).toBe(host.querySelector('form'));
  expect(el.labels.length).toBe(0);

  host.remove();
});

test('constraint and hint attributes reach the inner input, maxlength included', () => {
  const host = mount('<jelly-input required minlength="2" maxlength="5" pattern="\\d+" min="1" max="9" step="2" inputmode="numeric" enterkeyhint="send"></jelly-input>');
  const el = host.querySelector('jelly-input') as JellyInput;
  const input = inner(el);

  expect(input.required).toBe(true);
  expect(input.minLength).toBe(2);
  expect(input.maxLength).toBe(5);
  expect(input.pattern).toBe('\\d+');
  expect(input.min).toBe('1');
  expect(input.max).toBe('9');
  expect(input.step).toBe('2');
  expect(input.getAttribute('inputmode')).toBe('numeric');
  expect(input.getAttribute('enterkeyhint')).toBe('send');

  el.removeAttribute('maxlength');
  el.setAttribute('minlength', '3');
  expect(input.hasAttribute('maxlength')).toBe(false);
  expect(input.minLength).toBe(3);

  host.remove();
});

test('validity mirrors the inner input, so form.checkValidity() and :invalid work on the host', () => {
  const host = mount('<form><jelly-input name="email" type="email" required></jelly-input></form>');
  const form = host.querySelector('form') as HTMLFormElement;
  const el = host.querySelector('jelly-input') as JellyInput;

  expect(el.willValidate).toBe(true);
  expect(el.validity.valueMissing).toBe(true);
  expect(el.validationMessage).not.toBe('');
  expect(el.matches(':invalid')).toBe(true);
  expect(el.checkValidity()).toBe(false);
  expect(form.checkValidity()).toBe(false);

  el.value = 'not an email';
  expect(el.validity.valueMissing).toBe(false);
  expect(el.validity.typeMismatch).toBe(true);

  el.value = 'a@b.co';
  expect(el.validity.valid).toBe(true);
  expect(el.matches(':valid')).toBe(true);
  expect(form.checkValidity()).toBe(true);

  el.setCustomValidity('Taken');
  expect(el.validity.customError).toBe(true);
  expect(el.validationMessage).toBe('Taken');
  expect(form.checkValidity()).toBe(false);

  el.setCustomValidity('');
  expect(el.validity.valid).toBe(true);

  el.setAttribute('pattern', '[0-9]+');
  expect(el.validity.patternMismatch).toBe(true);

  // A read-only field is barred from constraint validation, as natively
  el.readOnly = true;
  expect(el.willValidate).toBe(false);

  host.remove();
});

test('the value attribute is the default until the value is dirty', () => {
  const host = mount('<jelly-input value="a"></jelly-input>');
  const el = host.querySelector('jelly-input') as JellyInput;

  el.setAttribute('value', 'b');
  expect(el.value).toBe('b');

  el.value = 'live';
  el.setAttribute('value', 'c');
  expect(el.value).toBe('live');
  expect(el.defaultValue).toBe('c');

  host.remove();
});

test('typing marks the value dirty too', async () => {
  const host = mount('<jelly-input value="a"></jelly-input>');
  const el = host.querySelector('jelly-input') as JellyInput;

  el.focus();
  await userEvent.keyboard('b');
  el.setAttribute('value', 'z');
  expect(el.value).toBe('ab');

  host.remove();
});

test('a value set before build survives to the inner input and the form', () => {
  const form = document.createElement('form');
  const el = document.createElement('jelly-input');

  el.name = 'q';
  el.value = 'early';
  expect(el.value).toBe('early');

  form.appendChild(el);
  document.body.appendChild(form);

  expect(inner(el).value).toBe('early');
  expect(new FormData(form).get('q')).toBe('early');

  form.remove();
});

test('a value assigned before upgrade is replayed through the setter', () => {
  const tag = 'jelly-input-replay-probe';
  const el = document.createElement(tag) as HTMLElement & { value: string };

  el.value = 'captured';
  document.body.appendChild(el);
  customElements.define(tag, class extends JellyInput {});

  expect(el).toBeInstanceOf(JellyInput);
  expect(inner(el as unknown as JellyInput).value).toBe('captured');

  el.remove();
});

test('form.reset() restores the default and clears the dirty flag', () => {
  const host = mount('<form><jelly-input name="q" value="start"></jelly-input></form>');
  const form = host.querySelector('form') as HTMLFormElement;
  const el = host.querySelector('jelly-input') as JellyInput;

  el.value = 'changed';
  form.reset();
  expect(el.value).toBe('start');
  expect(new FormData(form).get('q')).toBe('start');

  el.setAttribute('value', 'next');
  expect(el.value).toBe('next');

  host.remove();
});

test('a disabled fieldset disables the inner input without touching the host attribute', () => {
  const host = mount('<form><fieldset><jelly-input name="q" value="x"></jelly-input></fieldset></form>');
  const form = host.querySelector('form') as HTMLFormElement;
  const fieldset = host.querySelector('fieldset') as HTMLFieldSetElement;
  const el = host.querySelector('jelly-input') as JellyInput;

  fieldset.disabled = true;
  expect(inner(el).disabled).toBe(true);
  expect(el.hasAttribute('disabled')).toBe(false);
  expect(el.fieldDisabled).toBe(true);
  expect(el.matches(':disabled')).toBe(true);
  expect(getComputedStyle(el).pointerEvents).toBe('none');
  expect(new FormData(form).has('q')).toBe(false);

  fieldset.disabled = false;
  expect(inner(el).disabled).toBe(false);
  expect(el.fieldDisabled).toBe(false);

  host.remove();
});

test('formStateRestoreCallback restores the value silently', () => {
  const host = mount('<form><jelly-input name="q"></jelly-input></form>');
  const el = host.querySelector('jelly-input') as JellyInput;
  let events = 0;

  el.addEventListener('input', () => events++);
  el.addEventListener('change', () => events++);
  el.formStateRestoreCallback('restored');

  expect(el.value).toBe('restored');
  expect(new FormData(host.querySelector('form') as HTMLFormElement).get('q')).toBe('restored');
  expect(events).toBe(0);

  host.remove();
});

test(':state(user-invalid) follows a committed edit and a failed submit, and paints the danger border', async () => {
  const host = mount('<form><jelly-input minlength="3"></jelly-input><jelly-input required></jelly-input></form>');
  const form = host.querySelector('form') as HTMLFormElement;
  const [short, empty] = Array.from(host.querySelectorAll('jelly-input')) as JellyInput[];
  const neutral = short!.surfaceBorder().color;

  short!.focus();
  await userEvent.keyboard('ab');
  expect(short!.validity.tooShort).toBe(true);
  expect(short!.matches(':state(user-invalid)')).toBe(false);

  inner(short!).blur();
  expect(short!.matches(':state(user-invalid)')).toBe(true);

  const danger = short!.resolveColor('var(--jelly-color-background-rose)');
  expect(short!.surfaceBorder().color).toBe(danger);
  expect(danger).not.toBe(neutral);

  expect(empty!.matches(':state(user-invalid)')).toBe(false);
  form.addEventListener('submit', (event) => event.preventDefault());
  form.requestSubmit();
  expect(empty!.matches(':state(user-invalid)')).toBe(true);

  // The failed submit focused the first invalid field; blur it to compare at rest
  form.reset();
  inner(short!).blur();
  expect(short!.matches(':state(user-invalid)')).toBe(false);
  expect(empty!.matches(':state(user-invalid)')).toBe(false);
  expect(short!.surfaceBorder().color).toBe(neutral);

  host.remove();
});

test('aria-invalid="true" paints the danger border too', () => {
  const host = mount('<jelly-input aria-invalid="true"></jelly-input>');
  const el = host.querySelector('jelly-input') as JellyInput;

  expect(el.surfaceBorder().color).toBe(el.resolveColor('var(--jelly-color-background-rose)'));
  expect(inner(el).getAttribute('aria-invalid')).toBe('true');

  el.setAttribute('aria-invalid', 'false');
  expect(el.surfaceBorder().color).not.toBe(el.resolveColor('var(--jelly-color-background-rose)'));

  host.remove();
});

test('host ARIA reaches the inner input; IDREFs cross as element references', () => {
  const host = mount('<p id="hint">Work address</p><jelly-input aria-describedby="hint" aria-busy="true" aria-label="Email"></jelly-input>');
  const el = host.querySelector('jelly-input') as JellyInput;
  const input = inner(el);

  expect(input.getAttribute('aria-busy')).toBe('true');
  expect(input.getAttribute('aria-label')).toBe('Email');

  if ('ariaDescribedByElements' in input) {
    expect((input as Reflected).ariaDescribedByElements).toEqual([host.querySelector('#hint')]);
  }

  // The label attribute keeps precedence over aria-label
  el.setAttribute('label', 'Work email');
  expect(input.getAttribute('aria-label')).toBe('Work email');

  el.removeAttribute('aria-busy');
  expect(input.hasAttribute('aria-busy')).toBe(false);

  host.remove();
});

test('a <label for> and a wrapping <label> are linked to the inner input', () => {
  const host = mount('<label for="f">Email</label><jelly-input id="f"></jelly-input><label>Phone <jelly-input></jelly-input></label>');
  const [forField, wrapped] = Array.from(host.querySelectorAll('jelly-input')) as JellyInput[];
  const [forLabel, wrapper] = Array.from(host.querySelectorAll('label'));

  expect(Array.from(forField!.labels)).toEqual([forLabel]);
  expect(Array.from(wrapped!.labels)).toEqual([wrapper]);

  const input = inner(forField!);

  if ('ariaLabelledByElements' in input) {
    expect((input as Reflected).ariaLabelledByElements).toEqual([forLabel]);
    expect((inner(wrapped!) as Reflected).ariaLabelledByElements).toEqual([wrapper]);

    // An authored label attribute wins over linking
    forField!.setAttribute('label', 'Override');
    expect((input as Reflected).ariaLabelledByElements ?? null).toBe(null);
  }

  host.remove();
});

test('clicking a <label for> focuses the inner input', async () => {
  const host = mount('<label for="g">Email</label><jelly-input id="g"></jelly-input>');
  const el = host.querySelector('jelly-input') as JellyInput;

  await settle(2);
  await userEvent.click(host.querySelector('label')!);

  expect(el.shadowRoot!.activeElement).toBe(inner(el));

  host.remove();
});

// Waits out the keydown dispatch the implicit submission defers to
const enterIn = async (el: JellyInput): Promise<void> => {
  el.focus();
  await userEvent.keyboard('{Enter}');
  await new Promise((resolve) => setTimeout(resolve, 20));
};

test('Enter submits a form with no submit button and one blocking field', async () => {
  const host = mount('<form><jelly-input name="q" value="x"></jelly-input><input type="checkbox"></form>');
  const form = host.querySelector('form') as HTMLFormElement;
  let submits = 0;

  form.addEventListener('submit', (event) => { event.preventDefault(); submits++; });
  await enterIn(host.querySelector('jelly-input') as JellyInput);

  expect(submits).toBe(1);

  host.remove();
});

test('Enter clicks the default button, and does nothing when it is disabled', async () => {
  const host = mount('<form><jelly-input name="q"></jelly-input><button type="submit">Go</button></form>');
  const form = host.querySelector('form') as HTMLFormElement;
  const button = host.querySelector('button') as HTMLButtonElement;
  const el = host.querySelector('jelly-input') as JellyInput;
  let clicks = 0;
  let submits = 0;

  button.addEventListener('click', () => clicks++);
  form.addEventListener('submit', (event) => { event.preventDefault(); submits++; });

  await enterIn(el);
  expect(clicks).toBe(1);
  expect(submits).toBe(1);

  button.disabled = true;
  await enterIn(el);
  expect(clicks).toBe(1);
  expect(submits).toBe(1);

  host.remove();
});

test('Enter does not submit with two blocking fields and no button, or when prevented', async () => {
  const host = mount('<form><jelly-input name="a"></jelly-input><input name="b"></form>');
  const form = host.querySelector('form') as HTMLFormElement;
  const el = host.querySelector('jelly-input') as JellyInput;
  let submits = 0;

  form.addEventListener('submit', (event) => { event.preventDefault(); submits++; });
  await enterIn(el);
  expect(submits).toBe(0);

  host.querySelector('input[name="b"]')!.remove();
  el.addEventListener('keydown', (event) => event.preventDefault(), { once: true });
  await enterIn(el);
  expect(submits).toBe(0);

  await enterIn(el);
  expect(submits).toBe(1);

  host.remove();
});

test('reassigning type, pattern, min, max, or step to its current value writes no attribute', () => {
  const host = mount('<jelly-input></jelly-input>');
  const el = host.querySelector('jelly-input') as JellyInput;
  const observer = new MutationObserver(() => {});
  const writes: Array<[string, string]> = [['type', 'number'], ['pattern', '\d+'], ['min', '1'], ['max', '9'], ['step', '2']];

  observer.observe(el, { attributes: true });

  for (const [prop, value] of writes) {
    (el as unknown as Record<string, string>)[prop] = value;
    observer.takeRecords();

    (el as unknown as Record<string, string>)[prop] = value;
    expect(observer.takeRecords(), prop).toEqual([]);
  }

  observer.disconnect();
  host.remove();
});
