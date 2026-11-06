import { describe, expect, test } from 'vitest';

import { mount, settle } from '../testing/index.js';
import '../testing/define-all.js';

type Checkable = HTMLElement & {
  checked: boolean;
  required: boolean;
  disabled: boolean;
  name: string;
  defaultChecked: boolean;
  form: HTMLFormElement | null;
  labels: NodeList;
  validity: ValidityState;
  willValidate: boolean;
  checkValidity (): boolean;
  setCustomValidity (message: string): void;
  formStateRestoreCallback (state: string | null): void;
};

const inner = (el: Element): HTMLElement => el.shadowRoot!.querySelector('input, [role="radio"]') as HTMLElement;

describe.each(['checkbox', 'switch'])('droplet-%s in a form', (kind) => {

  const tag = `droplet-${kind}`;

  test('submits by name, and required means checked', async () => {
    const host = mount(`<form><${tag} name="agree" value="yes" required>Agree</${tag}></form>`);
    const el   = host.querySelector(tag) as Checkable;
    const form = host.querySelector('form')!;

    await settle(3);

    expect(el.form).toBe(form);
    expect(el.required).toBe(true);
    expect(el.validity.valueMissing).toBe(true);
    expect(form.checkValidity()).toBe(false);

    el.checked = true;

    expect(el.checkValidity()).toBe(true);
    expect(new FormData(form).get('agree')).toBe('yes');

    host.remove();
  });

  test('returns to its markup state on form reset', async () => {
    const host = mount(`<form><${tag} name="a" checked></${tag}><${tag} name="b"></${tag}></form>`);
    const [a, b] = host.querySelectorAll(tag) as NodeListOf<Checkable>;

    await settle(3);

    a!.checked = false;
    b!.checked = true;
    host.querySelector('form')!.reset();

    expect(a!.checked).toBe(true);
    expect(b!.checked).toBe(false);
    expect(a!.defaultChecked).toBe(true);

    host.remove();
  });

  test('is disabled by an ancestor fieldset and leaves validation', async () => {
    const host = mount(`<form><fieldset disabled><${tag} name="x" required></${tag}></fieldset></form>`);
    const el   = host.querySelector(tag) as Checkable;

    await settle(3);

    expect(el.matches(':disabled')).toBe(true);
    expect((inner(el) as HTMLInputElement).disabled).toBe(true);
    expect(el.willValidate).toBe(false);

    host.querySelector('fieldset')!.disabled = false;
    await settle(2);

    expect((inner(el) as HTMLInputElement).disabled).toBe(false);
    expect(el.validity.valueMissing).toBe(true);

    host.remove();
  });

  test('toggles from a label naming it, and that label names its control', async () => {
    const host = mount(`<label for="c">Outer</label><${tag} id="c">Inner</${tag}>`);
    const el   = host.querySelector(tag) as Checkable;
    const label = host.querySelector('label')!;

    await settle(3);

    label.click();
    expect(el.checked).toBe(true);
    expect([...el.labels]).toEqual([label]);

    const control = inner(el) as HTMLElement & { ariaLabelledByElements?: readonly Element[] | null };

    if ('ariaLabelledByElements' in control) {
      expect(control.ariaLabelledByElements).toContain(label);
    }

    host.remove();
  });

  test('forwards host aria-* to the inner control and restores state', async () => {
    const host = mount(`<p id="hint">Hint</p><${tag} aria-describedby="hint" aria-invalid="true"></${tag}>`);
    const el   = host.querySelector(tag) as Checkable;

    await settle(3);

    const control = inner(el) as HTMLElement & { ariaDescribedByElements?: readonly Element[] | null };

    expect(control.getAttribute('aria-invalid')).toBe('true');

    if ('ariaDescribedByElements' in control) {
      expect(control.ariaDescribedByElements).toEqual([host.querySelector('#hint')]);
    }

    el.formStateRestoreCallback('on');
    expect(el.checked).toBe(true);

    el.setCustomValidity('Nope');
    expect(el.validity.customError).toBe(true);
    el.setCustomValidity('');
    expect(el.validity.valid).toBe(true);

    host.remove();
  });

});

