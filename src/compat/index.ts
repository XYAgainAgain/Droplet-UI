// Permanent Jelly UI aliases: one thin subclass per legacy tag, so markup, CSS,
// and instanceof checks written against Jelly UI keep working unchanged.

import { defineElements, defineStrict, LEGACY_TAGS } from '../registry/index.js';
import type { DefineEntry, DefineOptions, DefineResult } from '../registry/index.js';
import { REGISTRATION } from '../library.js';

import { DropletTheme } from '../components/theme/index.js';
import { DropletButton } from '../components/button/index.js';
import { DropletIconButton } from '../components/icon-button/index.js';
import { DropletInput } from '../components/input/index.js';
import { DropletTextarea } from '../components/textarea/index.js';
import { DropletCheckbox } from '../components/checkbox/index.js';
import { DropletRadio } from '../components/radio/index.js';
import { DropletRadioGroup } from '../components/radio-group/index.js';
import { DropletSwitch } from '../components/switch/index.js';
import { DropletSlider } from '../components/slider/index.js';
import { DropletRange } from '../components/range/index.js';
import { DropletSelect } from '../components/select/index.js';
import { DropletOption } from '../components/option/index.js';
import { DropletSegmented } from '../components/segmented/index.js';
import { DropletSegment } from '../components/segment/index.js';
import { DropletOtp } from '../components/otp/index.js';
import { DropletLabel } from '../components/label/index.js';
import { DropletProgress } from '../components/progress/index.js';
import { DropletSpinner } from '../components/spinner/index.js';
import { DropletSkeleton } from '../components/skeleton/index.js';
import { DropletBadge } from '../components/badge/index.js';
import { DropletAlert } from '../components/alert/index.js';
import { DropletToaster } from '../components/toast/index.js';
import { DropletCard } from '../components/card/index.js';
import { DropletChip } from '../components/chip/index.js';
import { DropletKbd } from '../components/kbd/index.js';
import { DropletDivider } from '../components/divider/index.js';
import { DropletCollapsible } from '../components/collapsible/index.js';
import { DropletAccordion } from '../components/accordion/index.js';
import { DropletTabPanel, DropletTabs } from '../components/tabs/index.js';
import { DropletBreadcrumbs } from '../components/breadcrumbs/index.js';
import { DropletPagination } from '../components/pagination/index.js';
import { DropletResizable } from '../components/resizable/index.js';
import { DropletTooltip } from '../components/tooltip/index.js';
import { DropletPopover } from '../components/popover/index.js';
import { DropletMenuItem, DropletMenu } from '../components/menu/index.js';
import { DropletDialog } from '../components/dialog/index.js';
import { DropletDrawer } from '../components/drawer/index.js';

export class JellyTheme extends DropletTheme {
  static override define (options?: DefineOptions): DefineResult {
    return defineStrict([[LEGACY_TAGS.theme, JellyTheme]], options);
  }
}

export class JellyButton extends DropletButton {
  static override define (options?: DefineOptions): DefineResult {
    return defineStrict([[LEGACY_TAGS.button, JellyButton]], options);
  }
}

export class JellyIconButton extends DropletIconButton {
  static override define (options?: DefineOptions): DefineResult {
    return defineStrict([[LEGACY_TAGS.iconButton, JellyIconButton]], options);
  }
}

export class JellyInput extends DropletInput {
  static override define (options?: DefineOptions): DefineResult {
    return defineStrict([[LEGACY_TAGS.input, JellyInput]], options);
  }
}

export class JellyTextarea extends DropletTextarea {
  static override define (options?: DefineOptions): DefineResult {
    return defineStrict([[LEGACY_TAGS.textarea, JellyTextarea]], options);
  }
}

export class JellyCheckbox extends DropletCheckbox {
  static override define (options?: DefineOptions): DefineResult {
    return defineStrict([[LEGACY_TAGS.checkbox, JellyCheckbox]], options);
  }
}

