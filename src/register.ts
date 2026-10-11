// Explicit registration entry: importing it hands over the component classes,
// calling defineAll() is what puts them on tags.

import { defineStrict, TAGS } from './registry/index.js';
import type { DefineEntry, DefineOptions, DefineResult } from './registry/index.js';

import { JellyTheme, defineTheme } from './components/theme/index.js';
import { JellyButton, defineButton } from './components/button/index.js';
import { JellyIconButton, defineIconButton } from './components/icon-button/index.js';
import { JellyInput, defineInput } from './components/input/index.js';
import { JellyTextarea, defineTextarea } from './components/textarea/index.js';
import { JellyCheckbox, defineCheckbox } from './components/checkbox/index.js';
import { JellyRadio, defineRadio } from './components/radio/index.js';
import { JellyRadioGroup, defineRadioGroup } from './components/radio-group/index.js';
import { JellySwitch, defineSwitch } from './components/switch/index.js';
import { JellySlider, defineSlider } from './components/slider/index.js';
import { JellyRange, defineRange } from './components/range/index.js';
import { JellySelect, defineSelect } from './components/select/index.js';
import { JellyOption, defineOption } from './components/option/index.js';
import { JellySegmented, defineSegmented } from './components/segmented/index.js';
import { JellySegment, defineSegment } from './components/segment/index.js';
import { JellyOtp, defineOtp } from './components/otp/index.js';
import { JellyLabel, defineLabel } from './components/label/index.js';
import { JellyProgress, defineProgress } from './components/progress/index.js';
import { JellySpinner, defineSpinner } from './components/spinner/index.js';
import { JellySkeleton, defineSkeleton } from './components/skeleton/index.js';
import { JellyBadge, defineBadge } from './components/badge/index.js';
import { JellyAlert, defineAlert } from './components/alert/index.js';
import { JellyToaster, defineToaster } from './components/toast/index.js';
import { JellyCard, defineCard } from './components/card/index.js';
import { JellyChip, defineChip } from './components/chip/index.js';
import { JellyKbd, defineKbd } from './components/kbd/index.js';
import { JellyDivider, defineDivider } from './components/divider/index.js';
import { JellyCollapsible, defineCollapsible } from './components/collapsible/index.js';
import { JellyAccordion, defineAccordion } from './components/accordion/index.js';
import { JellyTabPanel, JellyTabs, defineTabPanel, defineTabs } from './components/tabs/index.js';
import { JellyBreadcrumbs, defineBreadcrumbs } from './components/breadcrumbs/index.js';
import { JellyPagination, definePagination } from './components/pagination/index.js';
import { JellyResizable, defineResizable } from './components/resizable/index.js';
import { JellyTooltip, defineTooltip } from './components/tooltip/index.js';
import { JellyPopover, definePopover } from './components/popover/index.js';
import { JellyMenuItem, JellyMenu, defineMenuItem, defineMenu } from './components/menu/index.js';
import { JellyDialog, defineDialog } from './components/dialog/index.js';
import { JellyDrawer, defineDrawer } from './components/drawer/index.js';

export { defineElements, defineStrict, LOG_PREFIX, RegistrationError, TAG_PREFIX, TAGS } from './registry/index.js';
export type { Collision, DefineEntry, DefineOptions, DefineResult, TagName } from './registry/index.js';
export {
  JellyTheme,
  JellyButton,
  JellyIconButton,
  JellyInput,
  JellyTextarea,
  JellyCheckbox,
  JellyRadio,
  JellyRadioGroup,
  JellySwitch,
  JellySlider,
  JellyRange,
  JellySelect,
  JellyOption,
  JellySegmented,
  JellySegment,
  JellyOtp,
  JellyLabel,
  JellyProgress,
  JellySpinner,
  JellySkeleton,
  JellyBadge,
  JellyAlert,
  JellyToaster,
  JellyCard,
  JellyChip,
  JellyKbd,
  JellyDivider,
  JellyCollapsible,
  JellyAccordion,
  JellyTabPanel,
  JellyTabs,
  JellyBreadcrumbs,
  JellyPagination,
  JellyResizable,
  JellyTooltip,
  JellyPopover,
  JellyMenuItem,
  JellyMenu,
  JellyDialog,
  JellyDrawer,
};
export {
  defineTheme,
  defineButton,
  defineIconButton,
  defineInput,
  defineTextarea,
  defineCheckbox,
  defineRadio,
  defineRadioGroup,
  defineSwitch,
  defineSlider,
  defineRange,
  defineSelect,
  defineOption,
  defineSegmented,
  defineSegment,
  defineOtp,
  defineLabel,
  defineProgress,
  defineSpinner,
  defineSkeleton,
  defineBadge,
  defineAlert,
  defineToaster,
  defineCard,
  defineChip,
  defineKbd,
  defineDivider,
  defineCollapsible,
  defineAccordion,
  defineTabPanel,
  defineTabs,
  defineBreadcrumbs,
  definePagination,
  defineResizable,
  defineTooltip,
  definePopover,
  defineMenuItem,
  defineMenu,
  defineDialog,
  defineDrawer,
};

// Upstream's registration order, which is also the order nested families upgrade
// in (collapsible before accordion, option after select, menu items before menus)
const REGISTRATION: ReadonlyArray<DefineEntry> = [
  [TAGS.theme, JellyTheme],
  [TAGS.button, JellyButton],
  [TAGS.iconButton, JellyIconButton],
  [TAGS.input, JellyInput],
  [TAGS.textarea, JellyTextarea],
  [TAGS.checkbox, JellyCheckbox],
  [TAGS.radio, JellyRadio],
  [TAGS.radioGroup, JellyRadioGroup],
  [TAGS.switch, JellySwitch],
  [TAGS.slider, JellySlider],
  [TAGS.range, JellyRange],
  [TAGS.select, JellySelect],
  [TAGS.option, JellyOption],
  [TAGS.segmented, JellySegmented],
  [TAGS.segment, JellySegment],
  [TAGS.otp, JellyOtp],
  [TAGS.label, JellyLabel],
  [TAGS.progress, JellyProgress],
  [TAGS.spinner, JellySpinner],
  [TAGS.skeleton, JellySkeleton],
  [TAGS.badge, JellyBadge],
  [TAGS.alert, JellyAlert],
  [TAGS.toaster, JellyToaster],
  [TAGS.card, JellyCard],
  [TAGS.chip, JellyChip],
  [TAGS.kbd, JellyKbd],
  [TAGS.divider, JellyDivider],
  [TAGS.collapsible, JellyCollapsible],
  [TAGS.accordion, JellyAccordion],
  [TAGS.tabPanel, JellyTabPanel],
  [TAGS.tabs, JellyTabs],
  [TAGS.breadcrumbs, JellyBreadcrumbs],
  [TAGS.pagination, JellyPagination],
  [TAGS.resizable, JellyResizable],
  [TAGS.tooltip, JellyTooltip],
  [TAGS.popover, JellyPopover],
  [TAGS.menuItem, JellyMenuItem],
  [TAGS.menu, JellyMenu],
  [TAGS.dialog, JellyDialog],
  [TAGS.drawer, JellyDrawer],
];

// One batch, so preflight covers the whole library
export function defineAll (options: DefineOptions = {}): DefineResult {
  return defineStrict(REGISTRATION, options);
}