describe('droplet-radio in a form', () => {

  test('makes the whole group required when one radio is', async () => {
    const host = mount('<form><droplet-radio name="g" value="a" required>A</droplet-radio><droplet-radio name="g" value="b">B</droplet-radio></form>');
    const [a, b] = host.querySelectorAll('droplet-radio') as NodeListOf<Checkable & { select (fromUser?: boolean): void }>;

    await settle(3);

    expect(a!.validity.valueMissing).toBe(true);
    expect(b!.validity.valueMissing).toBe(true);

    b!.select(true);

    expect(a!.validity.valid).toBe(true);
    expect(b!.validity.valid).toBe(true);
    expect(new FormData(host.querySelector('form')!).get('g')).toBe('b');

    host.remove();
  });

  test('resets to its markup selection and selects from a label', async () => {
    const host = mount('<form><droplet-radio name="g" value="a" checked>A</droplet-radio><droplet-radio id="rb" name="g" value="b">B</droplet-radio></form><label for="rb">Pick B</label>');
    const [a, b] = host.querySelectorAll('droplet-radio') as NodeListOf<Checkable>;

    await settle(3);

    host.querySelector('label')!.click();
    expect(b!.checked).toBe(true);
    expect(a!.checked).toBe(false);

    host.querySelector('form')!.reset();
    expect(a!.checked).toBe(true);
    expect(b!.checked).toBe(false);

    host.remove();
  });

  test('skips a fieldset-disabled radio in arrow navigation', async () => {
    const host = mount('<droplet-radio name="h" value="a" checked>A</droplet-radio><fieldset disabled><droplet-radio name="h" value="b">B</droplet-radio></fieldset><droplet-radio name="h" value="c">C</droplet-radio>');
    const [a, , c] = host.querySelectorAll('droplet-radio') as NodeListOf<Checkable>;

    await settle(3);

    inner(a!).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));

    expect(c!.checked).toBe(true);

    host.remove();
  });

});

describe('droplet-slider and droplet-range in a form', () => {

  test('reset returns to the authored values and a fieldset disables them', async () => {
    const host = mount('<form><fieldset><droplet-slider name="s" value="30"></droplet-slider><droplet-range name="r" low="20" high="60"></droplet-range></fieldset></form>');
    const slider = host.querySelector('droplet-slider') as unknown as Checkable & { value: string };
    const range  = host.querySelector('droplet-range') as unknown as Checkable & { value: string; val: number[]; syncValueState (): void };
    const form   = host.querySelector('form')!;

    await settle(6);

    slider.value = '80';
    range.val[0] = 40;
    range.syncValueState();

    expect(new FormData(form).get('s')).toBe('80');
    expect(new FormData(form).get('r')).toBe('40,60');

    form.reset();

    expect(slider.value).toBe('30');
    expect(range.value).toBe('20,60');

    host.querySelector('fieldset')!.disabled = true;
    await settle(2);

    expect(slider.matches(':disabled')).toBe(true);
    expect((slider.shadowRoot!.querySelector('input') as HTMLInputElement).disabled).toBe(true);
    expect((range.shadowRoot!.querySelector('[role="slider"]') as HTMLElement).tabIndex).toBe(-1);

    host.remove();
  });

  test('forwards a description to both range knobs and focuses from a label', async () => {
    const host = mount('<p id="d">Budget</p><label for="r">Price</label><droplet-range id="r" aria-describedby="d"></droplet-range>');
    const range = host.querySelector('droplet-range')!;

    await settle(6);

    const knobs = [...range.shadowRoot!.querySelectorAll('[role="slider"]')] as Array<HTMLElement & { ariaDescribedByElements?: readonly Element[] | null }>;

    if ('ariaDescribedByElements' in knobs[0]!) {
      expect(knobs.every((knob) => knob.ariaDescribedByElements?.[0] === host.querySelector('#d'))).toBe(true);
    }

    host.querySelector('label')!.click();
    expect(knobs.includes(range.shadowRoot!.activeElement as HTMLElement)).toBe(true);

    host.remove();
  });

});

describe('droplet-segmented in a form', () => {

  test('resets to its first selection, restores state, and gives its group the outer label', async () => {
    const host = mount('<form><label for="seg">Clock</label><droplet-segmented id="seg" name="clock" aria-describedby="hint"><droplet-segment value="day">Day</droplet-segment><droplet-segment value="real" selected>Real</droplet-segment></droplet-segmented><p id="hint">How time runs</p></form>');
    const seg  = host.querySelector('droplet-segmented') as unknown as Checkable & { value: string };
    const form = host.querySelector('form')!;

    await settle(6);

    expect(new FormData(form).get('clock')).toBe('real');

    seg.value = 'day';
    form.reset();
    expect(seg.value).toBe('real');

    seg.formStateRestoreCallback('day');
    expect(seg.value).toBe('day');

    const group = seg.shadowRoot!.querySelector('[role="radiogroup"]') as HTMLElement & { ariaLabelledByElements?: readonly Element[] | null; ariaDescribedByElements?: readonly Element[] | null };

    if ('ariaLabelledByElements' in group) {
      expect(group.ariaLabelledByElements).toContain(host.querySelector('label'));
      expect(group.ariaDescribedByElements?.[0]).toBe(host.querySelector('#hint'));
    }

    host.remove();
  });

  test('disables every segment inside a disabled fieldset', async () => {
    const host = mount('<fieldset disabled><droplet-segmented><droplet-segment value="a">A</droplet-segment><droplet-segment value="b">B</droplet-segment></droplet-segmented></fieldset>');

    await settle(6);

    const buttons = [...host.querySelector('droplet-segmented')!.shadowRoot!.querySelectorAll('button')];

    expect(buttons.every((button) => button.disabled)).toBe(true);

    host.querySelector('fieldset')!.disabled = false;
    await settle(2);
    expect([...host.querySelector('droplet-segmented')!.shadowRoot!.querySelectorAll('button')].some((button) => button.disabled)).toBe(false);

    host.remove();
  });

});

