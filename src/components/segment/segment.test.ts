import { expect, test } from 'vitest';

import { mount } from '../../testing/index.js';

import './index.js';
import type { JellySegment } from './index.js';

test('derives value from the attribute or the text content', () => {
  const host = mount('<jelly-segment value="week">Week</jelly-segment><jelly-segment>Month</jelly-segment>');
  const [withValue, textOnly] = [...host.querySelectorAll('jelly-segment')] as [JellySegment, JellySegment];

  expect(withValue.value).toBe('week');
  expect(withValue.label).toBe('Week');
  expect(textOnly.value).toBe('Month');

  host.remove();
});
