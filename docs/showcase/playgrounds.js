/*
 * Showcase playground config, one entry per tag: index.js builds each live preview and its
 * attribute table from it. A tag without an entry stays on /api only (see NO_PANEL).
 */

import { dropletIcon } from '../../package.js';

const VARIANTS = ['azure', 'rose', 'amber', 'mint', 'graphite', 'platinum', 'white'];

const SIZES = ['small', 'medium', 'large'];

const bool   = (attr) => ({ attr, kind: 'bool' });
const size   = () => ({ attr: 'size', kind: 'enum', options: SIZES });
const variant = () => ({ attr: 'variant', kind: 'enum', options: VARIANTS });
const pick   = (attr, options) => ({ attr, kind: 'enum', options });
// A number control shown as an editable spinner (clamped to min/max)
const numField = (attr, min, max, step = 1) => ({ attr, kind: 'number', min, max, step, field: true });
const text   = (attr, placeholder = '') => ({ attr, kind: 'text', placeholder });

export const PLAYGROUNDS = {

  // Theming

  'droplet-theme': {
    // A roomy mini settings panel shows surface/text theming plus several
    // controls that inherit --droplet-color-background-accent.
    inner: '<droplet-card style="padding: 26px; min-width: 320px;"><div style="display: grid; gap: 24px; justify-items: stretch;"><div style="display: grid; gap: 4px;"><strong style="font-size: 16px;">Workspace controls</strong><span style="font-size: 13px; opacity: 0.68;">Preview the scoped theme</span></div><droplet-slider label="Volume" value="62" style="width: 100%;"></droplet-slider><droplet-progress label="Completion" value="62" style="width: 100%;"></droplet-progress><div style="display: flex; flex-wrap: wrap; align-items: center; gap: 14px 20px;"><droplet-checkbox checked>Sync</droplet-checkbox><droplet-switch checked>Notifications</droplet-switch></div></div></droplet-card>',
    controls: [pick('mode', ['auto', 'light', 'dark']), text('accent', '#7C3AED')],
    defaults: { mode: 'auto' },
  },

  // Actions

  'droplet-button': {
    slot: 'Publish',
    controls: [variant(), size(), pick('shape', ['pill', 'square']), bool('disabled'), bool('block')],
    // "pill" (the default) clears the attribute; "square" sets shape="square"
    aliases: { shape: { attr: 'shape', off: 'pill' } },
    defaults: { shape: 'pill' },
  },

  'droplet-icon-button': {
    inner: dropletIcon('star', { size: 20 }),
    controls: [variant(), size(), pick('shape', ['square', 'circle']), bool('disabled'), text('label', 'Accessible name')],
    defaults: { shape: 'square' },
  },

  // Forms

  'droplet-input': {
    attrs: { label: 'Example input' },
    controls: [
      text('placeholder', 'Placeholder'),
      text('value', 'Type here'),
      pick('type', ['text', 'email', 'password']),
      size(),
      bool('disabled'),
      bool('readonly'),
    ],
    bind: [{ event: 'input', attr: 'value', get: (el) => el.value }],
    defaults: { placeholder: 'Your name' },
  },

  'droplet-textarea': {
    attrs: { label: 'Example note' },
    controls: [text('placeholder', 'Placeholder'), text('value', 'Type here'), numField('rows', 2, 8), size(), bool('disabled'), bool('readonly')],
    bind: [{ event: 'input', attr: 'value', get: (el) => el.value }],
    defaults: { placeholder: 'Write a note…' },
  },

  'droplet-checkbox': {
    slot: 'Subscribe to updates',
    controls: [bool('checked'), bool('indeterminate'), variant(), size(), bool('disabled')],
    bind: [{ event: 'change', attr: 'checked', get: (el) => el.checked }],
  },

  'droplet-radio': {
    slot: 'Wireless',
    controls: [bool('checked'), variant(), size(), bool('disabled')],
    bind: [{ event: 'change', attr: 'checked', get: (el) => el.checked }],
    defaults: { checked: true },
  },

  'droplet-radio-group': {
    inner: '<droplet-radio name="pg-plan" value="free" checked>Free</droplet-radio><droplet-radio name="pg-plan" value="pro">Pro</droplet-radio><droplet-radio name="pg-plan" value="team">Team</droplet-radio>',
    controls: [pick('direction', ['horizontal', 'vertical']), size(), text('label', 'Group label')],
  },

  'droplet-switch': {
    slot: 'Notifications',
    controls: [bool('checked'), variant(), size(), bool('disabled')],
    bind: [{ event: 'change', attr: 'checked', get: (el) => el.checked }],
  },

  'droplet-slider': {
    attrs: { label: 'Value' },
    controls: [numField('value', 0, 100), numField('min', 0, 100), numField('max', 0, 100), numField('step', 1, 25), variant(), size(), bool('disabled')],
    bind: [{ event: 'input', attr: 'value', get: (el) => el.value }],
    defaults: { value: 50, min: 0, max: 100, step: 1 },
  },

  'droplet-range': {
    attrs: { label: 'Interval' },
    controls: [numField('low', 0, 100), numField('high', 0, 100), numField('min', 0, 100), numField('max', 0, 100), numField('step', 1, 25), variant(), size(), bool('disabled')],
    bind: [{ event: 'input', attr: 'low', get: (el) => el.value.split(',')[0] },
           { event: 'input', attr: 'high', get: (el) => el.value.split(',')[1] }],
    defaults: { low: 25, high: 75, min: 0, max: 100, step: 1 },
  },

  'droplet-select': {
    attrs: { label: 'Fruit' },
    inner: '<droplet-option value="kiwi">Kiwi</droplet-option><droplet-option value="fig">Fig</droplet-option><droplet-option value="plum">Plum</droplet-option>',
    controls: [pick('value', ['kiwi', 'fig', 'plum']), variant(), size(), bool('disabled')],
    bind: [{ event: 'change', attr: 'value', get: (el) => el.value }],
    defaults: { value: 'kiwi' },
  },

  'droplet-segmented': {
    attrs: { label: 'Period' },
    inner: '<droplet-segment value="day">Day</droplet-segment><droplet-segment value="week">Week</droplet-segment><droplet-segment value="month">Month</droplet-segment>',
    controls: [pick('value', ['day', 'week', 'month']), size(), bool('disabled')],
    bind: [{ event: 'change', attr: 'value', get: (el) => el.value }],
    defaults: { value: 'week' },
  },

  'droplet-otp': {
    attrs: { label: 'Verification code' },
    controls: [numField('length', 4, 8), variant(), size(), bool('disabled')],
    defaults: { length: 6 },
  },

  'droplet-label': {
    slot: 'Email address',
    inner: 'Email address',
    controls: [bool('required'), size()],
  },

  // Feedback

  'droplet-alert': {
    slot: 'Your changes are live.',
    controls: [pick('tone', ['info', 'success', 'warning', 'danger']), bool('dismissible'), size()],
    defaults: { tone: 'success' },
  },

  'droplet-badge': {
    slot: '7',
    controls: [variant(), size(), bool('outline'), pick('shape', ['pill', 'square']), bool('live'), bool('instant')],
    aliases: { shape: { attr: 'shape', off: 'pill' } },
    defaults: { variant: 'rose', shape: 'pill' },
  },

  'droplet-progress': {
    attrs: { label: 'Completion' },
    controls: [numField('value', 0, 100), numField('max', 1, 100), bool('indeterminate'), variant(), size()],
    defaults: { value: 60, max: 100 },
  },

  'droplet-spinner': {
    controls: [pick('type', ['blob', 'dots']), variant(), size()],
  },

  'droplet-skeleton': {
    controls: [pick('shape', ['line', 'rect', 'circle'])],
    defaults: { shape: 'line' },
  },

  'droplet-toaster': {
    trigger: true,
    // the trigger sits beside the (invisible) toaster rail, not inside it
    extra: '<droplet-button data-toast variant="mint">Show a toast</droplet-button>',
    controls: [pick('tone', ['info', 'success', 'warning', 'danger'])],
    defaults: { tone: 'success' },
    note: 'Fires dropletToast() with the chosen tone. Add position="bottom" on a placed <droplet-toaster> to grow the stack upward.',
  },

  // Surfaces

  'droplet-card': {
    inner: '<h3 style="margin:0 0 6px">Soft surface</h3><p style="margin:0">The soft body stays under the content.</p>',
    controls: [bool('squish'), size()],
  },

  'droplet-chip': {
    slot: 'Design',
    // variant and size come first, while the chip is still selected (a chip only
    // shows its variant hue when selected), then the boolean toggles run
    controls: [variant(), size(), pick('shape', ['pill', 'square']), bool('selectable'), bool('selected'), bool('removable'), bool('disabled')],
    aliases: { shape: { attr: 'shape', off: 'pill' } },
    bind: [{ event: 'change', attr: 'selected', get: (el) => el.selected }],
    defaults: { selectable: true, selected: true, shape: 'pill' },
  },

  'droplet-kbd': {
    slot: 'K',
    controls: [text('key', 'Physical key (e.g. k)'), size()],
    note: 'Set key and hold that key anywhere on the page - the cap depresses with it.',
  },

  'droplet-divider': {
    inner: 'or',
    wrap: 'block',
    controls: [pick('direction', ['horizontal', 'vertical']), text('content', 'Label'), size()],
    aliases: { direction: { attr: 'direction', off: 'horizontal' } },
    defaults: { content: 'or' },
  },

  'droplet-collapsible': {
    inner: '<span slot="header">What moves?</span>The surface, not the text.',
    controls: [bool('open'), size()],
    bind: [{ event: 'toggle', attr: 'open', get: (el) => el.open }],
    defaults: { open: true },
  },

  'droplet-accordion': {
    inner: '<droplet-collapsible open><span slot="header">Motion</span>Soft and contained.</droplet-collapsible><droplet-collapsible><span slot="header">Forms</span>Native and composed.</droplet-collapsible>',
    controls: [bool('single'), size()],
  },

  // Navigation

  'droplet-tabs': {
    inner: [
      '<droplet-tab-panel label="Overview" value="overview" active>',
        '<div class="pg-tab"><h3>Overview</h3><p>A calm summary of where the project stands and what shipped this week.</p></div>',
      '</droplet-tab-panel>',
      '<droplet-tab-panel label="Activity" value="activity">',
        '<div class="pg-tab"><h3>Activity</h3><p>Ada deployed v2.1 · Grace opened 3 pull requests · 12 issues closed.</p></div>',
      '</droplet-tab-panel>',
      '<droplet-tab-panel label="Settings" value="settings">',
        '<div class="pg-tab"><h3>Settings</h3><p>Theme, notifications and workspace preferences live here.</p></div>',
      '</droplet-tab-panel>',
    ].join(''),
    controls: [pick('value', ['overview', 'activity', 'settings']), size()],
    bind: [{ event: 'change', attr: 'value', get: (el) => el.value }],
    defaults: { value: 'overview' },
  },

  'droplet-breadcrumbs': {
    inner: '<a href="#pg">Home</a><a href="#pg">Library</a><span>Switch</span>',
    controls: [size()],
  },

  'droplet-pagination': {
    controls: [numField('total', 3, 20), numField('page', 1, 20), size()],
    bind: [{ event: 'change', attr: 'page', get: (el) => el.page }],
    defaults: { total: 12, page: 3 },
  },

  'droplet-resizable': {
    // Each pane is a solid surface tile so the split reads clearly
    inner: '<div class="pg-pane">One</div><div class="pg-pane">Two</div><div class="pg-pane">Three</div>',
    wrap: 'fill',
    controls: [pick('direction', ['row', 'vertical', 'both'])],
    aliases: { direction: { attr: 'direction', off: 'row' } },
  },

  // Overlays

  'droplet-tooltip': {
    inner: `<droplet-icon-button label="Copy">${dropletIcon('link', { size: 18 })}</droplet-icon-button>`,
    controls: [text('text', 'Tooltip text'), pick('placement', ['top', 'bottom', 'start', 'end']), size()],
    defaults: { text: 'Copy link' },
    note: 'Hover or focus the button to reveal the tooltip.',
  },

  'droplet-popover': {
    trigger: true,
    inner: '<droplet-button slot="trigger">Options</droplet-button><div slot="content">Anything can live in a popover.</div>',
    controls: [pick('placement', ['top', 'bottom', 'start', 'end']), size(), text('label', 'Accessible name')],
    defaults: { placement: 'bottom' },
    note: 'Click the trigger to open.',
  },

  'droplet-menu': {
    trigger: true,
    inner: '<droplet-button slot="trigger">Actions</droplet-button><droplet-menu-item value="edit">Edit</droplet-menu-item><droplet-menu-item value="duplicate">Duplicate</droplet-menu-item><droplet-menu-item value="delete" danger>Delete</droplet-menu-item>',
    controls: [pick('placement', ['top', 'bottom', 'start', 'end']), size()],
    defaults: { placement: 'bottom' },
    note: 'Click the trigger to open the menu.',
  },

  'droplet-dialog': {
    trigger: true,
    extra: '<droplet-button data-open variant="mint">Open dialog</droplet-button>',
    inner: '<h2 style="margin:0 0 8px">Confirm</h2><p style="margin:0">Escape, the ✕, or the backdrop closes me.</p>',
    controls: [text('label', 'Accessible name')],
    note: 'Click to open the modal dialog.',
  },

  'droplet-drawer': {
    trigger: true,
    extra: '<droplet-button data-open variant="mint">Open drawer</droplet-button>',
    inner: '<h3 style="margin:0 0 8px">Navigation</h3><p style="margin:0">I slide in from the chosen side.</p>',
    controls: [pick('side', ['end', 'start', 'bottom']), text('label', 'Accessible name')],
    defaults: { side: 'end' },
    note: 'Click to open the drawer.',
  },

};

// Child-only elements: documented on /api, shown inside their parents' demos
export const NO_PANEL = new Set(['droplet-option', 'droplet-segment', 'droplet-menu-item', 'droplet-tab-panel']);