describe('droplet-select in a form', () => {

  test('requires a choice, resets to its markup selection, and focuses from a label', async () => {
    const host = mount('<form><label for="sel">Glyph</label><droplet-select id="sel" name="glyph" required><droplet-option value="s">Small</droplet-option><droplet-option value="m" selected>Medium</droplet-option></droplet-select></form>');
    const sel  = host.querySelector('droplet-select') as unknown as Checkable & { value: string; clearSelection (): void };
    const form = host.querySelector('form')!;

    await settle(6);

    expect(sel.validity.valid).toBe(true);
    expect(new FormData(form).get('glyph')).toBe('m');

    sel.clearSelection();
    expect(sel.validity.valueMissing).toBe(true);

    form.reset();
    expect(sel.value).toBe('m');
    expect(sel.validity.valid).toBe(true);

    host.querySelector('label')!.click();
    expect(sel.shadowRoot!.activeElement).toBe(sel.shadowRoot!.querySelector('.trigger'));

    host.remove();
  });

  test('closes and disables inside a disabled fieldset', async () => {
    const host = mount('<fieldset><droplet-select><droplet-option value="a">A</droplet-option></droplet-select></fieldset>');
    const sel  = host.querySelector('droplet-select') as HTMLElement & { openPanel (): void; isOpen: boolean };

    await settle(6);

    sel.openPanel();
    expect(sel.isOpen).toBe(true);

    host.querySelector('fieldset')!.disabled = true;
    await settle(2);

    expect(sel.isOpen).toBe(false);
    expect((sel.shadowRoot!.querySelector('.trigger') as HTMLButtonElement).disabled).toBe(true);

    host.remove();
  });

});

describe('droplet-otp in a form', () => {

  test('requires the whole code, clears on reset, and follows a disabled fieldset', async () => {
    const host = mount('<form><fieldset><label for="code">Code</label><droplet-otp id="code" name="code" length="4" required></droplet-otp></fieldset></form>');
    const otp  = host.querySelector('droplet-otp') as unknown as Checkable & { value: string };
    const form = host.querySelector('form')!;

    await settle(3);

    expect(otp.validity.valueMissing).toBe(true);

    otp.value = '12';
    expect(otp.validity.valueMissing).toBe(true);

    otp.value = '1234';
    expect(otp.checkValidity()).toBe(true);
    expect(new FormData(form).get('code')).toBe('1234');

    form.reset();
    expect(otp.value).toBe('');

    host.querySelector('label')!.click();
    expect(otp.shadowRoot!.activeElement).toBe(otp.shadowRoot!.querySelector('input'));

    host.querySelector('fieldset')!.disabled = true;
    await settle(2);
    expect([...otp.shadowRoot!.querySelectorAll('input')].every((box) => box.disabled)).toBe(true);
    expect(otp.willValidate).toBe(false);

    host.remove();
  });

});

