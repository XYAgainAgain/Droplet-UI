// The only place a pilot's tag name is spelled; TAG_PREFIX is a constant, not
// configuration, and Phase 2 flips it.

export const TAG_PREFIX = 'jelly';

export const TAGS = {
  button:      `${TAG_PREFIX}-button`,
  collapsible: `${TAG_PREFIX}-collapsible`,
  slider:      `${TAG_PREFIX}-slider`,
  toaster:     `${TAG_PREFIX}-toaster`,
} as const;

export type TagName = (typeof TAGS)[keyof typeof TAGS];