export class JellyRadio extends DropletRadio {
  static override define (options?: DefineOptions): DefineResult {
    return defineStrict([[LEGACY_TAGS.radio, JellyRadio]], options);
  }
}

export class JellyRadioGroup extends DropletRadioGroup {
  static override define (options?: DefineOptions): DefineResult {
    return defineStrict([[LEGACY_TAGS.radioGroup, JellyRadioGroup]], options);
  }
}

export class JellySwitch extends DropletSwitch {
  static override define (options?: DefineOptions): DefineResult {
    return defineStrict([[LEGACY_TAGS.switch, JellySwitch]], options);
  }
}

export class JellySlider extends DropletSlider {
  static override define (options?: DefineOptions): DefineResult {
    return defineStrict([[LEGACY_TAGS.slider, JellySlider]], options);
  }
}

export class JellyRange extends DropletRange {
  static override define (options?: DefineOptions): DefineResult {
    return defineStrict([[LEGACY_TAGS.range, JellyRange]], options);
  }
}

export class JellySelect extends DropletSelect {
  static override define (options?: DefineOptions): DefineResult {
    return defineStrict([[LEGACY_TAGS.select, JellySelect]], options);
  }
}

export class JellyOption extends DropletOption {
  static override define (options?: DefineOptions): DefineResult {
    return defineStrict([[LEGACY_TAGS.option, JellyOption]], options);
  }
}

export class JellySegmented extends DropletSegmented {
  static override define (options?: DefineOptions): DefineResult {
    return defineStrict([[LEGACY_TAGS.segmented, JellySegmented]], options);
  }
}

export class JellySegment extends DropletSegment {
  static override define (options?: DefineOptions): DefineResult {
    return defineStrict([[LEGACY_TAGS.segment, JellySegment]], options);
  }
}

export class JellyOtp extends DropletOtp {
  static override define (options?: DefineOptions): DefineResult {
    return defineStrict([[LEGACY_TAGS.otp, JellyOtp]], options);
  }
}

export class JellyLabel extends DropletLabel {
  static override define (options?: DefineOptions): DefineResult {
    return defineStrict([[LEGACY_TAGS.label, JellyLabel]], options);
  }
}

export class JellyProgress extends DropletProgress {
  static override define (options?: DefineOptions): DefineResult {
    return defineStrict([[LEGACY_TAGS.progress, JellyProgress]], options);
  }
}

export class JellySpinner extends DropletSpinner {
  static override define (options?: DefineOptions): DefineResult {
    return defineStrict([[LEGACY_TAGS.spinner, JellySpinner]], options);
  }
}

export class JellySkeleton extends DropletSkeleton {
  static override define (options?: DefineOptions): DefineResult {
    return defineStrict([[LEGACY_TAGS.skeleton, JellySkeleton]], options);
  }
}

export class JellyBadge extends DropletBadge {
  static override define (options?: DefineOptions): DefineResult {
    return defineStrict([[LEGACY_TAGS.badge, JellyBadge]], options);
  }
}

export class JellyAlert extends DropletAlert {
  static override define (options?: DefineOptions): DefineResult {
    return defineStrict([[LEGACY_TAGS.alert, JellyAlert]], options);
  }
}

export class JellyToaster extends DropletToaster {
  static override define (options?: DefineOptions): DefineResult {
    return defineStrict([[LEGACY_TAGS.toaster, JellyToaster]], options);
  }
}

export class JellyCard extends DropletCard {
  static override define (options?: DefineOptions): DefineResult {
    return defineStrict([[LEGACY_TAGS.card, JellyCard]], options);
  }
}

export class JellyChip extends DropletChip {
  static override define (options?: DefineOptions): DefineResult {
    return defineStrict([[LEGACY_TAGS.chip, JellyChip]], options);
  }
}

export class JellyKbd extends DropletKbd {
  static override define (options?: DefineOptions): DefineResult {
    return defineStrict([[LEGACY_TAGS.kbd, JellyKbd]], options);
  }
}

