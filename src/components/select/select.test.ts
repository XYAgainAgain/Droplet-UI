import { expect, test } from 'vitest';

import { mount, settle } from '../../testing/index.js';

import type { DropletSelect } from './index.js';
import '../../testing/define-all.js';

test('renders one listbox row per option and honors the selected attribute', async () => {
  const host = mount(`
    <droplet-select label="Plan">
      <droplet-option value="free">Free</droplet-option>
      <droplet-option value="pro" selected>Pro</droplet-option>
    </droplet-select>`);
  const el = host.querySelector('droplet-select') as DropletSelect;
  await settle(6);

  const rows = el.shadowRoot!.querySelectorAll('.row');
  expect(rows.length).toBe(2);
  expect(el.value).toBe('pro');
  expect(el.shadowRoot!.querySelector('.value')!.textContent).toBe('Pro');

  host.remove();
});

test('opening the panel sets aria-expanded and clicking a row selects it', async () => {
  const host = mount(`
    <droplet-select label="Plan" placeholder="Choose">
      <droplet-option value="free">Free</droplet-option>
      <droplet-option value="pro">Pro</droplet-option>
    </droplet-select>`);
  const el = host.querySelector('droplet-select') as DropletSelect;
  await settle(6);

  let changed = false;
  el.addEventListener('change', () => { changed = true; });

  const trigger = el.shadowRoot!.querySelector('.trigger') as HTMLButtonElement;
  trigger.click();
  expect(trigger.getAttribute('aria-expanded')).toBe('true');

  const rows = el.shadowRoot!.querySelectorAll('.row');
  (rows[1] as HTMLElement).click();

  expect(el.value).toBe('pro');
  expect(changed).toBe(true);
  expect(trigger.getAttribute('aria-expanded')).toBe('false');

  host.remove();
});

test('submits the selected value in a form', async () => {
  const host = mount(`
    <form>
      <droplet-select name="plan" value="pro">
        <droplet-option value="free">Free</droplet-option>
        <droplet-option value="pro">Pro</droplet-option>
      </droplet-select>
    </form>`);
  await settle(6);

  const data = new FormData(host.querySelector('form') as HTMLFormElement);
  expect(data.get('plan')).toBe('pro');

  host.remove();
});

const OPTIONS = '<droplet-option value="a">Alpha</droplet-option><droplet-option value="b">Bravo</droplet-option><droplet-option value="c">Charlie</droplet-option>';

// Short enough to clip an in-flow panel
function scroller (): { host: HTMLDivElement; box: HTMLElement; el: DropletSelect } {
  const host = mount(`
    <div class="box" style="overflow: auto; height: 160px; width: 320px; margin-top: 40px">
      <div style="height: 60px"></div>
      <droplet-select label="Clock">${OPTIONS}</droplet-select>
      <div style="height: 400px"></div>
    </div>`);

  return { host, box: host.querySelector('.box') as HTMLElement, el: host.querySelector('droplet-select') as DropletSelect };
}

test('opens its panel in the top layer, outside a clipping scroller', async () => {
  const { host, box, el } = scroller();
  await settle(6);

  (el.shadowRoot!.querySelector('.trigger') as HTMLButtonElement).click();
  await settle(30);

  const panel = el.shadowRoot!.querySelector('.panel') as HTMLElement;
  const rect  = panel.getBoundingClientRect();
  const clip  = box.getBoundingClientRect();
  const field = el.getBoundingClientRect();

  expect(panel.matches(':popover-open')).toBe(true);
  expect(rect.bottom).toBeGreaterThan(clip.bottom);
  expect(rect.left).toBeCloseTo(field.left, 0);

  // Below the scroller, the hit is the panel retargeted to the host
  const hit = document.elementFromPoint(rect.left + rect.width / 2, Math.min(rect.bottom - 10, clip.bottom + 20));

  expect(hit).toBe(el);

  host.remove();
});

test('follows the trigger when its scroller scrolls', async () => {
  const { host, box, el } = scroller();
  await settle(6);

  (el.shadowRoot!.querySelector('.trigger') as HTMLButtonElement).click();
  await settle(10);

  const panel  = el.shadowRoot!.querySelector('.panel') as HTMLElement;
  const before = panel.getBoundingClientRect().top;

  box.scrollTop = 20;
  box.dispatchEvent(new Event('scroll'));
  await settle(3);

  expect(panel.getBoundingClientRect().top).toBeCloseTo(before - 20, 0);

  host.remove();
});

test('closes once the trigger scrolls out of its scroller', async () => {
  const { host, box, el } = scroller();
  await settle(6);

  (el.shadowRoot!.querySelector('.trigger') as HTMLButtonElement).click();
  await settle(10);

  box.scrollTop = 300;
  await settle(10);

  expect(el.hasAttribute('open')).toBe(false);
  expect(box.scrollTop).toBeGreaterThan(250);
  expect((el.shadowRoot!.querySelector('.panel') as HTMLElement).matches(':popover-open')).toBe(false);

  host.remove();
});

test('leaves the top layer after the fold-away and when removed while open', async () => {
  const { host, el } = scroller();
  await settle(6);

  const trigger = el.shadowRoot!.querySelector('.trigger') as HTMLButtonElement;
  const panel   = el.shadowRoot!.querySelector('.panel') as HTMLElement;

  trigger.click();
  await settle(10);
  trigger.click();
  await settle(60);

  expect(panel.matches(':popover-open')).toBe(false);

  trigger.click();
  await settle(5);
  el.remove();

  expect(panel.matches(':popover-open')).toBe(false);
  expect(() => window.dispatchEvent(new Event('scroll'))).not.toThrow();

  host.remove();
});

test('falls back to the in-flow panel when showPopover throws, and never opens detached', async () => {
  const { host, el } = scroller();
  await settle(6);

  const panel = el.shadowRoot!.querySelector('.panel') as HTMLElement;

  panel.showPopover = () => { throw new DOMException('nope', 'InvalidStateError'); };
  (el.shadowRoot!.querySelector('.trigger') as HTMLButtonElement).click();
  await settle(10);

  expect(el.hasAttribute('open')).toBe(true);
  expect(panel.hasAttribute('popover')).toBe(false);
  expect(getComputedStyle(panel).display).not.toBe('none');

  el.close();
  el.remove();
  el.openPanel();

  expect(el.isOpen).toBe(false);

  host.remove();
});

test('an option built in script takes its value through the property', async () => {
  const host   = mount('<droplet-select label="Built"></droplet-select>');
  const select = host.firstElementChild as DropletSelect;
  const option = document.createElement('droplet-option') as HTMLElement & { value: string };

  option.textContent = 'Shown';
  option.value = 'stored';
  select.append(option);
  await settle(4);

  expect(option.getAttribute('value')).toBe('stored');

  select.value = 'stored';
  expect(select.value).toBe('stored');

  host.remove();
});
