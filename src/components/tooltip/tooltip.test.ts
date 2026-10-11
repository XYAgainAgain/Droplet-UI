import { expect, test } from 'vitest';

import { mount } from '../../testing/index.js';

import type { JellyTooltip } from './index.js';
import '../../testing/define-all.js';

test('mirrors text into the bubble and describes the trigger', () => {
  const host = mount('<jelly-tooltip text="Copy link"><button>Copy</button></jelly-tooltip>');
  const el = host.querySelector('jelly-tooltip') as JellyTooltip;

  const content = el.shadowRoot!.querySelector('slot[name="content"]') as HTMLElement;
  expect(content.textContent).toBe('Copy link');
  expect((host.querySelector('button') as HTMLElement).ariaDescription).toBe('Copy link');

  host.remove();
});

test('shows on pointerenter and hides on pointerleave', () => {
  const host = mount('<jelly-tooltip text="Info"><button>Trigger</button></jelly-tooltip>');
  const el = host.querySelector('jelly-tooltip') as JellyTooltip;
  const bubble = el.shadowRoot!.querySelector('.bubble') as HTMLElement;

  el.dispatchEvent(new Event('pointerenter'));
  expect(bubble.hasAttribute('data-show')).toBe(true);

  el.dispatchEvent(new Event('pointerleave'));
  expect(bubble.hasAttribute('data-show')).toBe(false);

  host.remove();
});

test('repositions an open tooltip when its text changes', () => {
  const host = mount('<jelly-tooltip text="Info"><button>Trigger</button></jelly-tooltip>');
  const el = host.querySelector('jelly-tooltip') as JellyTooltip;
  const bubble = el.shadowRoot!.querySelector('.bubble') as HTMLElement;

  el.show();
  bubble.style.left = '999px';
  el.setAttribute('text', 'A much longer tooltip label');

  expect(bubble.style.left).not.toBe('999px');

  host.remove();
});

test('Escape dismisses the visible tooltip', () => {
  const host = mount('<jelly-tooltip text="Info"><button>Trigger</button></jelly-tooltip>');
  const el = host.querySelector('jelly-tooltip') as JellyTooltip;
  const bubble = el.shadowRoot!.querySelector('.bubble') as HTMLElement;

  el.dispatchEvent(new Event('focusin'));
  expect(bubble.hasAttribute('data-show')).toBe(true);

  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  expect(bubble.hasAttribute('data-show')).toBe(false);

  host.remove();
});