export class JellyDivider extends DropletDivider {
  static override define (options?: DefineOptions): DefineResult {
    return defineStrict([[LEGACY_TAGS.divider, JellyDivider]], options);
  }
}

export class JellyCollapsible extends DropletCollapsible {
  static override define (options?: DefineOptions): DefineResult {
    return defineStrict([[LEGACY_TAGS.collapsible, JellyCollapsible]], options);
  }
}

export class JellyAccordion extends DropletAccordion {
  static override define (options?: DefineOptions): DefineResult {
    return defineStrict([[LEGACY_TAGS.accordion, JellyAccordion]], options);
  }
}

export class JellyTabPanel extends DropletTabPanel {
  static override define (options?: DefineOptions): DefineResult {
    return defineStrict([[LEGACY_TAGS.tabPanel, JellyTabPanel]], options);
  }
}

export class JellyTabs extends DropletTabs {
  static override define (options?: DefineOptions): DefineResult {
    return defineStrict([[LEGACY_TAGS.tabs, JellyTabs]], options);
  }
}

export class JellyBreadcrumbs extends DropletBreadcrumbs {
  static override define (options?: DefineOptions): DefineResult {
    return defineStrict([[LEGACY_TAGS.breadcrumbs, JellyBreadcrumbs]], options);
  }
}

export class JellyPagination extends DropletPagination {
  static override define (options?: DefineOptions): DefineResult {
    return defineStrict([[LEGACY_TAGS.pagination, JellyPagination]], options);
  }
}

export class JellyResizable extends DropletResizable {
  static override define (options?: DefineOptions): DefineResult {
    return defineStrict([[LEGACY_TAGS.resizable, JellyResizable]], options);
  }
}

export class JellyTooltip extends DropletTooltip {
  static override define (options?: DefineOptions): DefineResult {
    return defineStrict([[LEGACY_TAGS.tooltip, JellyTooltip]], options);
  }
}

export class JellyPopover extends DropletPopover {
  static override define (options?: DefineOptions): DefineResult {
    return defineStrict([[LEGACY_TAGS.popover, JellyPopover]], options);
  }
}

export class JellyMenuItem extends DropletMenuItem {
  static override define (options?: DefineOptions): DefineResult {
    return defineStrict([[LEGACY_TAGS.menuItem, JellyMenuItem]], options);
  }
}

export class JellyMenu extends DropletMenu {
  static override define (options?: DefineOptions): DefineResult {
    return defineStrict([[LEGACY_TAGS.menu, JellyMenu]], options);
  }
}

export class JellyDialog extends DropletDialog {
  static override define (options?: DefineOptions): DefineResult {
    return defineStrict([[LEGACY_TAGS.dialog, JellyDialog]], options);
  }
}

export class JellyDrawer extends DropletDrawer {
  static override define (options?: DefineOptions): DefineResult {
    return defineStrict([[LEGACY_TAGS.drawer, JellyDrawer]], options);
  }
}

