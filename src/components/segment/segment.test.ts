import { expect, test } from 'vitest';

import { mount } from '../../testing/index.js';

import type { DropletSegment } from './index.js';
import '../../testing/define-all.js';

test('derives value from the attribute or the text content', () => {
  const host = mount('<droplet-segment value="week">Week</droplet-segment><droplet-segment>Month</droplet-segment>');
  const [withValue, textOnly] = [...host.querySelectorAll('droplet-segment')] as [DropletSegment, DropletSegment];

  expect(withValue.value).toBe('week');
  expect(withValue.label).toBe('Week');
  expect(textOnly.value).toBe('Month');

  host.remove();
});
