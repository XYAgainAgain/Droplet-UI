export const JELLY_UI_1_1_0_TAGS = [
  'jelly-accordion',
  'jelly-alert',
  'jelly-badge',
  'jelly-breadcrumbs',
  'jelly-button',
  'jelly-card',
  'jelly-checkbox',
  'jelly-chip',
  'jelly-collapsible',
  'jelly-dialog',
  'jelly-divider',
  'jelly-drawer',
  'jelly-icon-button',
  'jelly-input',
  'jelly-kbd',
  'jelly-label',
  'jelly-menu',
  'jelly-menu-item',
  'jelly-option',
  'jelly-otp',
  'jelly-pagination',
  'jelly-popover',
  'jelly-progress',
  'jelly-radio',
  'jelly-radio-group',
  'jelly-range',
  'jelly-resizable',
  'jelly-segment',
  'jelly-segmented',
  'jelly-select',
  'jelly-skeleton',
  'jelly-slider',
  'jelly-spinner',
  'jelly-switch',
  'jelly-tab-panel',
  'jelly-tabs',
  'jelly-textarea',
  'jelly-theme',
  'jelly-toaster',
  'jelly-tooltip',
] as const;

export const JELLY_UI_1_1_0_CONSUMER_MARKUP = `
  <jelly-button style="--jelly-fill: rgb(7, 101, 203)">Legacy button</jelly-button>
  <jelly-slider min="0" max="100" step="5" value="40"></jelly-slider>
  <jelly-collapsible>
    <span slot="header">Legacy details</span>
    Legacy content
  </jelly-collapsible>
`;