const LEGACY_REGISTRATION: ReadonlyArray<DefineEntry> = [
  [LEGACY_TAGS.theme, JellyTheme],
  [LEGACY_TAGS.button, JellyButton],
  [LEGACY_TAGS.iconButton, JellyIconButton],
  [LEGACY_TAGS.input, JellyInput],
  [LEGACY_TAGS.textarea, JellyTextarea],
  [LEGACY_TAGS.checkbox, JellyCheckbox],
  [LEGACY_TAGS.radio, JellyRadio],
  [LEGACY_TAGS.radioGroup, JellyRadioGroup],
  [LEGACY_TAGS.switch, JellySwitch],
  [LEGACY_TAGS.slider, JellySlider],
  [LEGACY_TAGS.range, JellyRange],
  [LEGACY_TAGS.select, JellySelect],
  [LEGACY_TAGS.option, JellyOption],
  [LEGACY_TAGS.segmented, JellySegmented],
  [LEGACY_TAGS.segment, JellySegment],
  [LEGACY_TAGS.otp, JellyOtp],
  [LEGACY_TAGS.label, JellyLabel],
  [LEGACY_TAGS.progress, JellyProgress],
  [LEGACY_TAGS.spinner, JellySpinner],
  [LEGACY_TAGS.skeleton, JellySkeleton],
  [LEGACY_TAGS.badge, JellyBadge],
  [LEGACY_TAGS.alert, JellyAlert],
  [LEGACY_TAGS.toaster, JellyToaster],
  [LEGACY_TAGS.card, JellyCard],
  [LEGACY_TAGS.chip, JellyChip],
  [LEGACY_TAGS.kbd, JellyKbd],
  [LEGACY_TAGS.divider, JellyDivider],
  [LEGACY_TAGS.collapsible, JellyCollapsible],
  [LEGACY_TAGS.accordion, JellyAccordion],
  [LEGACY_TAGS.tabPanel, JellyTabPanel],
  [LEGACY_TAGS.tabs, JellyTabs],
  [LEGACY_TAGS.breadcrumbs, JellyBreadcrumbs],
  [LEGACY_TAGS.pagination, JellyPagination],
  [LEGACY_TAGS.resizable, JellyResizable],
  [LEGACY_TAGS.tooltip, JellyTooltip],
  [LEGACY_TAGS.popover, JellyPopover],
  [LEGACY_TAGS.menuItem, JellyMenuItem],
  [LEGACY_TAGS.menu, JellyMenu],
  [LEGACY_TAGS.dialog, JellyDialog],
  [LEGACY_TAGS.drawer, JellyDrawer],
];

// The canonical batch comes too, since tabs, pagination, and the toaster create
// canonical children; warns and skips a foreign owner like the root entry
export function defineCompat (options: DefineOptions = {}): DefineResult {
  return defineElements([...REGISTRATION, ...LEGACY_REGISTRATION], { ...options, strict: options.strict ?? false });
}

declare global {
  interface HTMLElementTagNameMap {
    'jelly-theme': JellyTheme;
    'jelly-button': JellyButton;
    'jelly-icon-button': JellyIconButton;
    'jelly-input': JellyInput;
    'jelly-textarea': JellyTextarea;
    'jelly-checkbox': JellyCheckbox;
    'jelly-radio': JellyRadio;
    'jelly-radio-group': JellyRadioGroup;
    'jelly-switch': JellySwitch;
    'jelly-slider': JellySlider;
    'jelly-range': JellyRange;
    'jelly-select': JellySelect;
    'jelly-option': JellyOption;
    'jelly-segmented': JellySegmented;
    'jelly-segment': JellySegment;
    'jelly-otp': JellyOtp;
    'jelly-label': JellyLabel;
    'jelly-progress': JellyProgress;
    'jelly-spinner': JellySpinner;
    'jelly-skeleton': JellySkeleton;
    'jelly-badge': JellyBadge;
    'jelly-alert': JellyAlert;
    'jelly-toaster': JellyToaster;
    'jelly-card': JellyCard;
    'jelly-chip': JellyChip;
    'jelly-kbd': JellyKbd;
    'jelly-divider': JellyDivider;
    'jelly-collapsible': JellyCollapsible;
    'jelly-accordion': JellyAccordion;
    'jelly-tab-panel': JellyTabPanel;
    'jelly-tabs': JellyTabs;
    'jelly-breadcrumbs': JellyBreadcrumbs;
    'jelly-pagination': JellyPagination;
    'jelly-resizable': JellyResizable;
    'jelly-tooltip': JellyTooltip;
    'jelly-popover': JellyPopover;
    'jelly-menu-item': JellyMenuItem;
    'jelly-menu': JellyMenu;
    'jelly-dialog': JellyDialog;
    'jelly-drawer': JellyDrawer;
  }
}
