// Explicit registration entry: importing it hands over the component classes,
// calling defineAll() is what puts them on tags.

import { defineStrict } from './registry/index.js';
import type { DefineOptions, DefineResult } from './registry/index.js';
import { REGISTRATION } from './library.js';

import { DropletTheme, defineTheme } from './components/theme/index.js';
import { DropletButton, defineButton } from './components/button/index.js';
import { DropletIconButton, defineIconButton } from './components/icon-button/index.js';
import { DropletInput, defineInput } from './components/input/index.js';
import { DropletTextarea, defineTextarea } from './components/textarea/index.js';
import { DropletCheckbox, defineCheckbox } from './components/checkbox/index.js';
import { DropletRadio, defineRadio } from './components/radio/index.js';
import { DropletRadioGroup, defineRadioGroup } from './components/radio-group/index.js';
import { DropletSwitch, defineSwitch } from './components/switch/index.js';
import { DropletSlider, defineSlider } from './components/slider/index.js';
import { DropletRange, defineRange } from './components/range/index.js';
import { DropletSelect, defineSelect } from './components/select/index.js';
import { DropletOption, defineOption } from './components/option/index.js';
import { DropletSegmented, defineSegmented } from './components/segmented/index.js';
import { DropletSegment, defineSegment } from './components/segment/index.js';
import { DropletOtp, defineOtp } from './components/otp/index.js';
import { DropletLabel, defineLabel } from './components/label/index.js';
import { DropletProgress, defineProgress } from './components/progress/index.js';
import { DropletSpinner, defineSpinner } from './components/spinner/index.js';
import { DropletSkeleton, defineSkeleton } from './components/skeleton/index.js';
import { DropletBadge, defineBadge } from './components/badge/index.js';
import { DropletAlert, defineAlert } from './components/alert/index.js';
import { DropletToaster, defineToaster } from './components/toast/index.js';
import { DropletCard, defineCard } from './components/card/index.js';
import { DropletChip, defineChip } from './components/chip/index.js';
import { DropletKbd, defineKbd } from './components/kbd/index.js';
import { DropletDivider, defineDivider } from './components/divider/index.js';
import { DropletCollapsible, defineCollapsible } from './components/collapsible/index.js';
import { DropletAccordion, defineAccordion } from './components/accordion/index.js';
import { DropletTabPanel, DropletTabs, defineTabPanel, defineTabs } from './components/tabs/index.js';
import { DropletBreadcrumbs, defineBreadcrumbs } from './components/breadcrumbs/index.js';
import { DropletPagination, definePagination } from './components/pagination/index.js';
import { DropletResizable, defineResizable } from './components/resizable/index.js';
import { DropletTooltip, defineTooltip } from './components/tooltip/index.js';
import { DropletPopover, definePopover } from './components/popover/index.js';
import { DropletMenuItem, DropletMenu, defineMenuItem, defineMenu } from './components/menu/index.js';
import { DropletDialog, defineDialog } from './components/dialog/index.js';
import { DropletDrawer, defineDrawer } from './components/drawer/index.js';

export { defineElements, defineStrict, LEGACY_PREFIX, LEGACY_TAGS, LOG_PREFIX, RegistrationError, TAG_PREFIX, TAGS } from './registry/index.js';
export type { Collision, DefineEntry, DefineOptions, DefineResult, TagKey, TagName } from './registry/index.js';
export {
  DropletTheme,
  DropletButton,
  DropletIconButton,
  DropletInput,
  DropletTextarea,
  DropletCheckbox,
  DropletRadio,
  DropletRadioGroup,
  DropletSwitch,
  DropletSlider,
  DropletRange,
  DropletSelect,
  DropletOption,
  DropletSegmented,
  DropletSegment,
  DropletOtp,
  DropletLabel,
  DropletProgress,
  DropletSpinner,
  DropletSkeleton,
  DropletBadge,
  DropletAlert,
  DropletToaster,
  DropletCard,
  DropletChip,
  DropletKbd,
  DropletDivider,
  DropletCollapsible,
  DropletAccordion,
  DropletTabPanel,
  DropletTabs,
  DropletBreadcrumbs,
  DropletPagination,
  DropletResizable,
  DropletTooltip,
  DropletPopover,
  DropletMenuItem,
  DropletMenu,
  DropletDialog,
  DropletDrawer,
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


// One batch, so preflight covers the whole library
export function defineAll (options: DefineOptions = {}): DefineResult {
  return defineStrict(REGISTRATION, options);
}