describe('form review follow-ups', () => {

  test('a radio checked by property refreshes its whole group, and resets settle group-wide', async () => {
    const host = mount('<form><droplet-radio name="g" value="a" required>A</droplet-radio><droplet-radio name="g" value="b">B</droplet-radio></form>');
    const [a, b] = host.querySelectorAll('droplet-radio') as NodeListOf<Checkable>;

    await settle(3);

    b!.checked = true;
    expect(a!.validity.valid).toBe(true);

    host.querySelector('form')!.reset();
    expect(a!.validity.valueMissing).toBe(true);
    expect(b!.validity.valueMissing).toBe(true);

    host.remove();
  });

  test('radios with one name in two forms are two groups', async () => {
    const host = mount('<form id="f1"><droplet-radio name="c" value="x" required>X</droplet-radio></form><form id="f2"><droplet-radio name="c" value="y" checked>Y</droplet-radio></form>');
    const [x, y] = host.querySelectorAll('droplet-radio') as NodeListOf<Checkable & { select (fromUser?: boolean): void }>;

    await settle(3);

    expect(x!.validity.valueMissing).toBe(true);

    x!.select(true);
    expect(y!.checked).toBe(true);
    expect(x!.validity.valid).toBe(true);

    host.remove();
  });

  test('removing a forwarded aria-labelledby gives a radio its own label back', async () => {
    const host  = mount('<p id="ext">External</p><droplet-radio aria-labelledby="ext">Own</droplet-radio>');
    const radio = host.querySelector('droplet-radio')!;

    await settle(3);

    const control = radio.shadowRoot!.querySelector('[role="radio"]') as HTMLElement & { ariaLabelledByElements?: readonly Element[] | null };

    if (!('ariaLabelledByElements' in control)) {
      host.remove();
      return;
    }

    expect(control.ariaLabelledByElements?.[0]).toBe(host.querySelector('#ext'));

    radio.removeAttribute('aria-labelledby');
    await settle(1);

    expect(control.ariaLabelledByElements?.[0]).toBe(radio.shadowRoot!.querySelector('.label'));

    host.remove();
  });

  test('an outer label and a host aria-label name the code group', async () => {
    const host = mount('<label for="otp">Verification code</label><droplet-otp id="otp"></droplet-otp><droplet-otp aria-label="Backup code"></droplet-otp>');
    const [first, second] = host.querySelectorAll('droplet-otp');

    await settle(3);

    const row = (el: Element): HTMLElement & { ariaLabelledByElements?: readonly Element[] | null } => el.shadowRoot!.querySelector('.row') as HTMLElement;

    if ('ariaLabelledByElements' in row(first!)) {
      expect(row(first!).ariaLabelledByElements?.[0]).toBe(host.querySelector('label'));
    }

    expect(row(second!).getAttribute('aria-label')).toBe('Backup code');

    host.remove();
  });

  test('a select resets to an authored selected option that arrived late', async () => {
    const host = mount('<form><droplet-select name="s"><droplet-option value="a">A</droplet-option></droplet-select></form>');
    const sel  = host.querySelector('droplet-select') as unknown as Checkable & { value: string };

    await settle(3);

    const late = document.createElement('droplet-option');

    late.setAttribute('value', 'b');
    late.setAttribute('selected', '');
    late.textContent = 'B';
    (sel as unknown as HTMLElement).append(late);
    await settle(3);

    sel.value = 'a';
    host.querySelector('form')!.reset();

    expect(sel.value).toBe('b');

    host.remove();
  });

});

describe('verification follow-ups', () => {

  test('an explicit aria-labelledby on the OTP survives an outer label', async () => {
    const host = mount('<label for="code">Outer</label><p id="named">Named</p><droplet-otp id="code"></droplet-otp>');
    const otp  = host.querySelector('droplet-otp')!;

    await settle(3);

    const row = otp.shadowRoot!.querySelector('.row') as HTMLElement & { ariaLabelledByElements?: readonly Element[] | null };

    if (!('ariaLabelledByElements' in row)) {
      host.remove();
      return;
    }

    otp.setAttribute('aria-labelledby', 'named');
    await settle(1);

    expect(row.ariaLabelledByElements?.[0]).toBe(host.querySelector('#named'));

    host.remove();
  });

  test('a segmented control resets to an authored empty value', async () => {
    const host = mount('<form><droplet-segmented name="s" value=""><droplet-segment value="">None</droplet-segment><droplet-segment value="x" selected>X</droplet-segment></droplet-segmented></form>');
    const seg  = host.querySelector('droplet-segmented') as unknown as { value: string };

    await settle(6);

    expect(seg.value).toBe('');

    seg.value = 'x';
    host.querySelector('form')!.reset();

    expect(seg.value).toBe('');

    host.remove();
  });

});

