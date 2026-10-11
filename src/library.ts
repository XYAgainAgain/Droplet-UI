// The whole library in one table, shared by defineAll() and defineCompat() so both
// register in the same order; internal, never a package entry

import { TAGS } from './registry/index.js';
import type { DefineEntry } from './registry/index.js';

import { DropletTheme } from './components/theme/index.js';
import { DropletButton } from './components/button/index.js';
import { DropletIconButton } from './components/icon-button/index.js';
import { DropletInput } from './components/input/index.js';
import { DropletTextarea } from './components/textarea/index.js';
import { DropletCheckbox } from './components/checkbox/index.js';
import { DropletRadio } from './components/radio/index.js';
import { DropletRadioGroup } from './components/radio-group/index.js';
import { DropletSwitch } from './components/switch/index.js';
import { DropletSlider } from './components/slider/index.js';
import { DropletRange } from './components/range/index.js';
import { DropletSelect } from './components/select/index.js';
import { DropletOption } from './components/option/index.js';
import { DropletSegmented } from './components/segmented/index.js';
import { DropletSegment } from './components/segment/index.js';
import { DropletOtp } from './components/otp/index.js';
import { DropletLabel } from './components/label/index.js';
import { DropletProgress } from './components/progress/index.js';
import { DropletSpinner } from './components/spinner/index.js';
import { DropletSkeleton } from './components/skeleton/index.js';
import { DropletBadge } from './components/badge/index.js';
import { DropletAlert } from './components/alert/index.js';
import { DropletToaster } from './components/toast/index.js';
import { DropletCard } from './components/card/index.js';
import { DropletChip } from './components/chip/index.js';
import { DropletKbd } from './components/kbd/index.js';
import { DropletDivider } from './components/divider/index.js';
import { DropletCollapsible } from './components/collapsible/index.js';
import { DropletAccordion } from './components/accordion/index.js';
import { DropletTabPanel, DropletTabs } from './components/tabs/index.js';
import { DropletBreadcrumbs } from './components/breadcrumbs/index.js';
import { DropletPagination } from './components/pagination/index.js';
import { DropletResizable } from './components/resizable/index.js';
import { DropletTooltip } from './components/tooltip/index.js';
import { DropletPopover } from './components/popover/index.js';
import { DropletMenuItem, DropletMenu } from './components/menu/index.js';
import { DropletDialog } from './components/dialog/index.js';
import { DropletDrawer } from './components/drawer/index.js';

// Jelly UI's registration order, which is also the order nested families upgrade
// in (collapsible before accordion, option after select, menu items before menus)
export const REGISTRATION: ReadonlyArray<DefineEntry> = [
  [TAGS.theme, DropletTheme],
  [TAGS.button, DropletButton],
  [TAGS.iconButton, DropletIconButton],
  [TAGS.input, DropletInput],
  [TAGS.textarea, DropletTextarea],
  [TAGS.checkbox, DropletCheckbox],
  [TAGS.radio, DropletRadio],
  [TAGS.radioGroup, DropletRadioGroup],
  [TAGS.switch, DropletSwitch],
  [TAGS.slider, DropletSlider],
  [TAGS.range, DropletRange],
  [TAGS.select, DropletSelect],
  [TAGS.option, DropletOption],
  [TAGS.segmented, DropletSegmented],
  [TAGS.segment, DropletSegment],
  [TAGS.otp, DropletOtp],
  [TAGS.label, DropletLabel],
  [TAGS.progress, DropletProgress],
  [TAGS.spinner, DropletSpinner],
  [TAGS.skeleton, DropletSkeleton],
  [TAGS.badge, DropletBadge],
  [TAGS.alert, DropletAlert],
  [TAGS.toaster, DropletToaster],
  [TAGS.card, DropletCard],
  [TAGS.chip, DropletChip],
  [TAGS.kbd, DropletKbd],
  [TAGS.divider, DropletDivider],
  [TAGS.collapsible, DropletCollapsible],
  [TAGS.accordion, DropletAccordion],
  [TAGS.tabPanel, DropletTabPanel],
  [TAGS.tabs, DropletTabs],
  [TAGS.breadcrumbs, DropletBreadcrumbs],
  [TAGS.pagination, DropletPagination],
  [TAGS.resizable, DropletResizable],
  [TAGS.tooltip, DropletTooltip],
  [TAGS.popover, DropletPopover],
  [TAGS.menuItem, DropletMenuItem],
  [TAGS.menu, DropletMenu],
  [TAGS.dialog, DropletDialog],
  [TAGS.drawer, DropletDrawer],
];
