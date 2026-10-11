import { expect, test } from 'vitest';

import { mount, settle } from '../../testing/index.js';

import type { DropletRange } from './index.js';
import '../../testing/define-all.js';

test('upgrades with two role=slider knobs', async () => {
  const host = mount('<droplet-range min="0" max="100" low="20" high="70"></droplet-range>');
  const el = host.querySelector('droplet-range') as DropletRange;

  await settle(3);
  const knobs = el.shadowRoot!.querySelectorAll('.knob');
  expect(knobs.length).toBe(2);
  expect(knobs[0]!.getAttribute('role')).toBe('slider');

  host.remove();
});

test('reflects low/high into aria-valuenow and the value getter', async () => {
  const host = mount('<droplet-range min="0" max="100" low="20" high="70"></droplet-range>');
  const el = host.querySelector('droplet-range') as DropletRange;

  await settle(3);
  const knobs = el.shadowRoot!.querySelectorAll('.knob');
  expect(knobs[0]!.getAttribute('aria-valuenow')).toBe('20');
  expect(knobs[1]!.getAttribute('aria-valuenow')).toBe('70');
  expect(el.value).toBe('20,70');

  host.remove();
});

test('arrow key on a knob steps its bound and fires input', async () => {
  const host = mount('<droplet-range min="0" max="100" low="20" high="70" step="5"></droplet-range>');
  const el = host.querySelector('droplet-range') as DropletRange;

  await settle(3);
  let inputs = 0;
  el.addEventListener('input', () => { inputs += 1; });

  const lowKnob = el.shadowRoot!.querySelectorAll('.knob')[0];
  lowKnob!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));

  expect(el.value).toBe('25,70');
  expect(inputs).toBeGreaterThan(0);

  host.remove();
});

test('submits its interval as "low,high" in a form', async () => {
  const host = mount('<form><droplet-range name="price" min="0" max="100" low="10" high="40"></droplet-range></form>');
  await settle(3);

  const data = new FormData(host.querySelector('form') as HTMLFormElement);
  expect(data.get('price')).toBe('10,40');

  host.remove();
});