describe('whole-run review', () => {

  test('a host aria-label names the OTP group over an outer label, and a label attribute relinks', async () => {
    const host = mount('<label>Outer <droplet-otp aria-label="Explicit"></droplet-otp></label><label for="code2">Second</label><droplet-otp id="code2"></droplet-otp>');
    const [named, linked] = host.querySelectorAll('droplet-otp');

    await settle(3);

    const row = (otp: Element): HTMLElement & { ariaLabelledByElements?: readonly Element[] | null } => otp.shadowRoot!.querySelector('.row') as HTMLElement;

    expect(row(named!).getAttribute('aria-label')).toBe('Explicit');

    if ('ariaLabelledByElements' in row(named!)) {
      expect(row(named!).ariaLabelledByElements ?? []).toHaveLength(0);
      expect(row(linked!).ariaLabelledByElements?.length).toBe(1);

      linked!.setAttribute('label', 'Code');
      expect(row(linked!).ariaLabelledByElements ?? []).toHaveLength(0);
      expect(row(linked!).getAttribute('aria-label')).toBe('Code');
    }

    host.remove();
  });

  test('a form reset restores the authored segment even after it was disabled', async () => {
    const host = mount('<form><droplet-segmented name="s"><droplet-segment value="a" selected>A</droplet-segment><droplet-segment value="b">B</droplet-segment></droplet-segmented></form>');
    const seg  = host.querySelector('droplet-segmented') as unknown as { value: string };

    await settle(6);

    seg.value = 'b';
    host.querySelector('droplet-segment')!.setAttribute('disabled', '');
    await settle(2);

    host.querySelector('form')!.reset();
    expect(seg.value).toBe('a');

    // The disabled choice can't take focus, so the first enabled segment holds the tab stop
    const buttons = [...host.querySelector('droplet-segmented')!.shadowRoot!.querySelectorAll('button')];

    expect(buttons.map((button) => button.tabIndex)).toEqual([-1, 0]);

    host.remove();
  });

  test('arrows move from the focused segment when the chosen one is disabled', async () => {
    const host = mount('<form><droplet-segmented name="s"><droplet-segment value="a" selected>A</droplet-segment><droplet-segment value="b">B</droplet-segment><droplet-segment value="c">C</droplet-segment></droplet-segmented></form>');
    const el   = host.querySelector('droplet-segmented')!;
    const seg  = el as unknown as { value: string };

    await settle(6);

    seg.value = 'b';
    host.querySelector('droplet-segment')!.setAttribute('disabled', '');
    await settle(2);
    host.querySelector('form')!.reset();

    const buttons = [...el.shadowRoot!.querySelectorAll('button')];

    buttons[1]!.focus();
    buttons[1]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true }));

    expect(seg.value).toBe('c');

    host.remove();
  });

  test('a radio group keeps one tab stop, and a reset that unchecks every radio hands it to the first', async () => {
    const host = mount('<form><droplet-radio name="g" value="1"></droplet-radio><droplet-radio name="g" value="2"></droplet-radio></form>');
    const [first, second] = host.querySelectorAll('droplet-radio') as unknown as [HTMLElement & { checked: boolean }, HTMLElement & { checked: boolean }];
    const control = (radio: HTMLElement): HTMLElement => radio.shadowRoot!.querySelector('[role="radio"]') as HTMLElement;

    await settle(4);

    second.checked = true;
    await settle(1);

    expect(control(first).tabIndex).toBe(-1);
    expect(control(second).tabIndex).toBe(0);

    host.querySelector('form')!.reset();
    await settle(1);

    expect(control(first).tabIndex).toBe(0);
    expect(control(second).tabIndex).toBe(-1);

    host.remove();
  });

  test('a select reset mirrors the first selection, an unmatched value and an empty-valued option included', async () => {
    const host = mount('<form><droplet-select id="m" value="missing"><droplet-option value="a" selected>A</droplet-option></droplet-select><droplet-select id="e"><droplet-option value="" selected>None</droplet-option><droplet-option value="b">B</droplet-option></droplet-select></form>');
    const missing = host.querySelector('#m') as unknown as { selectedIndex: number; value: string };
    const empty   = host.querySelector('#e') as unknown as { selectedIndex: number; value: string };

    await settle(4);

    expect(missing.selectedIndex).toBe(-1);
    expect(empty.selectedIndex).toBe(0);

    missing.value = 'a';
    empty.value   = 'b';
    host.querySelector('form')!.reset();

    expect(missing.selectedIndex).toBe(-1);
    expect(empty.selectedIndex).toBe(0);

    host.remove();
  });

  test('a range names its knobs after the host: outer label, aria-label, or label', async () => {
    const host = mount('<label for="price">Price</label><droplet-range id="price"></droplet-range><droplet-range aria-label="Cost"></droplet-range>');
    const [labelled, aria] = host.querySelectorAll('droplet-range');
    const knobs = (range: Element): string[] => [...range.shadowRoot!.querySelectorAll('[role="slider"]')].map((knob) => knob.getAttribute('aria-label') ?? '');

    await settle(4);

    expect(knobs(labelled!)).toEqual(['Price minimum', 'Price maximum']);
    expect(knobs(aria!)).toEqual(['Cost minimum', 'Cost maximum']);

    host.remove();
  });

});
