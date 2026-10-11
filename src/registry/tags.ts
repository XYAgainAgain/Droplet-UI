// The only place a tag name is spelled; TAG_PREFIX is a constant, not
// configuration, and Phase 2 flips it.

export const TAG_PREFIX = 'jelly';

export const LOG_PREFIX = `[${TAG_PREFIX}]`;

export const TAGS = {
  accordion:   `${TAG_PREFIX}-accordion`,
  alert:       `${TAG_PREFIX}-alert`,
  badge:       `${TAG_PREFIX}-badge`,
  breadcrumbs: `${TAG_PREFIX}-breadcrumbs`,
  button:      `${TAG_PREFIX}-button`,
  card:        `${TAG_PREFIX}-card`,
  checkbox:    `${TAG_PREFIX}-checkbox`,
  chip:        `${TAG_PREFIX}-chip`,
  collapsible: `${TAG_PREFIX}-collapsible`,
  dialog:      `${TAG_PREFIX}-dialog`,
  divider:     `${TAG_PREFIX}-divider`,
  drawer:      `${TAG_PREFIX}-drawer`,
  iconButton:  `${TAG_PREFIX}-icon-button`,
  input:       `${TAG_PREFIX}-input`,
  kbd:         `${TAG_PREFIX}-kbd`,
  label:       `${TAG_PREFIX}-label`,
  menu:        `${TAG_PREFIX}-menu`,
  menuItem:    `${TAG_PREFIX}-menu-item`,
  option:      `${TAG_PREFIX}-option`,
  otp:         `${TAG_PREFIX}-otp`,
  pagination:  `${TAG_PREFIX}-pagination`,
  popover:     `${TAG_PREFIX}-popover`,
  progress:    `${TAG_PREFIX}-progress`,
  radio:       `${TAG_PREFIX}-radio`,
  radioGroup:  `${TAG_PREFIX}-radio-group`,
  range:       `${TAG_PREFIX}-range`,
  resizable:   `${TAG_PREFIX}-resizable`,
  segment:     `${TAG_PREFIX}-segment`,
  segmented:   `${TAG_PREFIX}-segmented`,
  select:      `${TAG_PREFIX}-select`,
  skeleton:    `${TAG_PREFIX}-skeleton`,
  slider:      `${TAG_PREFIX}-slider`,
  spinner:     `${TAG_PREFIX}-spinner`,
  switch:      `${TAG_PREFIX}-switch`,
  tabPanel:    `${TAG_PREFIX}-tab-panel`,
  tabs:        `${TAG_PREFIX}-tabs`,
  textarea:    `${TAG_PREFIX}-textarea`,
  theme:       `${TAG_PREFIX}-theme`,
  toaster:     `${TAG_PREFIX}-toaster`,
  tooltip:     `${TAG_PREFIX}-tooltip`,
} as const;

export type TagName = (typeof TAGS)[keyof typeof TAGS];
