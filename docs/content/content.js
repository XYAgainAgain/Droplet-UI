/*
 * Jelly UI documentation content — the hand-authored source, one descriptor
 * per component. This is the file you EDIT.
 *
 * `npm run docs` reconciles these descriptors against custom-elements.json
 * (the Custom Elements Manifest generated from the component TypeScript + its
 * JSDoc) and emits the generated docs/data.js the pages actually render. The
 * reconciler warns whenever a component gains or loses an attribute, event,
 * slot, CSS part or custom property that isn't reflected here, so the docs
 * can't silently drift out of sync with the source.
 *
 * Curated prose (summaries, descriptions, examples, keyboard maps, methods and
 * properties) lives here; attribute/event/slot/part/token TYPES are sourced
 * from the manifest at build time. To document a new component, add a
 * descriptor; to update prose, edit it here, then run `npm run docs`.
 */

// The order component groups appear in the sidebar and on the page
export const GROUP_ORDER = ["Theming","Actions","Forms","Feedback","Surfaces","Navigation","Overlays"];

export const COMPONENTS = [
  {
    "tag": "jelly-theme",
    "group": "Theming",
    "summary": "A theme provider that scopes the Jelly design tokens to its subtree: force light or dark, follow the OS, or re-tint the accent.",
    "description": "The provider is layout-neutral (`display: contents`). It scopes the complete token set through its shadow-host stylesheet, and canvas-painted components resolve those inherited tokens at draw time, so mode and accent changes repaint the subtree live. Inline token overrides on the provider still take precedence.",
    "attributes": [
      {
        "name": "mode",
        "type": "\"light\" | \"dark\" | \"auto\"",
        "default": "auto",
        "description": "The color scheme for this subtree. auto follows the operating system and updates live when it changes."
      },
      {
        "name": "accent",
        "type": "palette name | CSS color",
        "description": "Overrides --jelly-color-background-accent for the subtree. A palette name (e.g. \"mint\") maps through the active token set; any valid CSS color is used directly, including alpha-bearing colors. Invalid colors fall back to the theme accent."
      }
    ],
    "properties": [
      {
        "name": "mode",
        "type": "string",
        "description": "The requested mode (reflects the attribute)."
      },
      {
        "name": "accent",
        "type": "string | null",
        "description": "The re-tinted accent hue for this subtree (reflects the attribute)."
      },
      {
        "name": "resolvedMode",
        "type": "\"light\" | \"dark\"",
        "description": "Read-only: the mode in effect right now, with auto resolved against the OS."
      }
    ],
    "methods": [
      {
        "signature": "sync()",
        "description": "Re-applies the resolved token set (called automatically on attribute and OS scheme changes)."
      }
    ],
    "events": [],
    "slots": [
      {
        "name": "(default)",
        "description": "The subtree to theme."
      }
    ],
    "parts": [],
    "cssProperties": [
      {
        "name": "--jelly-color-*",
        "description": "Every global token can be overridden inline on the provider (e.g. style=\"--jelly-color-background-azure: #4F46E5\")."
      }
    ],
    "keyboard": [],
    "examples": [
      {
        "title": "Scoped dark mode",
        "code": "<jelly-theme mode=\"dark\">\n  <jelly-card style=\"padding: 4px\">\n    <jelly-button variant=\"mint\">Dark-token subtree</jelly-button>\n  </jelly-card>\n</jelly-theme>"
      },
      {
        "title": "Custom accent",
        "code": "<jelly-theme mode=\"auto\" accent=\"#7C3AED\">\n  <jelly-slider value=\"60\"></jelly-slider>\n</jelly-theme>"
      }
    ]
  },
  {
    "tag": "jelly-button",
    "group": "Actions",
    "summary": "A capsule-shaped soft-body button with a real native <button> inside for keyboard and screen-reader support.",
    "description": "The jelly membrane is painted on a canvas behind a shadow-DOM <button>, so activation, focus and ARIA semantics are fully native. Pointer presses dent the membrane under the finger and follow it; Enter/Space squish it from the center. click events bubble out composed and type=\"submit\"/\"reset\" drive the owner <form> (the nearest ancestor, or the one named by form=), submitting with this button's name, value, and form* overrides. The host is form-associated, so :disabled matches it and a disabled <fieldset> disables it.",
    "attributes": [
      {
        "name": "feel",
        "type": "string (a registered feel preset name; \"gel\" ships in Phase 1)",
        "default": "gel, or the nearest data-droplet-feel scope",
        "description": "Physics preset driving the soft body. Inherits from the closest ancestor carrying data-droplet-feel; the element attribute wins. Unknown names fall back to gel with one console warning per name. Register your own with registerPreset('feel', name, record)."
      },
      {
        "name": "quality",
        "type": "\"low\" | \"medium\" | \"high\" (accepts \"lo\" | \"med\" | \"md\" | \"hi\", canonicalized on connect)",
        "default": "medium, or the nearest data-droplet-quality scope",
        "description": "Caps physics cost: low limits the membrane to 120 samples and 2 normal-blend passes. Inherits from the closest ancestor carrying data-droplet-quality; the element attribute wins."
      },
      {
        "name": "variant",
        "type": "\"azure\" | \"white\" | \"rose\" | \"amber\" | \"mint\" | \"platinum\" | \"graphite\"",
        "default": "theme accent (azure when uncustomized)",
        "description": "Fill/label color pair, resolved through theme tokens so the same markup adapts to dark mode. Omitting variant uses the accent/on-accent pair; explicit variants use their own contrast pair."
      },
      {
        "name": "size",
        "type": "\"small\" | \"medium\" | \"large\" (accepts \"sm\" | \"md\" | \"lg\", canonicalized on connect)",
        "default": "medium",
        "description": "Size scale: heights 42 / 62 / 72px with matching min-width, inline padding and font size."
      },
      {
        "name": "disabled",
        "type": "boolean",
        "description": "Disables the inner native button, removes it from the tab order, dims the host to 55% opacity and blocks pointer events."
      },
      {
        "name": "type",
        "type": "\"button\" | \"submit\" | \"reset\"",
        "default": "button",
        "description": "Button behavior. submit/reset drive the owner <form> (requestSubmit() with a native stand-in submitter / reset()). Observed live."
      },
      {
        "name": "label",
        "type": "string",
        "description": "Accessible name mapped to aria-label on the inner native button, for icon-only buttons whose slotted content has no text. Observed live; removing the attribute removes the aria-label."
      },
      {
        "name": "block",
        "type": "boolean",
        "description": "Renders the button as a full-width block element."
      },
      {
        "name": "shape",
        "type": "\"pill\" | \"square\"",
        "default": "pill",
        "description": "Membrane silhouette. \"square\" swaps the pill for a smaller rounded-rectangle radius (0.32 × height, matching jelly-icon-button's default square); any other value (or none) keeps the full pill. Observed live — changing it reshapes the membrane in place."
      },
      {
        "name": "name",
        "type": "string",
        "description": "Submitted as name=value when this button submits its form. A native stand-in button carries it, so SubmitEvent.submitter and new FormData(form, event.submitter) include it (read the FormData synchronously inside the submit listener)."
      },
      {
        "name": "value",
        "type": "string",
        "description": "Value paired with name in the submission."
      },
      {
        "name": "form",
        "type": "string",
        "description": "ID of the owner <form> when the button sits outside it; without it the nearest ancestor form owns the button."
      },
      {
        "name": "formaction",
        "type": "string (URL)",
        "description": "Per-submitter override of the form's action, as on a native submit button; applies only when this button submits."
      },
      {
        "name": "formmethod",
        "type": "\"get\" | \"post\" | \"dialog\"",
        "description": "Per-submitter override of the form's method, as on a native submit button; applies only when this button submits."
      },
      {
        "name": "formenctype",
        "type": "string",
        "description": "Per-submitter override of the form's enctype, as on a native submit button; applies only when this button submits."
      },
      {
        "name": "formtarget",
        "type": "string",
        "description": "Per-submitter override of the form's target, as on a native submit button; applies only when this button submits."
      },
      {
        "name": "formnovalidate",
        "type": "boolean",
        "description": "Submits without running constraint validation, as on a native submit button."
      }
    ],
    "events": [
      {
        "name": "click",
        "description": "The native activation event from the inner button, re-targeted to the host (composed, bubbles). Fires on pointer tap or Enter/Space.",
        "detail": "None — a native PointerEvent/MouseEvent, not a CustomEvent."
      }
    ],
    "properties": [
      {
        "name": "button",
        "type": "HTMLButtonElement",
        "description": "The inner native shadow-DOM button (available after first connect)."
      }
    ],
    "methods": [
      {
        "signature": "focus(options?: FocusOptions): void",
        "description": "Routes programmatic focus into the inner native button (host focus is also delegated automatically)."
      }
    ],
    "slots": [
      {
        "name": "(default)",
        "description": "Button content: text label and/or icon elements (slotted svg/img are pointer-events: none so presses always land on the button)."
      }
    ],
    "parts": [
      {
        "name": "button",
        "description": "The inner native <button> element."
      },
      {
        "name": "jelly",
        "description": "The canvas the soft body is painted on (from the JellyElement base)."
      }
    ],
    "cssProperties": [
      {
        "name": "--jelly-button-height",
        "default": "62px (42px small, 72px large)",
        "description": "Height of the inner button."
      },
      {
        "name": "--jelly-button-radius",
        "default": "999px (pill); shape=\"square\" is 0.32 x height",
        "description": "Corner radius of the painted surface (a plain-px value overrides the shape)."
      },
      {
        "name": "--jelly-button-min-width",
        "default": "168px (42px small, 200px large)",
        "description": "Minimum width of the inner button."
      },
      {
        "name": "--jelly-button-padding-inline",
        "default": "30px (16px small, 38px large)",
        "description": "Logical horizontal padding of the inner button."
      },
      {
        "name": "--jelly-button-font-size",
        "default": "16px (14px small, 18px large)",
        "description": "Label font size."
      },
      {
        "name": "--jelly-button-gap",
        "default": "9px",
        "description": "Flex gap between slotted icon and label content."
      },
      {
        "name": "--jelly-fill",
        "default": "var(--jelly-color-background-accent, #0077CC)",
        "description": "Consumed shared token: the membrane fill color, set by the variant attribute; override to tint a single button."
      },
      {
        "name": "--jelly-label",
        "default": "var(--jelly-color-foreground-on-accent, #FFFFFF)",
        "description": "Consumed shared token: the label text color paired with the fill by the variant attribute."
      },
      {
        "name": "--jelly-ring",
        "default": "var(--jelly-fill, var(--jelly-color-border-focus, #0077CC))",
        "description": "Consumed shared token: the canvas-painted focus-ring color; defaults to the fill so the ring matches the button."
      }
    ],
    "keyboard": [
      {
        "keys": "Tab / Shift+Tab",
        "description": "Moves focus to / away from the button (host focus is delegated to the inner native button; a wobbling ring is painted on the canvas when focus is keyboard-visible)."
      },
      {
        "keys": "Enter / Space",
        "description": "Press-and-hold squishes the jelly from the center with a haptic tick; releasing lets it spring back and fires click (native button activation)."
      }
    ],
    "examples": [
      {
        "title": "Basic buttons",
        "code": "<jelly-button>Create account</jelly-button>\n<jelly-button variant=\"rose\" size=\"small\">Delete</jelly-button>\n<jelly-button variant=\"platinum\" size=\"large\" disabled>Unavailable</jelly-button>"
      },
      {
        "title": "Driving a form",
        "code": "<form onsubmit=\"event.preventDefault(); this.querySelector('output').value = 'Submitted!'\">\n  <jelly-input name=\"email\" type=\"email\" label=\"Email\" placeholder=\"you@example.com\"></jelly-input>\n  <jelly-button type=\"submit\" variant=\"mint\">Save</jelly-button>\n  <jelly-button type=\"reset\" variant=\"platinum\">Reset</jelly-button>\n  <output></output>\n</form>"
      },
      {
        "title": "Full-width block button",
        "code": "<div style=\"max-width: 360px\">\n  <jelly-button block size=\"large\">Continue</jelly-button>\n</div>"
      }
    ]
  },
  {
    "tag": "jelly-icon-button",
    "group": "Actions",
    "summary": "A compact square or round soft-body button sized for a single icon, named for screen readers via its label attribute.",
    "description": "A real <button> in the shadow DOM carries keyboard and ARIA semantics while the jelly is painted behind it. shape=\"circle\" reshapes the membrane into a full circle (radius = size / 2) in place — the box size is unchanged, so the canvas never flickers. Give every icon-only button a label so assistive technology has an accessible name.",
    "attributes": [
      {
        "name": "label",
        "type": "string",
        "description": "Accessible name mapped to aria-label on the inner native button. Strongly recommended: the slotted icon usually has no text alternative. Observed live; removing the attribute removes the aria-label."
      },
      {
        "name": "shape",
        "type": "\"circle\" | \"square\"",
        "default": "square (rounded, radius = 0.32 × size)",
        "description": "Membrane silhouette. \"circle\" rounds the soft body to a full circle; \"square\" (or omitting the attribute) keeps the rounded square — the same vocabulary jelly-button and jelly-badge use. Observed live — changing it reshapes the membrane in place."
      },
      {
        "name": "variant",
        "type": "\"azure\" | \"white\" | \"rose\" | \"amber\" | \"mint\" | \"platinum\" | \"graphite\"",
        "default": "theme accent (azure when uncustomized)",
        "description": "Fill/label color pair, resolved through theme tokens so the same markup adapts to dark mode. Omitting variant uses accent/on-accent."
      },
      {
        "name": "size",
        "type": "\"small\" | \"medium\" | \"large\" (accepts \"sm\" | \"md\" | \"lg\", canonicalized on connect)",
        "default": "medium",
        "description": "Size scale: 40 / 48 / 56px square with matching corner radius, font size and slotted-svg icon size. All sizes exceed the 24px minimum target size."
      },
      {
        "name": "disabled",
        "type": "boolean",
        "description": "Disables the inner native button, removes it from the tab order, dims the host to 55% opacity and blocks pointer events."
      },
      {
        "name": "name",
        "type": "string",
        "description": "Form control name, reflected by the name property. An icon button is form-associated (so :disabled and disabled fieldsets work) but never submits a value."
      }
    ],
    "events": [
      {
        "name": "click",
        "description": "The native activation event from the inner button, re-targeted to the host (composed, bubbles). Fires on pointer tap or Enter/Space.",
        "detail": "None — a native PointerEvent/MouseEvent, not a CustomEvent."
      }
    ],
    "properties": [
      {
        "name": "button",
        "type": "HTMLButtonElement",
        "description": "The inner native shadow-DOM button (available after first connect)."
      }
    ],
    "methods": [
      {
        "signature": "focus(options?: FocusOptions): void",
        "description": "Routes programmatic focus into the inner native button (host focus is also delegated automatically)."
      }
    ],
    "slots": [
      {
        "name": "(default)",
        "description": "The icon: an emoji/text glyph or an <svg> (slotted svg is auto-sized via --jelly-icon-button-icon-size)."
      }
    ],
    "parts": [
      {
        "name": "button",
        "description": "The inner native <button> element."
      },
      {
        "name": "jelly",
        "description": "The canvas the soft body is painted on (from the JellyElement base)."
      }
    ],
    "cssProperties": [
      {
        "name": "--jelly-icon-button-size",
        "default": "48px (40px small, 56px large)",
        "description": "Width and height of the inner square button."
      },
      {
        "name": "--jelly-icon-button-radius",
        "default": "16px (13px small, 18px large)",
        "description": "Corner radius of the inner button and its forced-colors focus outline."
      },
      {
        "name": "--jelly-icon-button-font-size",
        "default": "18px (16px small, 20px large)",
        "description": "Font size for text/emoji icons."
      },
      {
        "name": "--jelly-icon-button-icon-size",
        "default": "20px (18px small, 23px large)",
        "description": "Width and height applied to a slotted <svg> icon."
      },
      {
        "name": "--jelly-fill",
        "default": "var(--jelly-color-background-accent, #0077CC)",
        "description": "Consumed shared token: the membrane fill color, set by the variant attribute."
      },
      {
        "name": "--jelly-label",
        "default": "var(--jelly-color-foreground-on-accent, #FFFFFF)",
        "description": "Consumed shared token: the icon/glyph color paired with the fill by the variant attribute."
      },
      {
        "name": "--jelly-ring",
        "default": "var(--jelly-fill, var(--jelly-color-border-focus, #0077CC))",
        "description": "Consumed shared token: the canvas-painted focus-ring color; defaults to the fill so the ring matches the button."
      }
    ],
    "keyboard": [
      {
        "keys": "Tab / Shift+Tab",
        "description": "Moves focus to / away from the button (host focus is delegated to the inner native button; a wobbling ring is painted on the canvas when focus is keyboard-visible)."
      },
      {
        "keys": "Enter / Space",
        "description": "Press-and-hold squishes the jelly from the center with a haptic tick; releasing lets it spring back and fires click (native button activation)."
      }
    ],
    "examples": [
      {
        "title": "Icon buttons with the built-in Fluent icons",
        "code": "<jelly-icon-button id=\"search\" label=\"Search\"></jelly-icon-button>\n<jelly-icon-button id=\"favorite\" label=\"Favorite\" variant=\"rose\"></jelly-icon-button>\n<jelly-icon-button id=\"settings\" label=\"Settings\" variant=\"graphite\" size=\"large\"></jelly-icon-button>\n\n<script type=\"module\">\n  import { jellyIcon } from './package.js';\n\n  search.innerHTML   = jellyIcon('search');\n  favorite.innerHTML = jellyIcon('heart');\n  settings.innerHTML = jellyIcon('settings');\n</script>"
      },
      {
        "title": "Circle shape",
        "code": "<jelly-icon-button id=\"close\" label=\"Close\" shape=\"circle\" variant=\"platinum\"></jelly-icon-button>\n\n<script type=\"module\">\n  import { jellyIcon } from './package.js';\n\n  close.innerHTML = jellyIcon('dismiss', { size: 16 });\n</script>"
      },
      {
        "title": "Any inline SVG works as the icon",
        "code": "<jelly-icon-button label=\"Custom\">\n  <svg viewBox=\"0 0 24 24\" width=\"20\" height=\"20\" fill=\"currentColor\" aria-hidden=\"true\">\n    <path d=\"…\" />\n  </svg>\n</jelly-icon-button>"
      }
    ]
  },
  {
    "tag": "jelly-checkbox",
    "group": "Forms",
    "summary": "A squishy, form-associated checkbox with checked and mixed (indeterminate) states, painted as a soft jelly square that pops when toggled.",
    "description": "A visually-hidden native <input type=\"checkbox\"> carries focus, keyboard behavior and the form value (via ElementInternals), while the jelly square is painted on a canvas behind it. The check mark draws itself on with a dash sweep and overshoot; the indeterminate state shows a dash and reports aria-checked=\"mixed\", clearing on any user toggle.",
    "attributes": [
      {
        "name": "checked",
        "type": "boolean",
        "default": "false",
        "description": "Whether the checkbox is checked. Reflected; updated by user toggles."
      },
      {
        "name": "indeterminate",
        "type": "boolean",
        "default": "false",
        "description": "Mixed state: shows a dash mark and reports aria-checked=\"mixed\" via the native input. Cleared automatically when the user toggles."
      },
      {
        "name": "disabled",
        "type": "boolean",
        "default": "false",
        "description": "Disables the control: dimmed, removed from the tab order, ignores pointer input."
      },
      {
        "name": "size",
        "type": "'small' | 'medium' | 'large'",
        "default": "medium",
        "description": "Size scale (box 28 / 32 / 38 px). The sm / md / lg aliases are accepted and canonicalized in place."
      },
      {
        "name": "value",
        "type": "string",
        "default": "on",
        "description": "The form value submitted while checked (nothing is submitted when unchecked)."
      },
      {
        "name": "name",
        "type": "string",
        "description": "Form field name used on submission (native form association through ElementInternals)."
      },
      {
        "name": "variant",
        "type": "\"azure\" | \"white\" | \"rose\" | \"amber\" | \"mint\" | \"platinum\" | \"graphite\"",
        "default": "(accent)",
        "description": "The checked fill hue, resolved through theme tokens. Unset, the theme accent is used."
      },
      {
        "name": "label",
        "type": "string",
        "description": "Explicit accessible name mapped to the inner input's aria-label; overrides the slotted text for assistive technology."
      }
    ],
    "properties": [
      {
        "name": "checked",
        "type": "boolean",
        "description": "Gets/sets the checked state (reflects the attribute)."
      },
      {
        "name": "indeterminate",
        "type": "boolean",
        "description": "Gets/sets the mixed state (reflects the attribute)."
      },
      {
        "name": "value",
        "type": "string",
        "description": "Gets/sets the submitted form value; defaults to \"on\"."
      }
    ],
    "methods": [
      {
        "signature": "focus(options?: FocusOptions): void",
        "description": "Moves focus to the hidden native input."
      }
    ],
    "events": [
      {
        "name": "change",
        "detail": "null",
        "description": "Fired after every user toggle (composed, bubbling). Not fired for programmatic changes."
      }
    ],
    "slots": [
      {
        "name": "(default)",
        "description": "The visible label text, rendered next to the box and included in the click target and accessible name."
      }
    ],
    "parts": [
      {
        "name": "wrap",
        "description": "The <label> row wrapping box and text."
      },
      {
        "name": "input",
        "description": "The visually-hidden native checkbox input."
      },
      {
        "name": "jelly",
        "description": "The canvas the jelly square is painted on."
      }
    ],
    "cssProperties": [
      {
        "name": "--jelly-checkbox-size",
        "default": "32px",
        "description": "Width and height of the box (28 / 32 / 38 px across sizes)."
      },
      {
        "name": "--jelly-checkbox-gap",
        "default": "11px",
        "description": "Gap between the box and the label text."
      },
      {
        "name": "--jelly-checkbox-font-size",
        "default": "15.5px",
        "description": "Label font size."
      },
      {
        "name": "--jelly-checkbox-radius",
        "default": "13px",
        "description": "Corner radius used by the forced-colors border and focus-ring fallback."
      },
      {
        "name": "--jelly-checkbox-stroke-width",
        "default": "3.4",
        "description": "Stroke width of the check / dash mark."
      },
      {
        "name": "--jelly-checkbox-mark",
        "default": "var(--jelly-color-foreground-on-accent, #FFFFFF)",
        "description": "Color of the check and dash marks; variants pair it with the fill hue."
      },
      {
        "name": "--jelly-fill",
        "default": "var(--jelly-color-background-neutral, #DADADA)",
        "description": "Unchecked box fill (shared token)."
      },
      {
        "name": "--jelly-on",
        "default": "var(--jelly-color-background-accent, #0077CC)",
        "description": "Checked / indeterminate box fill (shared token)."
      },
      {
        "name": "--jelly-ring",
        "default": "var(--jelly-on, var(--jelly-color-border-focus, #0077CC))",
        "description": "Keyboard focus ring color painted on the canvas (shared token)."
      },
      {
        "name": "--jelly-label",
        "default": "var(--jelly-color-foreground-muted, #5D6474)",
        "description": "Label text color (shared token)."
      }
    ],
    "keyboard": [
      {
        "keys": "Space",
        "description": "Toggles the checkbox (native input behavior); a mixed state resolves to checked/unchecked."
      },
      {
        "keys": "Tab / Shift+Tab",
        "description": "Moves focus in and out; the jiggling canvas focus ring shows on keyboard focus."
      }
    ],
    "examples": [
      {
        "title": "Basic",
        "code": "<jelly-checkbox checked>Remember me</jelly-checkbox>"
      },
      {
        "title": "Indeterminate \"select all\"",
        "code": "<jelly-checkbox indeterminate id=\"all\">Select all</jelly-checkbox>\n<script>\n  document.getElementById('all').addEventListener('change', (e) => {\n    console.log('resolved to', e.target.checked);\n  });\n</script>"
      },
      {
        "title": "Sizes, variant and form value",
        "code": "<form>\n  <jelly-checkbox name=\"tos\" value=\"accepted\" size=\"large\" variant=\"mint\">Accept terms</jelly-checkbox>\n</form>"
      }
    ]
  },
  {
    "tag": "jelly-input",
    "group": "Forms",
    "summary": "A single-line text field on a soft jelly surface: focus lifts and rings the membrane and each keystroke ripples the surface at the caret.",
    "description": "Wraps a real native <input> over the canvas-painted jelly body, so keyboard, IME and assistive-technology behavior are native. Form-associated via ElementInternals, so it submits with a `name` like any built-in field. Caret ripples are measured in the input's own font and are direction-aware, landing under the caret in both LTR and RTL.",
    "attributes": [
      {
        "name": "value",
        "type": "string",
        "default": "\"\"",
        "description": "The text value. Setting the attribute replaces the inner input's value and updates the submitted form value."
      },
      {
        "name": "placeholder",
        "type": "string",
        "description": "Hint text shown while empty, rendered in the muted text token color."
      },
      {
        "name": "type",
        "type": "string",
        "default": "text",
        "description": "Native input type (text, email, password, search, ...). Password fields measure bullet glyphs for the caret ripple."
      },
      {
        "name": "label",
        "type": "string",
        "description": "Accessible name for the field, mapped to aria-label on the inner native input. Use it whenever there is no visible <label>."
      },
      {
        "name": "name",
        "type": "string",
        "description": "Form field name used on submission (native form association through ElementInternals)."
      },
      {
        "name": "disabled",
        "type": "boolean",
        "default": "false",
        "description": "Disables the inner input, removes it from the tab order and paints the surface with the platinum token."
      },
      {
        "name": "readonly",
        "type": "boolean",
        "default": "false",
        "description": "Makes the inner input read-only while keeping it focusable."
      },
      {
        "name": "autocomplete",
        "type": "string",
        "description": "Forwarded to the inner input's autocomplete (ignored while no-autofill is set)."
      },
      {
        "name": "no-autofill",
        "type": "boolean",
        "default": "false",
        "description": "Suppresses autofill: sets autocomplete=\"off\", disables autocorrect/autocapitalize/spellcheck and sets the opt-out attributes common password managers respect (data-lpignore, data-1p-ignore, data-bwignore, data-form-type)."
      },
      {
        "name": "size",
        "type": "\"small\" | \"medium\" | \"large\"",
        "default": "medium",
        "description": "Size scale (host 220x46 / 280x56 / 340x64). The sm/md/lg aliases are accepted and canonicalized in place, including on dynamic changes."
      },
      {
        "name": "required",
        "type": "boolean",
        "description": "Forwarded to the inner native control and enforced through constraint validation (validity, checkValidity(), :invalid, :state(user-invalid)). An empty field is valueMissing."
      },
      {
        "name": "minlength",
        "type": "number",
        "description": "Forwarded to the inner native control and enforced through constraint validation (validity, checkValidity(), :invalid, :state(user-invalid)). Shorter user-entered text is tooShort."
      },
      {
        "name": "maxlength",
        "type": "number",
        "description": "Forwarded to the inner native control and enforced through constraint validation (validity, checkValidity(), :invalid, :state(user-invalid)). The inner input stops accepting text past this length."
      },
      {
        "name": "pattern",
        "type": "string (regular expression)",
        "description": "Forwarded to the inner native control and enforced through constraint validation (validity, checkValidity(), :invalid, :state(user-invalid)). A value that does not match the whole pattern is patternMismatch."
      },
      {
        "name": "min",
        "type": "string",
        "description": "Forwarded to the inner native control and enforced through constraint validation (validity, checkValidity(), :invalid, :state(user-invalid)). Lower bound for number, range, and date/time types."
      },
      {
        "name": "max",
        "type": "string",
        "description": "Forwarded to the inner native control and enforced through constraint validation (validity, checkValidity(), :invalid, :state(user-invalid)). Upper bound for number, range, and date/time types."
      },
      {
        "name": "step",
        "type": "string",
        "description": "Forwarded to the inner native control and enforced through constraint validation (validity, checkValidity(), :invalid, :state(user-invalid)). Step granularity for number, range, and date/time types."
      },
      {
        "name": "inputmode",
        "type": "string",
        "description": "Virtual keyboard hint, forwarded to the inner input."
      },
      {
        "name": "enterkeyhint",
        "type": "string",
        "description": "Label hint for the virtual keyboard Enter key, forwarded to the inner input."
      }
    ],
    "events": [
      {
        "name": "input",
        "detail": "null",
        "description": "Re-dispatched from the host as a composed, bubbling CustomEvent on every edit, after the form value is updated."
      },
      {
        "name": "change",
        "detail": "null",
        "description": "Re-dispatched from the host as a composed, bubbling CustomEvent when the value is committed (native change does not cross the shadow boundary)."
      }
    ],
    "slots": [],
    "properties": [
      {
        "name": "value",
        "type": "string",
        "description": "Read/write text value; setting it also updates the submitted form value (live from the inner control once built)."
      }
    ],
    "methods": [
      {
        "signature": "focus(options?: FocusOptions)",
        "description": "Routes programmatic focus into the inner native input."
      }
    ],
    "parts": [
      {
        "name": "jelly",
        "description": "The canvas that paints the soft body, fill, border and focus ring (from the JellyElement base)."
      },
      {
        "name": "input",
        "description": "The inner native <input>."
      },
      {
        "name": "ring",
        "description": "The forced-colors fallback focus-ring element (transparent otherwise; the real ring is canvas-painted)."
      }
    ],
    "cssProperties": [
      {
        "name": "--jelly-input-padding-inline",
        "default": "20px (16px small, 24px large)",
        "description": "Inline padding of the text box."
      },
      {
        "name": "--jelly-input-font-size",
        "default": "16px (14.5px small, 17px large)",
        "description": "Font size of the field text."
      },
      {
        "name": "--jelly-input-radius",
        "default": "16px (14px small, 18px large)",
        "description": "Corner radius of the forced-colors fallback ring (the canvas shape radius is derived from the host height)."
      },
      {
        "name": "--jelly-fill",
        "default": "var(--jelly-color-background-muted, #F4F5F7)",
        "description": "Resting surface fill read by the canvas at paint time; flips with the theme. Focus paints var(--jelly-color-background-surface), disabled paints var(--jelly-color-background-neutral)."
      },
      {
        "name": "--jelly-label",
        "default": "var(--jelly-color-foreground-default, #1F2430)",
        "description": "Text color of the field. Placeholder uses var(--jelly-color-foreground-muted)."
      },
      {
        "name": "--jelly-accent",
        "default": "var(--jelly-color-background-accent, #0077CC)",
        "description": "Focused border and ring hue; retint per subtree via <jelly-theme accent>."
      },
      {
        "name": "--jelly-ring",
        "default": "var(--jelly-accent, var(--jelly-color-border-focus, #0077CC))",
        "description": "Focus ring color painted on the canvas (softened with color-mix)."
      }
    ],
    "keyboard": [
      {
        "keys": "Tab / Shift+Tab",
        "description": "Moves focus into / out of the field (host focus is delegated to the inner input); focus pops the membrane and shows the ring."
      },
      {
        "keys": "Printable keys, Backspace, Delete",
        "description": "Native text editing; each edit ripples the membrane at the caret, direction-aware in RTL."
      },
      {
        "keys": "Arrow keys / Home / End",
        "description": "Native caret movement inside the field, honoring the text direction."
      }
    ],
    "examples": [
      {
        "title": "Email field in a form",
        "code": "<form>\n  <jelly-input label=\"Email\" type=\"email\" name=\"email\" placeholder=\"you@example.com\"></jelly-input>\n</form>"
      },
      {
        "title": "Invite code without autofill",
        "code": "<jelly-input size=\"large\" label=\"Invite code\" placeholder=\"Invite code\" no-autofill></jelly-input>"
      },
      {
        "title": "RTL field (ripples follow the caret)",
        "code": "<div dir=\"rtl\">\n  <jelly-input label=\"שם מלא\" placeholder=\"שם מלא\"></jelly-input>\n</div>"
      }
    ]
  },
  {
    "tag": "jelly-label",
    "group": "Forms",
    "summary": "A form label that pairs with any control via `for`: clicking focuses the target and the text becomes its accessible name.",
    "description": "Idrefs cannot cross shadow roots, so the label pushes its text into the target's `label` attribute — every Jelly form control maps that to an inner aria-label. Required state renders an asterisk plus screen-reader-only \"(required)\" text and sets aria-required on the target.",
    "attributes": [
      {
        "name": "for",
        "type": "element id",
        "description": "Id of the control to focus on click and to name."
      },
      {
        "name": "required",
        "type": "boolean",
        "description": "Shows the required marker and conveys required state to the target."
      },
      {
        "name": "size",
        "type": "\"small\" | \"medium\" | \"large\"",
        "default": "medium",
        "description": "Label type scale."
      }
    ],
    "properties": [
      {
        "name": "target",
        "type": "Element | null",
        "description": "Read-only: the element the `for` attribute resolves to."
      }
    ],
    "methods": [],
    "events": [],
    "slots": [
      {
        "name": "(default)",
        "description": "The label text."
      }
    ],
    "parts": [
      {
        "name": "label",
        "description": "The inner label element."
      }
    ],
    "cssProperties": [
      {
        "name": "--jelly-label-font-size",
        "default": "13.5px",
        "description": "Label font size."
      },
      {
        "name": "--jelly-label-gap",
        "default": "5px",
        "description": "Gap before the required marker."
      }
    ],
    "keyboard": [],
    "examples": [
      {
        "code": "<jelly-label for=\"apiEmail\" required>Email</jelly-label>\n<jelly-input id=\"apiEmail\" placeholder=\"you@example.com\"></jelly-input>"
      }
    ]
  },
  {
    "tag": "jelly-option",
    "group": "Forms",
    "summary": "Declarative option data for jelly-select: it carries a value, label text and selected/disabled state, hides itself and lets the parent select render the actual listbox rows.",
    "description": "The element sets display:none on connect and notifies its closest jelly-select whenever it connects or one of its observed attributes changes, so the select's rows, selection and panel size stay in sync with the light DOM. Its label text is HTML-escaped by the parent before rendering.",
    "attributes": [
      {
        "name": "value",
        "description": "The value submitted and reflected by the parent select when this option is chosen. Falls back to the option's trimmed text content when omitted.",
        "type": "string",
        "default": "text content"
      },
      {
        "name": "selected",
        "description": "Marks this option as the current selection. The parent select maintains it as the user picks options (only the chosen option keeps it).",
        "type": "boolean",
        "default": "false"
      },
      {
        "name": "disabled",
        "description": "Makes the option unselectable: its row is dimmed, skipped by keyboard navigation and ignores clicks.",
        "type": "boolean",
        "default": "false"
      }
    ],
    "events": [],
    "properties": [
      {
        "name": "value",
        "description": "Read-only: the value attribute, else the trimmed text content.",
        "type": "string"
      },
      {
        "name": "label",
        "description": "Read-only: the trimmed text content, shown in the trigger and the listbox row.",
        "type": "string"
      },
      {
        "name": "disabled",
        "description": "Read-only: true when the disabled attribute is present.",
        "type": "boolean"
      }
    ],
    "methods": [],
    "slots": [
      {
        "name": "(default)",
        "description": "The option's label text (plain text; it is escaped before rendering, so markup is displayed literally, never parsed)."
      }
    ],
    "parts": [],
    "cssProperties": [],
    "keyboard": [],
    "examples": [
      {
        "title": "Options inside a select",
        "code": "<script type=\"module\" src=\"./src/components/select.js\"></script>\n\n<jelly-select placeholder=\"Choose a plan\">\n  <jelly-option value=\"free\">Free</jelly-option>\n  <jelly-option value=\"pro\" selected>Pro plan</jelly-option>\n  <jelly-option disabled>Enterprise (contact sales)</jelly-option>\n</jelly-select>"
      }
    ]
  },
  {
    "tag": "jelly-otp",
    "group": "Forms",
    "summary": "A one-time-code input: one box per digit with typing, backspace, arrow and paste handling.",
    "description": "Form-associated (the joined code submits like a native field). The digit row is pinned left-to-right even on RTL pages, because codes read that way in every locale. The first box carries autocomplete=\"one-time-code\" so SMS autofill works.",
    "attributes": [
      {
        "name": "length",
        "type": "number",
        "default": "6",
        "description": "How many digit boxes to render. Changing it rebuilds the boxes."
      },
      {
        "name": "size",
        "type": "\"small\" | \"medium\" | \"large\"",
        "default": "medium",
        "description": "Box density scale."
      },
      {
        "name": "variant",
        "type": "\"azure\" | \"white\" | \"rose\" | \"amber\" | \"mint\" | \"platinum\" | \"graphite\"",
        "default": "(theme accent)",
        "description": "Caret and focus accent hue, resolved through theme tokens. Without a variant the theme's --jelly-color-background-accent is used."
      },
      {
        "name": "disabled",
        "type": "boolean",
        "description": "Disables every box (observed live)."
      },
      {
        "name": "name",
        "type": "string",
        "description": "Form field name used on submission (native form association through ElementInternals)."
      },
      {
        "name": "label",
        "type": "string",
        "default": "One-time code",
        "description": "Accessible name for the digit group."
      }
    ],
    "properties": [
      {
        "name": "value",
        "type": "string",
        "description": "Get or set the joined code across all boxes."
      }
    ],
    "methods": [
      {
        "signature": "focus(options?)",
        "description": "Focuses the first box."
      }
    ],
    "events": [
      {
        "name": "input",
        "detail": "-",
        "description": "Fires on every digit change."
      },
      {
        "name": "change",
        "detail": "-",
        "description": "Fires when the code reaches full length (matches the other form controls)."
      },
      {
        "name": "complete",
        "detail": "{ value }",
        "description": "Also fires when every box is filled, carrying the value."
      }
    ],
    "slots": [],
    "parts": [],
    "cssProperties": [
      {
        "name": "--jelly-otp-width",
        "default": "44px",
        "description": "Box width."
      },
      {
        "name": "--jelly-otp-height",
        "default": "52px",
        "description": "Box height."
      },
      {
        "name": "--jelly-otp-gap",
        "default": "9px",
        "description": "Gap between boxes."
      },
      {
        "name": "--jelly-otp-font-size",
        "default": "22px",
        "description": "Digit font size."
      },
      {
        "name": "--jelly-otp-radius",
        "default": "14px",
        "description": "Box corner radius."
      },
      {
        "name": "--jelly-otp-accent",
        "description": "Caret color (follows variant / accent token)."
      },
      {
        "name": "--jelly-ring",
        "description": "Focus border and outline color."
      }
    ],
    "keyboard": [
      {
        "keys": "0–9",
        "description": "Fills the box and hops to the next."
      },
      {
        "keys": "Backspace",
        "description": "Clears; on an empty box, hops back."
      },
      {
        "keys": "Arrow Left / Right",
        "description": "Move between boxes (physical order — the row is always LTR)."
      },
      {
        "keys": "Paste",
        "description": "Distributes pasted digits across the remaining boxes."
      }
    ],
    "examples": [
      {
        "code": "<jelly-otp length=\"6\"></jelly-otp>"
      }
    ]
  },
  {
    "tag": "jelly-radio",
    "group": "Forms",
    "summary": "A jelly radio button; radios sharing a name under the same root form a group with roving tabindex and direction-aware arrow-key navigation.",
    "description": "Because each radio's control lives in its own shadow root, grouping (by the name attribute, scoped to the nearest document or shadow root), selection, roving tabindex and arrow-key navigation are coordinated by the component itself. The selected control pops with a scale spring and the dot lands with an overshoot.",
    "attributes": [
      {
        "name": "name",
        "type": "string",
        "description": "Group key: radios with the same name under the same root (document or shadow root) are mutually exclusive."
      },
      {
        "name": "checked",
        "type": "boolean",
        "default": "false",
        "description": "Whether this radio is selected. Selecting one deselects the rest of its group."
      },
      {
        "name": "disabled",
        "type": "boolean",
        "default": "false",
        "description": "Disables the radio: dimmed, skipped by arrow navigation, removed from the tab order."
      },
      {
        "name": "size",
        "type": "'small' | 'medium' | 'large'",
        "default": "medium",
        "description": "Size scale (control 28 / 32 / 38 px). The sm / md / lg aliases are accepted and canonicalized in place."
      },
      {
        "name": "value",
        "type": "string",
        "default": "on",
        "description": "The form value submitted while selected."
      },
      {
        "name": "variant",
        "type": "\"azure\" | \"white\" | \"rose\" | \"amber\" | \"mint\" | \"platinum\" | \"graphite\"",
        "default": "(accent)",
        "description": "The selected fill hue, resolved through theme tokens."
      },
      {
        "name": "label",
        "type": "string",
        "description": "Explicit accessible name (aria-label on the control); overrides the slotted text for assistive technology."
      }
    ],
    "properties": [
      {
        "name": "checked",
        "type": "boolean",
        "description": "Gets/sets the selected state (reflects the attribute). Programmatic set does not deselect siblings; use user interaction or clear them explicitly."
      },
      {
        "name": "value",
        "type": "string",
        "description": "Gets/sets the submitted form value; defaults to \"on\"."
      }
    ],
    "methods": [
      {
        "signature": "focus(options?: FocusOptions): void",
        "description": "Moves focus to the inner role=\"radio\" control."
      }
    ],
    "events": [
      {
        "name": "change",
        "detail": "null",
        "description": "Fired when the user selects this radio (click, Space/Enter, or arrow-move selection). Composed and bubbling."
      }
    ],
    "slots": [
      {
        "name": "(default)",
        "description": "The visible label text; linked to the control with aria-labelledby, so it is the accessible name."
      }
    ],
    "parts": [
      {
        "name": "wrap",
        "description": "The row wrapping control and text (whole row is clickable)."
      },
      {
        "name": "control",
        "description": "The circular role=\"radio\" element that carries focus."
      },
      {
        "name": "jelly",
        "description": "The canvas the jelly circle is painted on."
      }
    ],
    "cssProperties": [
      {
        "name": "--jelly-radio-size",
        "default": "32px",
        "description": "Diameter of the control (28 / 32 / 38 px across sizes)."
      },
      {
        "name": "--jelly-radio-dot-size",
        "default": "12px",
        "description": "Diameter of the selected dot (10 / 12 / 14 px across sizes)."
      },
      {
        "name": "--jelly-radio-gap",
        "default": "11px",
        "description": "Gap between the control and the label text."
      },
      {
        "name": "--jelly-radio-font-size",
        "default": "15.5px",
        "description": "Label font size."
      },
      {
        "name": "--jelly-radio-dot-color",
        "default": "var(--jelly-color-foreground-on-accent, #FFFFFF)",
        "description": "Color of the selected dot; variants pair it with the fill hue."
      },
      {
        "name": "--jelly-fill",
        "default": "var(--jelly-color-background-neutral, #DADADA)",
        "description": "Unselected control fill (shared token)."
      },
      {
        "name": "--jelly-on",
        "default": "var(--jelly-color-background-accent, #0077CC)",
        "description": "Selected control fill (shared token)."
      },
      {
        "name": "--jelly-ring",
        "default": "var(--jelly-on, var(--jelly-color-border-focus, #0077CC))",
        "description": "Keyboard focus ring color painted on the canvas (shared token)."
      },
      {
        "name": "--jelly-label",
        "default": "var(--jelly-color-foreground-muted, #5D6474)",
        "description": "Label text color (shared token)."
      }
    ],
    "keyboard": [
      {
        "keys": "Space / Enter",
        "description": "Selects the focused radio."
      },
      {
        "keys": "ArrowRight / ArrowLeft",
        "description": "Moves focus and selection to the next / previous enabled radio in the group, wrapping; flipped automatically on RTL pages."
      },
      {
        "keys": "ArrowDown / ArrowUp",
        "description": "Moves focus and selection to the next / previous enabled radio, wrapping."
      },
      {
        "keys": "Home / End",
        "description": "Moves focus and selection to the first / last enabled radio in the group."
      },
      {
        "keys": "Tab",
        "description": "Enters the group at the selected radio (roving tabindex); a single Tab leaves it."
      }
    ],
    "examples": [
      {
        "title": "A named group",
        "code": "<jelly-radio name=\"plan\" value=\"pro\" checked>Pro</jelly-radio>\n<jelly-radio name=\"plan\" value=\"team\">Team</jelly-radio>\n<jelly-radio name=\"plan\" value=\"enterprise\" disabled>Enterprise</jelly-radio>"
      },
      {
        "title": "Listening for selection",
        "code": "<div id=\"hues\">\n  <jelly-radio name=\"hue\" value=\"mint\" variant=\"mint\" checked>Mint</jelly-radio>\n  <jelly-radio name=\"hue\" value=\"rose\" variant=\"rose\">Rose</jelly-radio>\n</div>\n<script>\n  document.getElementById('hues').addEventListener('change', (e) => {\n    console.log('picked', e.target.value);\n  });\n</script>"
      }
    ]
  },
  {
    "tag": "jelly-radio-group",
    "group": "Forms",
    "summary": "A labeled radiogroup container for jelly-radio items with legend, flow layout and size propagation.",
    "description": "The radios still group by their shared name attribute; this container adds role=\"radiogroup\" semantics with the legend linked as the accessible name via aria-labelledby, a wrapping flex layout (horizontal by default, vertical with direction=\"vertical\") and propagates its size attribute to child radios that have not set their own.",
    "attributes": [
      {
        "name": "label",
        "type": "string",
        "description": "Legend text shown above the items and linked to the group as its accessible name."
      },
      {
        "name": "direction",
        "type": "'horizontal' | 'vertical'",
        "default": "horizontal",
        "description": "Layout of the items: wrapping row (default) or stacked column."
      },
      {
        "name": "size",
        "type": "'small' | 'medium' | 'large'",
        "description": "Scales the legend/gaps and is propagated to child jelly-radio elements that did not declare their own size (including radios slotted in later). The sm / md / lg aliases are accepted."
      }
    ],
    "properties": [],
    "methods": [],
    "events": [],
    "slots": [
      {
        "name": "(default)",
        "description": "The jelly-radio items (other content is allowed but the group semantics target radios)."
      }
    ],
    "parts": [
      {
        "name": "legend",
        "description": "The legend text element."
      },
      {
        "name": "items",
        "description": "The role=\"radiogroup\" flex container holding the slotted radios."
      }
    ],
    "cssProperties": [
      {
        "name": "--jelly-radio-group-font-size",
        "default": "13.5px",
        "description": "Legend font size (12 / 13.5 / 15 px across sizes)."
      },
      {
        "name": "--jelly-radio-group-column-gap",
        "default": "20px",
        "description": "Inline gap between items (16 / 20 / 24 px across sizes)."
      },
      {
        "name": "--jelly-radio-group-row-gap",
        "default": "14px",
        "description": "Block gap between wrapped rows or stacked items (10 / 14 / 16 px across sizes)."
      },
      {
        "name": "--jelly-radio-group-legend-gap",
        "default": "10px",
        "description": "Space between the legend and the items (8 / 10 / 12 px across sizes)."
      },
      {
        "name": "--jelly-radio-group-legend-color",
        "default": "var(--jelly-color-foreground-muted, #5D6474)",
        "description": "Legend text color, themed via token."
      }
    ],
    "keyboard": [
      {
        "keys": "Arrow keys / Home / End",
        "description": "Handled by the child radios: move selection within the group (RTL-aware horizontal arrows)."
      }
    ],
    "examples": [
      {
        "title": "Basic group",
        "code": "<jelly-radio-group label=\"Plan\">\n  <jelly-radio name=\"plan\" value=\"free\" checked>Free</jelly-radio>\n  <jelly-radio name=\"plan\" value=\"pro\">Pro</jelly-radio>\n  <jelly-radio name=\"plan\" value=\"team\">Team</jelly-radio>\n</jelly-radio-group>"
      },
      {
        "title": "Size propagates to every radio",
        "code": "<div style=\"display: grid; gap: 18px\">\n  <jelly-radio-group label=\"Small\" size=\"small\">\n    <jelly-radio name=\"s1\" value=\"a\" checked>Alpha</jelly-radio>\n    <jelly-radio name=\"s1\" value=\"b\">Beta</jelly-radio>\n  </jelly-radio-group>\n  <jelly-radio-group label=\"Large\" size=\"large\">\n    <jelly-radio name=\"s2\" value=\"a\" checked>Alpha</jelly-radio>\n    <jelly-radio name=\"s2\" value=\"b\">Beta</jelly-radio>\n  </jelly-radio-group>\n</div>"
      }
    ]
  },
  {
    "tag": "jelly-range",
    "group": "Forms",
    "summary": "A dual-thumb range slider for picking a low/high interval, with two role=\"slider\" knobs carrying focus and ARIA and jelly thumbs that squish as they drag.",
    "description": "Each thumb is a soft physics body that squishes when grabbed and leans into its travel; the accent fill spans the selected interval. Form-associated — submits its value as \"low,high\". Direction-aware: painting, knob placement (inset-inline-start) and arrow keys all mirror in RTL. Window-level drag listeners exist only for the duration of a drag and are cleaned up on release and on disconnect.",
    "attributes": [
      {
        "name": "min",
        "type": "number (string attribute)",
        "default": "0",
        "description": "Lower bound of the whole range. Changing it live re-clamps the current low/high values."
      },
      {
        "name": "max",
        "type": "number (string attribute)",
        "default": "100",
        "description": "Upper bound of the whole range. Changing it live re-clamps the current low/high values."
      },
      {
        "name": "step",
        "type": "number (string attribute)",
        "default": "1",
        "description": "Increment values snap to during dragging and keyboard stepping (always treated as positive)."
      },
      {
        "name": "low",
        "type": "number (string attribute)",
        "default": "(min)",
        "description": "The lower selected value. Clamped into [min, max] and kept ≤ high."
      },
      {
        "name": "high",
        "type": "number (string attribute)",
        "default": "(max)",
        "description": "The upper selected value. Clamped into [min, max] and kept ≥ low."
      },
      {
        "name": "label",
        "type": "string",
        "description": "Accessible name prefix for the two knobs: with label=\"Price\" they announce as \"Price minimum\" and \"Price maximum\"; without it, \"Minimum\" and \"Maximum\"."
      },
      {
        "name": "disabled",
        "type": "boolean",
        "default": "false",
        "description": "Disables the control: 50% opacity, no pointer events, knobs leave the tab order and gain aria-disabled."
      },
      {
        "name": "size",
        "type": "\"small\" | \"medium\" | \"large\"",
        "default": "medium",
        "description": "Size scale (220×30 / 260×36 / 320×44 host, 9/12/14px track, 24/28/34px knobs). The sm/md/lg aliases are accepted and rewritten in place to the canonical names."
      },
      {
        "name": "variant",
        "type": "\"azure\" | \"white\" | \"rose\" | \"amber\" | \"mint\" | \"platinum\" | \"graphite\"",
        "default": "(theme accent)",
        "description": "Accent hue for the interval fill and thumbs, resolved through theme tokens so dark mode adapts. Without a variant the theme's --jelly-color-background-accent is used."
      },
      {
        "name": "name",
        "type": "string",
        "description": "Form field name; the submitted value is \"low,high\" (standard form-associated custom element behavior)."
      }
    ],
    "events": [
      {
        "name": "input",
        "description": "Fired continuously as either bound changes from dragging or keyboard stepping. Composed and bubbling; read element.value for the \"low,high\" string.",
        "detail": "null"
      },
      {
        "name": "change",
        "description": "Fired when an adjustment is committed: on pointer release/cancel after a drag, or after each keyboard step. Composed and bubbling.",
        "detail": "null"
      }
    ],
    "properties": [
      {
        "name": "value",
        "type": "string (read-only)",
        "description": "The current interval serialized as \"low,high\". Set values via the low/high attributes."
      }
    ],
    "methods": [
      {
        "signature": "focus (options?: FocusOptions)",
        "description": "Moves focus to the active knob (the one most recently focused or dragged; the high knob initially)."
      }
    ],
    "slots": [],
    "parts": [
      {
        "name": "wrap",
        "description": "The positioning container spanning the host."
      },
      {
        "name": "track",
        "description": "The drag-surface strip aligned to the painted track (touch-action: none; pointer target extended to 24px tall; pressing it grabs the nearest knob)."
      },
      {
        "name": "knob",
        "description": "The two invisible role=\"slider\" grab/focus targets riding over the painted thumbs (one per bound, in low/high order)."
      },
      {
        "name": "jelly",
        "description": "The canvas the track, interval fill and thumbs are painted on (from the JellyElement base)."
      }
    ],
    "cssProperties": [
      {
        "name": "--jelly-range-track-height",
        "default": "12px (9/12/14 per size)",
        "description": "Visual height of the track capsule, set per size attribute."
      },
      {
        "name": "--jelly-range-thumb-size",
        "default": "28px (24/28/34 per size)",
        "description": "Diameter of the knob hit targets, matching the painted thumb bodies."
      },
      {
        "name": "--jelly-track",
        "default": "var(--jelly-color-background-neutral, #DADADA)",
        "description": "Track base color, resolved at paint time so theme flips recolor live."
      },
      {
        "name": "--jelly-accent",
        "default": "var(--jelly-color-background-accent, #0077CC)",
        "description": "Accent color for the interval fill and thumbs; variants override it through theme tokens."
      },
      {
        "name": "--jelly-ring",
        "default": "var(--jelly-accent, var(--jelly-color-border-focus, #0077CC))",
        "description": "Shared focus-ring token; keyboard focus is painted around the focused thumb in the active variant color at 50% opacity."
      }
    ],
    "keyboard": [
      {
        "keys": "Tab / Shift+Tab",
        "description": "Move between the low and high knobs."
      },
      {
        "keys": "ArrowRight / ArrowUp",
        "description": "Increase the focused knob by one step. ArrowRight follows reading direction: in RTL it decreases, like native sliders."
      },
      {
        "keys": "ArrowLeft / ArrowDown",
        "description": "Decrease the focused knob by one step (ArrowLeft increases in RTL)."
      },
      {
        "keys": "Shift + Arrow",
        "description": "Step by 10× the step increment."
      },
      {
        "keys": "Home / End",
        "description": "Jump the focused knob to its minimum / maximum (clamped by the other knob)."
      }
    ],
    "examples": [
      {
        "title": "Basic labeled interval",
        "code": "<jelly-range label=\"Price\" min=\"0\" max=\"500\" low=\"120\" high=\"360\"></jelly-range>"
      },
      {
        "title": "Sizes and variants",
        "code": "<jelly-range label=\"Threshold\" variant=\"mint\" size=\"large\" step=\"5\" low=\"20\" high=\"70\"></jelly-range>\n<jelly-range label=\"Alert band\" variant=\"rose\" size=\"small\"></jelly-range>"
      },
      {
        "title": "Reading the interval on commit",
        "code": "<jelly-range id=\"budget\" label=\"Budget\" min=\"0\" max=\"100\" low=\"25\" high=\"75\"></jelly-range>\n<script type=\"module\">\n  import './package.js';\n  document.getElementById('budget').addEventListener('change', (event) => {\n    const [low, high] = event.target.value.split(',').map(Number);\n    console.log({ low, high });\n  });\n</script>"
      }
    ]
  },
  {
    "tag": "jelly-segment",
    "group": "Forms",
    "summary": "Declarative data for one option inside <jelly-segmented>; the parent renders the actual control.",
    "attributes": [
      {
        "name": "value",
        "type": "string",
        "default": "(text content)",
        "description": "The value reported when this segment is selected."
      },
      {
        "name": "selected",
        "type": "boolean",
        "description": "Marks the initially selected segment."
      },
      {
        "name": "disabled",
        "type": "boolean",
        "description": "Makes the segment unselectable."
      }
    ],
    "properties": [
      {
        "name": "value",
        "type": "string",
        "description": "Read-only resolved value."
      },
      {
        "name": "label",
        "type": "string",
        "description": "Read-only visible label (the text content)."
      },
      {
        "name": "disabled",
        "type": "boolean",
        "description": "Read-only disabled state."
      }
    ],
    "methods": [],
    "events": [],
    "slots": [
      {
        "name": "(default)",
        "description": "The segment label text."
      }
    ],
    "parts": [],
    "cssProperties": [],
    "keyboard": [],
    "examples": [
      {
        "code": "<jelly-segmented>\n  <jelly-segment value=\"on\" selected>On</jelly-segment>\n  <jelly-segment value=\"off\">Off</jelly-segment>\n</jelly-segmented>"
      }
    ]
  },
  {
    "tag": "jelly-segmented",
    "group": "Forms",
    "summary": "A capsule track of mutually exclusive options with a jelly pill that slides, leans and stretches between segments.",
    "description": "Form-associated; presented as a radiogroup by default, or as a real tablist with roles=\"tablist\" (this is how <jelly-tabs> uses it). Options are declarative <jelly-segment> children and can change at any time.",
    "attributes": [
      {
        "name": "value",
        "type": "string",
        "description": "The selected segment value (reflected as segments are picked)."
      },
      {
        "name": "roles",
        "type": "\"radiogroup\" | \"tablist\"",
        "default": "radiogroup",
        "description": "The ARIA presentation: radiogroup/radio with aria-checked, or tablist/tab with aria-selected."
      },
      {
        "name": "size",
        "type": "\"small\" | \"medium\" | \"large\"",
        "default": "medium",
        "description": "Density scale (sm/md/lg accepted and canonicalized)."
      },
      {
        "name": "disabled",
        "type": "boolean",
        "description": "Disables the whole control."
      },
      {
        "name": "name",
        "type": "string",
        "description": "Form field name for FormData."
      },
      {
        "name": "label",
        "type": "string",
        "description": "Accessible name for the group, mapped to aria-label on the inner radiogroup / tablist wrapper."
      }
    ],
    "properties": [
      {
        "name": "value",
        "type": "string",
        "description": "Get or set the selected value."
      }
    ],
    "methods": [
      {
        "signature": "focus(options?)",
        "description": "Focuses the active segment."
      }
    ],
    "events": [
      {
        "name": "change",
        "detail": "-",
        "description": "Fires when the selected segment changes (composed, bubbles)."
      }
    ],
    "slots": [
      {
        "name": "(default)",
        "description": "<jelly-segment> children (hidden data; the control renders them)."
      }
    ],
    "parts": [
      {
        "name": "jelly",
        "description": "The canvas."
      },
      {
        "name": "wrap",
        "description": "The segment button row."
      }
    ],
    "cssProperties": [
      {
        "name": "--jelly-track",
        "description": "Track fill behind the pill (defaults through the platinum token)."
      },
      {
        "name": "--jelly-pill",
        "description": "The sliding pill fill (defaults through the accent token)."
      },
      {
        "name": "--jelly-label",
        "description": "Resting segment label color."
      },
      {
        "name": "--jelly-label-on",
        "description": "Active segment label color."
      },
      {
        "name": "--jelly-segmented-font-size",
        "default": "14.5px",
        "description": "Segment label size (scales with size)."
      },
      {
        "name": "--jelly-segmented-min-width",
        "description": "Minimum width of each segment."
      },
      {
        "name": "--jelly-segmented-gap",
        "description": "Gap between a segment's icon and label."
      },
      {
        "name": "--jelly-segmented-padding",
        "description": "Padding around the track."
      },
      {
        "name": "--jelly-segmented-padding-inline",
        "description": "Segment horizontal padding."
      }
    ],
    "keyboard": [
      {
        "keys": "Arrow keys",
        "description": "Move the selection (horizontal arrows follow reading direction; wraps, skips disabled segments)."
      },
      {
        "keys": "Home / End",
        "description": "Jump to the first / last enabled segment."
      }
    ],
    "examples": [
      {
        "title": "Time range picker",
        "code": "<jelly-segmented value=\"week\">\n  <jelly-segment value=\"day\">Day</jelly-segment>\n  <jelly-segment value=\"week\">Week</jelly-segment>\n  <jelly-segment value=\"month\">Month</jelly-segment>\n</jelly-segmented>"
      }
    ]
  },
  {
    "tag": "jelly-select",
    "group": "Forms",
    "summary": "A form-associated dropdown on the ARIA combobox/listbox pattern whose trigger and option panel are both soft-body jelly surfaces, with the panel unfolding out of the field — flipping above it when the viewport has no room below.",
    "description": "The trigger is one canvas-painted jelly body and the option panel is a second one that springs open with an underdamped unfold, revealing rows with a light stagger. Options are declared as light-DOM <jelly-option> children and re-read live through a MutationObserver. Keyboard navigation, aria-expanded/aria-activedescendant, outside-press dismissal, dark-mode theme tokens, RTL layout and native form submission via ElementInternals are all built in.",
    "attributes": [
      {
        "name": "value",
        "description": "The selected option's value. Reflected: setting it selects the matching option (an unknown value is ignored, an empty value clears the selection back to the placeholder).",
        "type": "string",
        "default": "\"\""
      },
      {
        "name": "placeholder",
        "description": "Text shown in the trigger while nothing is selected, rendered in the muted text color.",
        "type": "string",
        "default": "\"Select…\""
      },
      {
        "name": "label",
        "description": "Accessible name for the field, mapped to aria-label on the inner combobox trigger button.",
        "type": "string"
      },
      {
        "name": "disabled",
        "description": "Disables the trigger, removes it from the tab order, dims the surface and blocks pointer interaction.",
        "type": "boolean",
        "default": "false"
      },
      {
        "name": "size",
        "description": "Size scale: small (210×46, 38px rows), medium (240×54, 44px rows), or large (280×62, 50px rows). The sm/md/lg aliases are accepted and canonicalized in place.",
        "type": "\"small\" | \"medium\" | \"large\"",
        "default": "\"medium\""
      },
      {
        "name": "variant",
        "description": "Accent hue used for the focus ring, focused border, active-row highlight and selected tick: rose, azure, mint, amber, or graphite. Unset, the accent follows the theme's --jelly-color-background-accent.",
        "type": "string",
        "default": "theme accent"
      },
      {
        "name": "open",
        "description": "Present while the option panel is open. Managed by the component (read-only state hook for styling); also raises the host's z-index via --jelly-dropdown-z-index.",
        "type": "boolean",
        "default": "false"
      },
      {
        "name": "name",
        "description": "Standard form-field name; the component is form-associated and submits the selected option's value through ElementInternals.",
        "type": "string"
      }
    ],
    "events": [
      {
        "name": "change",
        "description": "Fired when the user commits a selection (pointer click or Enter/Space on the active option). Composed and bubbling; read the new value from the element's value property.",
        "detail": "null (no payload — read event.target.value)"
      }
    ],
    "properties": [
      {
        "name": "value",
        "description": "Gets the selected option's value ('' when nothing is selected); setting it selects the matching option or clears the selection when empty.",
        "type": "string"
      }
    ],
    "methods": [
      {
        "signature": "focus(options?: FocusOptions): void",
        "description": "Moves keyboard focus onto the inner trigger button (host focus is also delegated automatically)."
      }
    ],
    "slots": [
      {
        "name": "(default)",
        "description": "One or more <jelly-option> elements. They are hidden data — the select renders its own listbox rows from their value, label text, selected and disabled state and re-syncs whenever they change."
      }
    ],
    "parts": [
      {
        "name": "jelly",
        "description": "The trigger's canvas surface (painted jelly body), from the shared base class."
      },
      {
        "name": "trigger",
        "description": "The combobox trigger button containing the value text and chevron."
      },
      {
        "name": "value",
        "description": "The span showing the selected label or the placeholder."
      },
      {
        "name": "panel",
        "description": "The floating dropdown container holding the panel canvas and the option list."
      },
      {
        "name": "panel-mask",
        "description": "The clip-path wrapper that reveals the option list as the surface unfolds."
      }
    ],
    "cssProperties": [
      {
        "name": "--jelly-select-padding-inline",
        "description": "Inline padding inside the trigger.",
        "default": "18px"
      },
      {
        "name": "--jelly-select-font-size",
        "description": "Trigger and row font size.",
        "default": "15.5px"
      },
      {
        "name": "--jelly-select-radius",
        "description": "Trigger corner radius (also used by the focus-fallback outline).",
        "default": "16px"
      },
      {
        "name": "--jelly-select-gap",
        "description": "Gap between the value text and the chevron.",
        "default": "10px"
      },
      {
        "name": "--jelly-select-chevron-size",
        "description": "Width and height of the chevron icon.",
        "default": "16px"
      },
      {
        "name": "--jelly-select-row-height",
        "description": "Height of each option row (also drives the measured panel height).",
        "default": "44px"
      },
      {
        "name": "--jelly-select-row-padding-inline",
        "description": "Inline padding inside each option row.",
        "default": "14px"
      },
      {
        "name": "--jelly-select-row-radius",
        "description": "Corner radius of the active-row highlight.",
        "default": "11px"
      },
      {
        "name": "--jelly-dropdown-z-index",
        "description": "z-index applied to the host while the panel is open.",
        "default": "9999"
      },
      {
        "name": "--jelly-fill",
        "description": "Shared token: resting trigger surface color.",
        "default": "var(--jelly-color-background-muted, #F4F5F7)"
      },
      {
        "name": "--jelly-label",
        "description": "Shared token: trigger and row text color.",
        "default": "var(--jelly-color-foreground-default, #1F2430)"
      },
      {
        "name": "--jelly-accent",
        "description": "Shared token: accent for the ring, focused border, active row and tick (set by variant).",
        "default": "var(--jelly-color-background-accent, #0077CC)"
      },
      {
        "name": "--jelly-ring",
        "description": "Shared token: painted focus-ring color.",
        "default": "var(--jelly-accent, var(--jelly-color-border-focus, #0077CC))"
      }
    ],
    "keyboard": [
      {
        "keys": "Enter / Space / ArrowDown / ArrowUp",
        "description": "When closed: opens the panel with the selected (or first) option active."
      },
      {
        "keys": "ArrowDown / ArrowUp",
        "description": "When open: moves the active option down/up, wrapping and skipping disabled options."
      },
      {
        "keys": "Home / End",
        "description": "When open: jumps to the first / last enabled option."
      },
      {
        "keys": "Enter / Space",
        "description": "When open: selects the active option, closes the panel and fires change."
      },
      {
        "keys": "Escape",
        "description": "When open: closes the panel without changing the selection and refocuses the trigger."
      },
      {
        "keys": "Tab",
        "description": "When open: closes the panel and lets focus move on."
      }
    ],
    "examples": [
      {
        "title": "Basic select with a labelled field",
        "code": "<script type=\"module\" src=\"./src/components/select.js\"></script>\n\n<jelly-select label=\"Plan\" placeholder=\"Choose a plan\">\n  <jelly-option value=\"free\">Free</jelly-option>\n  <jelly-option value=\"pro\" selected>Pro</jelly-option>\n  <jelly-option value=\"team\" disabled>Team (coming soon)</jelly-option>\n</jelly-select>\n\n<script>\n  document.querySelector('jelly-select')\n    .addEventListener('change', (event) => console.log(event.target.value));\n</script>"
      },
      {
        "title": "Sizes and accent variants",
        "code": "<script type=\"module\" src=\"./src/components/select.js\"></script>\n\n<jelly-select size=\"small\" variant=\"mint\" label=\"Region\" placeholder=\"Region\">\n  <jelly-option value=\"eu\">Europe</jelly-option>\n  <jelly-option value=\"us\">United States</jelly-option>\n</jelly-select>\n\n<jelly-select size=\"large\" variant=\"rose\" label=\"Priority\" value=\"high\">\n  <jelly-option value=\"low\">Low</jelly-option>\n  <jelly-option value=\"high\">High</jelly-option>\n</jelly-select>"
      },
      {
        "title": "Inside a native form (submits like a built-in field)",
        "code": "<script type=\"module\" src=\"./src/components/select.js\"></script>\n\n<form onsubmit=\"event.preventDefault(); alert(new FormData(this).get('tier'))\">\n  <jelly-select name=\"tier\" label=\"Tier\" placeholder=\"Pick a tier\">\n    <jelly-option value=\"starter\">Starter</jelly-option>\n    <jelly-option value=\"business\" selected>Business</jelly-option>\n  </jelly-select>\n  <button type=\"submit\">Submit</button>\n</form>"
      }
    ]
  },
  {
    "tag": "jelly-slider",
    "group": "Forms",
    "summary": "A single-value range slider whose accent thumb is a squishy jelly body, backed by a hidden native range input for semantics and form participation.",
    "description": "A hidden native <input type=\"range\"> owns the value, keyboard semantics and form participation while the thumb — a soft physics body — squishes when grabbed, leans into its travel and carries a variant-colored focus ring. Direction-aware: in RTL layouts the value origin, painted accent fill and arrow keys mirror like a native range input. In forced-colors mode the component hands interaction back to the fully styleable native input.",
    "attributes": [
      {
        "name": "feel",
        "type": "string (a registered feel preset name; \"gel\" ships in Phase 1)",
        "default": "gel, or the nearest data-droplet-feel scope",
        "description": "Physics preset driving the soft body. Inherits from the closest ancestor carrying data-droplet-feel; the element attribute wins. Unknown names fall back to gel with one console warning per name. Register your own with registerPreset('feel', name, record)."
      },
      {
        "name": "quality",
        "type": "\"low\" | \"medium\" | \"high\" (accepts \"lo\" | \"med\" | \"md\" | \"hi\", canonicalized on connect)",
        "default": "medium, or the nearest data-droplet-quality scope",
        "description": "Caps physics cost: low limits the membrane to 120 samples and 2 normal-blend passes. Inherits from the closest ancestor carrying data-droplet-quality; the element attribute wins."
      },
      {
        "name": "value",
        "type": "number (string attribute)",
        "default": "50",
        "description": "Current value. Clamped to [min, max] by the underlying native range input; updating it moves the jelly thumb."
      },
      {
        "name": "min",
        "type": "number (string attribute)",
        "default": "0",
        "description": "Lower bound of the range."
      },
      {
        "name": "max",
        "type": "number (string attribute)",
        "default": "100",
        "description": "Upper bound of the range."
      },
      {
        "name": "step",
        "type": "number (string attribute)",
        "default": "1",
        "description": "Increment used by keyboard stepping. If missing or non-positive, keyboard steps fall back to 1/100 of the span."
      },
      {
        "name": "label",
        "type": "string",
        "description": "Accessible name, mapped to aria-label on the hidden native input. Provide this (or an external label) so the slider has a name."
      },
      {
        "name": "disabled",
        "type": "boolean",
        "default": "false",
        "description": "Disables the control: 50% opacity, no pointer events, removed from the tab order, form value still reported."
      },
      {
        "name": "size",
        "type": "\"small\" | \"medium\" | \"large\"",
        "default": "medium",
        "description": "Size scale (200×30 / 240×36 / 300×44 host, 9/12/14px track, 24/28/34px thumb). The sm/md/lg aliases are accepted and rewritten in place to the canonical names."
      },
      {
        "name": "variant",
        "type": "\"azure\" | \"white\" | \"rose\" | \"amber\" | \"mint\" | \"platinum\" | \"graphite\"",
        "default": "(theme accent)",
        "description": "Accent hue for the fill and thumb, resolved through theme tokens so dark mode adapts. Without a variant the theme's --jelly-color-background-accent is used."
      },
      {
        "name": "name",
        "type": "string",
        "description": "Form field name (standard form-associated custom element behavior via ElementInternals)."
      }
    ],
    "events": [
      {
        "name": "input",
        "description": "Fired continuously while the value changes from dragging or keyboard stepping. Composed and bubbling; read element.value for the current value.",
        "detail": "null"
      },
      {
        "name": "change",
        "description": "Fired when a value is committed: on pointer release/cancel after a drag, or after each keyboard step. Composed and bubbling.",
        "detail": "null"
      }
    ],
    "properties": [
      {
        "name": "value",
        "type": "string",
        "description": "Gets or sets the current value. Setting reflects into the thumb position, ARIA and the form value."
      }
    ],
    "methods": [
      {
        "signature": "focus (options?: FocusOptions)",
        "description": "Moves focus to the hidden native range input (the keyboard target)."
      }
    ],
    "slots": [],
    "parts": [
      {
        "name": "wrap",
        "description": "The positioning container spanning the host."
      },
      {
        "name": "input",
        "description": "The hidden native <input type=\"range\"> (revealed and fully interactive in forced-colors mode)."
      },
      {
        "name": "track",
        "description": "The drag-surface strip aligned to the painted track (touch-action: none; pointer target extended to 24px tall)."
      },
      {
        "name": "jelly",
        "description": "The canvas the track, accent fill and thumb are painted on (from the JellyElement base)."
      }
    ],
    "cssProperties": [
      {
        "name": "--jelly-slider-track-height",
        "default": "12px (9/12/14 per size)",
        "description": "Visual height of the track capsule; the smoke-tested size scale sets it per size attribute."
      },
      {
        "name": "--jelly-track",
        "default": "var(--jelly-color-background-neutral, #DADADA)",
        "description": "Track base color, resolved at paint time so theme flips recolor live."
      },
      {
        "name": "--jelly-accent",
        "default": "var(--jelly-color-background-accent, #0077CC)",
        "description": "Accent color for the value fill and the thumb; variants override it through theme tokens."
      },
      {
        "name": "--jelly-ring",
        "default": "var(--jelly-accent, var(--jelly-color-border-focus, #0077CC))",
        "description": "Shared focus-ring token; keyboard focus is painted around the thumb in the active variant color at 50% opacity."
      }
    ],
    "keyboard": [
      {
        "keys": "ArrowRight / ArrowUp",
        "description": "Increase by one step. ArrowRight follows reading direction: in RTL it decreases, like a native range input."
      },
      {
        "keys": "ArrowLeft / ArrowDown",
        "description": "Decrease by one step (ArrowLeft increases in RTL)."
      },
      {
        "keys": "Shift + Arrow",
        "description": "Step by 10× the step increment."
      },
      {
        "keys": "Home / End",
        "description": "Jump to the minimum / maximum value."
      }
    ],
    "examples": [
      {
        "title": "Basic labeled slider",
        "code": "<jelly-slider label=\"Volume\" min=\"0\" max=\"100\" value=\"40\"></jelly-slider>"
      },
      {
        "title": "Sizes and variants",
        "code": "<jelly-slider label=\"Warmth\" variant=\"amber\" size=\"small\" step=\"5\" value=\"25\"></jelly-slider>\n<jelly-slider label=\"Growth\" variant=\"mint\" size=\"large\" value=\"70\"></jelly-slider>"
      },
      {
        "title": "In a form, reacting to commits",
        "code": "<form id=\"mix\">\n  <jelly-slider name=\"volume\" label=\"Volume\" value=\"60\"></jelly-slider>\n</form>\n<script type=\"module\">\n  import './package.js';\n  document.querySelector('jelly-slider').addEventListener('change', (event) => {\n    console.log('committed', event.target.value);\n  });\n</script>"
      }
    ]
  },
  {
    "tag": "jelly-switch",
    "group": "Forms",
    "summary": "A draggable jelly switch: a capsule track whose thumb stretches like a liquid drop and whose color crossfades between off and on.",
    "description": "A visually-hidden native checkbox with role=\"switch\" carries focus, keyboard and the form value; the track and thumb are two coupled physics bodies painted on canvas. The thumb can be tapped or dragged past the midpoint; \"on\" always travels toward the inline end, so RTL pages mirror the travel, the drag release decision and the color progress.",
    "attributes": [
      {
        "name": "checked",
        "type": "boolean",
        "default": "false",
        "description": "Whether the switch is on. Reflected; updated by taps, drags and keyboard toggles."
      },
      {
        "name": "disabled",
        "type": "boolean",
        "default": "false",
        "description": "Disables the switch: dimmed, removed from the tab order, ignores pointer input."
      },
      {
        "name": "size",
        "type": "'small' | 'medium' | 'large'",
        "default": "medium",
        "description": "Track geometry: 50x28 / 62x34 / 74x40 px. The sm / md / lg aliases are accepted."
      },
      {
        "name": "value",
        "type": "string",
        "default": "on",
        "description": "The form value submitted while on (nothing is submitted when off)."
      },
      {
        "name": "name",
        "type": "string",
        "description": "Form field name used on submission (native form association through ElementInternals)."
      },
      {
        "name": "variant",
        "type": "\"azure\" | \"white\" | \"rose\" | \"amber\" | \"mint\" | \"platinum\" | \"graphite\"",
        "default": "theme accent",
        "description": "The \"on\" track hue, resolved through theme tokens. Explicit variants also pair the thumb foreground with the variant's on-color."
      },
      {
        "name": "label",
        "type": "string",
        "description": "Explicit accessible name mapped to the inner input's aria-label; overrides the slotted text for assistive technology."
      }
    ],
    "properties": [
      {
        "name": "checked",
        "type": "boolean",
        "description": "Gets/sets the on state (reflects the attribute)."
      },
      {
        "name": "value",
        "type": "string",
        "description": "Gets/sets the submitted form value; defaults to \"on\"."
      }
    ],
    "methods": [
      {
        "signature": "focus(options?: FocusOptions): void",
        "description": "Moves focus to the hidden native input."
      }
    ],
    "events": [
      {
        "name": "change",
        "detail": "null",
        "description": "Fired when a user interaction (tap, drag release, or Space/Enter) actually changes the state. Composed and bubbling; not fired for programmatic changes or drags that settle back."
      }
    ],
    "slots": [
      {
        "name": "(default)",
        "description": "The visible label text next to the track."
      }
    ],
    "parts": [
      {
        "name": "wrap",
        "description": "The <label> row wrapping track and text."
      },
      {
        "name": "input",
        "description": "The visually-hidden native checkbox with role=\"switch\"."
      },
      {
        "name": "track",
        "description": "The capsule drag surface the canvas paints behind."
      },
      {
        "name": "jelly",
        "description": "The canvas the track and thumb bodies are painted on."
      }
    ],
    "cssProperties": [
      {
        "name": "--jelly-switch-width",
        "default": "62px",
        "description": "Track width (50 / 62 / 74 px across sizes)."
      },
      {
        "name": "--jelly-switch-height",
        "default": "34px",
        "description": "Track height (28 / 34 / 40 px across sizes)."
      },
      {
        "name": "--jelly-switch-gap",
        "default": "12px",
        "description": "Gap between the track and the label text."
      },
      {
        "name": "--jelly-switch-font-size",
        "default": "15.5px",
        "description": "Label font size."
      },
      {
        "name": "--jelly-off",
        "default": "var(--jelly-color-background-neutral, #DADADA)",
        "description": "Track color at the off end of the crossfade (shared token; any CSS color works)."
      },
      {
        "name": "--jelly-on",
        "default": "var(--jelly-color-background-accent, #0077CC)",
        "description": "Track color at the on end of the crossfade (shared token; any CSS color works)."
      },
      {
        "name": "--jelly-switch-thumb-off",
        "default": "var(--jelly-color-background-white, #FFFFFF)",
        "description": "Thumb foreground over the off track."
      },
      {
        "name": "--jelly-switch-thumb-on",
        "default": "var(--jelly-color-foreground-on-accent, #FFFFFF)",
        "description": "Thumb foreground over the on track; explicit variants replace it with their paired on-color."
      },
      {
        "name": "--jelly-ring",
        "default": "var(--jelly-on, var(--jelly-color-border-focus, #0077CC))",
        "description": "Keyboard focus ring color painted on the canvas (shared token)."
      },
      {
        "name": "--jelly-label",
        "default": "var(--jelly-color-foreground-muted, #5D6474)",
        "description": "Label text color (shared token)."
      }
    ],
    "keyboard": [
      {
        "keys": "Space / Enter",
        "description": "Toggles the switch."
      },
      {
        "keys": "Tab / Shift+Tab",
        "description": "Moves focus in and out; the jiggling canvas focus ring shows on keyboard focus."
      }
    ],
    "examples": [
      {
        "title": "Basic",
        "code": "<jelly-switch checked>Wi-Fi</jelly-switch>"
      },
      {
        "title": "Sizes and variants",
        "code": "<jelly-switch size=\"small\" variant=\"azure\">Bluetooth</jelly-switch>\n<jelly-switch size=\"large\" variant=\"rose\" checked>Do not disturb</jelly-switch>"
      },
      {
        "title": "RTL mirroring and change events",
        "code": "<div dir=\"rtl\">\n  <jelly-switch id=\"sw\" checked>الإشعارات</jelly-switch>\n</div>\n<script>\n  document.getElementById('sw').addEventListener('change', (e) => {\n    console.log('now', e.target.checked ? 'on' : 'off');\n  });\n</script>"
      }
    ]
  },
  {
    "tag": "jelly-textarea",
    "group": "Forms",
    "summary": "A multi-line text field on a jelly surface that auto-grows between a min and max height while the membrane follows, rippling at the caret as you type.",
    "description": "Wraps a real native <textarea> over the canvas jelly body. The control auto-sizes to its content (capped by --jelly-textarea-max-height) and a private ResizeObserver keeps the physics shape in sync. Caret position is measured with a hidden layout mirror that replicates font, width, padding, wrapping and direction, so the ripple lands on the caret even across wrapped lines and in RTL. Form-associated via ElementInternals.",
    "attributes": [
      {
        "name": "value",
        "type": "string",
        "default": "\"\"",
        "description": "The text value. Setting the attribute replaces the content, updates the form value and re-fits the height."
      },
      {
        "name": "placeholder",
        "type": "string",
        "description": "Hint text shown while empty, rendered in the muted text token color."
      },
      {
        "name": "rows",
        "type": "number",
        "description": "Initial native rows hint for the inner textarea (auto-sizing still grows it with content)."
      },
      {
        "name": "label",
        "type": "string",
        "description": "Accessible name for the field, mapped to aria-label on the inner native textarea."
      },
      {
        "name": "name",
        "type": "string",
        "description": "Form field name used on submission (native form association through ElementInternals)."
      },
      {
        "name": "disabled",
        "type": "boolean",
        "default": "false",
        "description": "Disables the inner textarea, removes it from the tab order and paints the surface with the platinum token."
      },
      {
        "name": "readonly",
        "type": "boolean",
        "default": "false",
        "description": "Makes the inner textarea read-only while keeping it focusable."
      },
      {
        "name": "autocomplete",
        "type": "string",
        "description": "Forwarded to the inner textarea's autocomplete (ignored while no-autofill is set)."
      },
      {
        "name": "no-autofill",
        "type": "boolean",
        "default": "false",
        "description": "Suppresses autofill: sets autocomplete=\"off\", disables autocorrect/autocapitalize/spellcheck and sets the opt-out attributes common password managers respect."
      },
      {
        "name": "size",
        "type": "\"small\" | \"medium\" | \"large\"",
        "default": "medium",
        "description": "Size scale (host width 280 / 320 / 380; min-height 76 / 96 / 124). The sm/md/lg aliases are accepted and canonicalized in place, including on dynamic changes."
      },
      {
        "name": "required",
        "type": "boolean",
        "description": "Forwarded to the inner native control and enforced through constraint validation (validity, checkValidity(), :invalid, :state(user-invalid)). An empty field is valueMissing."
      },
      {
        "name": "minlength",
        "type": "number",
        "description": "Forwarded to the inner native control and enforced through constraint validation (validity, checkValidity(), :invalid, :state(user-invalid)). Shorter user-entered text is tooShort."
      },
      {
        "name": "maxlength",
        "type": "number",
        "description": "Forwarded to the inner native control and enforced through constraint validation (validity, checkValidity(), :invalid, :state(user-invalid)). The inner textarea stops accepting text past this length."
      },
      {
        "name": "inputmode",
        "type": "string",
        "description": "Virtual keyboard hint, forwarded to the inner textarea."
      },
      {
        "name": "enterkeyhint",
        "type": "string",
        "description": "Label hint for the virtual keyboard Enter key, forwarded to the inner textarea."
      }
    ],
    "events": [
      {
        "name": "input",
        "detail": "null",
        "description": "Re-dispatched from the host as a composed, bubbling CustomEvent on every edit, after the form value updates and the height re-fits."
      },
      {
        "name": "change",
        "detail": "null",
        "description": "Re-dispatched from the host as a composed, bubbling CustomEvent when the value is committed (native change does not cross the shadow boundary)."
      }
    ],
    "slots": [],
    "properties": [
      {
        "name": "value",
        "type": "string",
        "description": "Read/write text value; setting it also updates the submitted form value and re-fits the height."
      }
    ],
    "methods": [
      {
        "signature": "focus(options?: FocusOptions)",
        "description": "Routes programmatic focus into the inner native textarea."
      }
    ],
    "parts": [
      {
        "name": "jelly",
        "description": "The canvas that paints the soft body, fill, border and focus ring (from the JellyElement base)."
      },
      {
        "name": "textarea",
        "description": "The inner native <textarea>."
      },
      {
        "name": "ring",
        "description": "The forced-colors fallback focus-ring element (transparent otherwise; the real ring is canvas-painted)."
      }
    ],
    "cssProperties": [
      {
        "name": "--jelly-textarea-padding-inline",
        "default": "20px (16px small, 24px large)",
        "description": "Inline padding of the text box."
      },
      {
        "name": "--jelly-textarea-padding-block",
        "default": "16px (13px small, 18px large)",
        "description": "Block padding of the text box."
      },
      {
        "name": "--jelly-textarea-font-size",
        "default": "15.5px (14px small, 16.5px large)",
        "description": "Font size of the field text."
      },
      {
        "name": "--jelly-textarea-radius",
        "default": "18px (15px small, 20px large)",
        "description": "Corner radius of the forced-colors fallback ring (the canvas shape radius is derived from the height)."
      },
      {
        "name": "--jelly-textarea-min-height",
        "default": "96px (76px small, 124px large)",
        "description": "Minimum control height before auto-growing."
      },
      {
        "name": "--jelly-textarea-max-height",
        "default": "240px (200px small, 300px large)",
        "description": "Height cap; past it the content scrolls instead of growing."
      },
      {
        "name": "--jelly-fill",
        "default": "var(--jelly-color-background-muted, #F4F5F7)",
        "description": "Resting surface fill read by the canvas at paint time; flips with the theme. Focus paints var(--jelly-color-background-surface), disabled paints var(--jelly-color-background-neutral)."
      },
      {
        "name": "--jelly-label",
        "default": "var(--jelly-color-foreground-default, #1F2430)",
        "description": "Text color of the field. Placeholder uses var(--jelly-color-foreground-muted)."
      },
      {
        "name": "--jelly-accent",
        "default": "var(--jelly-color-background-accent, #0077CC)",
        "description": "Focused border and ring hue; retint per subtree via <jelly-theme accent>."
      },
      {
        "name": "--jelly-ring",
        "default": "var(--jelly-accent, var(--jelly-color-border-focus, #0077CC))",
        "description": "Focus ring color painted on the canvas (softened with color-mix)."
      }
    ],
    "keyboard": [
      {
        "keys": "Tab / Shift+Tab",
        "description": "Moves focus into / out of the field (host focus is delegated to the inner textarea); focus pops the membrane and shows the ring."
      },
      {
        "keys": "Printable keys, Enter, Backspace, Delete",
        "description": "Native multi-line editing; each edit re-fits the height and ripples the membrane at the caret, wrap- and RTL-aware."
      },
      {
        "keys": "Arrow keys / Home / End / PageUp / PageDown",
        "description": "Native caret movement and scrolling inside the field, honoring the text direction."
      }
    ],
    "examples": [
      {
        "title": "Auto-growing notes field",
        "code": "<jelly-textarea label=\"Notes\" placeholder=\"Notes\" rows=\"4\"></jelly-textarea>"
      },
      {
        "title": "Capped height with a custom max",
        "code": "<jelly-textarea size=\"large\" label=\"Feedback\" name=\"feedback\" no-autofill\n  style=\"--jelly-textarea-max-height: 220px\"></jelly-textarea>"
      },
      {
        "title": "RTL textarea (caret ripple mirrors)",
        "code": "<div dir=\"rtl\">\n  <jelly-textarea label=\"הערות\" placeholder=\"הערות\" rows=\"3\"></jelly-textarea>\n</div>"
      }
    ]
  },
  {
    "tag": "jelly-alert",
    "group": "Feedback",
    "summary": "A callout banner on a jelly surface with four tones and an optional dismiss button.",
    "attributes": [
      {
        "name": "tone",
        "type": "\"info\" | \"success\" | \"warning\" | \"danger\"",
        "default": "info",
        "description": "Picks the icon and its hue (azure / mint / amber / rose tokens)."
      },
      {
        "name": "dismissible",
        "type": "boolean",
        "description": "Shows a ✕ that fires `dismiss` and removes the alert."
      },
      {
        "name": "size",
        "type": "\"small\" | \"medium\" | \"large\"",
        "default": "medium",
        "description": "Density scale."
      }
    ],
    "properties": [],
    "methods": [
      {
        "signature": "shake()",
        "description": "A quick left-right jelly shake."
      },
      {
        "signature": "dismiss()",
        "description": "Fires `dismiss`, fades out and removes the element."
      }
    ],
    "events": [
      {
        "name": "dismiss",
        "detail": "-",
        "description": "Fires when the alert is dismissed (composed, bubbles)."
      }
    ],
    "slots": [
      {
        "name": "(default)",
        "description": "The alert body (a <strong> first line reads as a title)."
      }
    ],
    "parts": [
      {
        "name": "box",
        "description": "The banner layout box (role=\"alert\")."
      },
      {
        "name": "close",
        "description": "The dismiss button."
      },
      {
        "name": "jelly",
        "description": "The canvas."
      }
    ],
    "cssProperties": [
      {
        "name": "--tone",
        "description": "The tone hue (set by the tone attribute)."
      },
      {
        "name": "--jelly-fill",
        "description": "Banner surface (defaults through the surface token)."
      },
      {
        "name": "--jelly-alert-radius",
        "default": "16px",
        "description": "Corner radius (also shapes the jelly)."
      },
      {
        "name": "--jelly-alert-border",
        "description": "Edge colour, a stronger wash of the tone by default."
      },
      {
        "name": "--jelly-alert-icon",
        "default": "22px",
        "description": "Tone icon size."
      },
      {
        "name": "--jelly-alert-close",
        "default": "24px",
        "description": "Dismiss button size."
      },
      {
        "name": "--jelly-alert-gap",
        "default": "12px",
        "description": "Gap between icon, body and dismiss."
      },
      {
        "name": "--jelly-alert-padding-block",
        "default": "15px",
        "description": "Vertical padding."
      },
      {
        "name": "--jelly-alert-padding-inline",
        "default": "16px",
        "description": "Horizontal padding."
      }
    ],
    "keyboard": [
      {
        "keys": "Tab",
        "description": "Reaches the dismiss button when dismissible."
      }
    ],
    "examples": [
      {
        "code": "<jelly-alert tone=\"success\"><strong>Saved!</strong> Your changes are live.</jelly-alert>\n<jelly-alert tone=\"danger\" dismissible>Something broke.</jelly-alert>"
      }
    ]
  },
  {
    "tag": "jelly-badge",
    "group": "Feedback",
    "summary": "A small jelly badge / tag / status pill that pops whenever its text changes.",
    "attributes": [
      {
        "name": "variant",
        "type": "palette name",
        "default": "theme accent",
        "description": "Fill/label pair through the theme tokens; explicit variants use their paired on-color."
      },
      {
        "name": "size",
        "type": "\"small\" | \"medium\" | \"large\"",
        "default": "medium",
        "description": "Pill scale (20 / 24 / 30px tall)."
      },
      {
        "name": "outline",
        "type": "boolean",
        "description": "Hollow variant: a transparent fill with the variant color as the rim and the label in the neutral text color. Handy for showing unselected options alongside a filled current one."
      },
      {
        "name": "shape",
        "type": "\"pill\" | \"square\"",
        "default": "pill",
        "description": "Membrane silhouette. \"square\" swaps the pill for a smaller rounded-rectangle radius (0.32 × height, matching jelly-icon-button's default square); any other value (or none) keeps the full pill. Observed live — changing it reshapes the membrane in place."
      },
      {
        "name": "instant",
        "type": "boolean",
        "description": "Skips the fill-color crossfade, applying a new variant immediately. Handy for badges whose selection swaps rapidly (e.g. driven by scroll)."
      },
      {
        "name": "live",
        "type": "boolean",
        "description": "Adds role=\"status\" + aria-live=\"polite\" so count changes are announced."
      }
    ],
    "properties": [],
    "methods": [],
    "events": [],
    "slots": [
      {
        "name": "(default)",
        "description": "The badge content (count or short text)."
      }
    ],
    "parts": [
      {
        "name": "badge",
        "description": "The pill content span."
      },
      {
        "name": "jelly",
        "description": "The canvas."
      }
    ],
    "cssProperties": [
      {
        "name": "--jelly-fill",
        "description": "Pill fill (set by variant)."
      },
      {
        "name": "--jelly-label",
        "description": "Text color (set by variant)."
      },
      {
        "name": "--jelly-badge-radius",
        "default": "999px (pill); 8px for shape=\"square\"",
        "description": "Corner radius of the painted pill (a plain-px value overrides the shape)."
      }
    ],
    "keyboard": [],
    "examples": [
      {
        "code": "<jelly-badge variant=\"rose\" live>3</jelly-badge>\n<jelly-badge variant=\"mint\">Live</jelly-badge>"
      }
    ]
  },
  {
    "tag": "jelly-progress",
    "group": "Feedback",
    "summary": "A progress bar with a jelly fill whose leading edge wobbles as it advances; indeterminate mode sends a blob bouncing wall to wall.",
    "description": "Proper progressbar ARIA (valuemin/max/now, valuetext while indeterminate). The fill grows from the inline-start edge, so it mirrors on RTL pages. Reduced motion swaps the travelling blob for a calm static one.",
    "attributes": [
      {
        "name": "value",
        "type": "number",
        "default": "0",
        "description": "Current value."
      },
      {
        "name": "max",
        "type": "number",
        "default": "100",
        "description": "Maximum value."
      },
      {
        "name": "indeterminate",
        "type": "boolean",
        "description": "Busy-without-a-value mode: a jelly blob travels the track."
      },
      {
        "name": "size",
        "type": "\"small\" | \"medium\" | \"large\"",
        "default": "medium",
        "description": "Track geometry (10 / 14 / 18px tall)."
      },
      {
        "name": "variant",
        "type": "palette name",
        "description": "Accent hue for the fill."
      },
      {
        "name": "label",
        "type": "string",
        "description": "Accessible name for the progressbar."
      }
    ],
    "properties": [
      {
        "name": "value",
        "type": "number",
        "description": "Get or set the current value."
      },
      {
        "name": "indeterminate",
        "type": "boolean",
        "description": "Get or set the busy-without-a-value state."
      }
    ],
    "methods": [],
    "events": [],
    "slots": [],
    "parts": [
      {
        "name": "jelly",
        "description": "The canvas."
      }
    ],
    "cssProperties": [
      {
        "name": "--jelly-track",
        "description": "Track base color (defaults through the platinum token)."
      },
      {
        "name": "--jelly-accent",
        "description": "Fill color (defaults through the accent token)."
      }
    ],
    "keyboard": [],
    "examples": [
      {
        "code": "<jelly-progress value=\"60\"></jelly-progress>\n<jelly-progress indeterminate variant=\"mint\"></jelly-progress>"
      }
    ]
  },
  {
    "tag": "jelly-skeleton",
    "group": "Feedback",
    "summary": "A loading placeholder that gently breathes — a soft jelly wobble instead of a shimmer.",
    "description": "Each instance randomizes its sweep phase and speed so a page of skeletons never pulses in lock-step. role=\"status\" with aria-busy.",
    "attributes": [
      {
        "name": "shape",
        "type": "\"line\" | \"rect\" | \"circle\"",
        "default": "line",
        "description": "Preset sizes; any width/height set inline wins."
      }
    ],
    "properties": [],
    "methods": [],
    "events": [],
    "slots": [],
    "parts": [
      {
        "name": "jelly",
        "description": "The canvas."
      }
    ],
    "cssProperties": [
      {
        "name": "--jelly-fill",
        "description": "Placeholder fill (defaults through the platinum token, so it dims in dark mode)."
      }
    ],
    "keyboard": [],
    "examples": [
      {
        "code": "<jelly-skeleton style=\"width: 220px; height: 16px\"></jelly-skeleton>\n<jelly-skeleton shape=\"circle\" style=\"width: 44px; height: 44px\"></jelly-skeleton>"
      }
    ]
  },
  {
    "tag": "jelly-spinner",
    "group": "Feedback",
    "summary": "Loading indicators with a jelly soul: a gooey blob gliding between three dots, or a living blob that morphs and spins.",
    "attributes": [
      {
        "name": "type",
        "type": "\"blob\" | \"dots\"",
        "default": "dots",
        "description": "The spinner flavor."
      },
      {
        "name": "variant",
        "type": "palette name",
        "default": "theme accent",
        "description": "Fill hue through the theme tokens."
      },
      {
        "name": "size",
        "type": "\"small\" | \"medium\" | \"large\"",
        "default": "medium",
        "description": "Spinner scale."
      },
      {
        "name": "label",
        "type": "string",
        "default": "Loading",
        "description": "Accessible name (role=\"status\")."
      }
    ],
    "properties": [],
    "methods": [],
    "events": [],
    "slots": [],
    "parts": [
      {
        "name": "jelly",
        "description": "The canvas (blob type)."
      }
    ],
    "cssProperties": [
      {
        "name": "--jelly-fill",
        "description": "Blob / dots fill (set by variant)."
      }
    ],
    "keyboard": [],
    "examples": [
      {
        "code": "<jelly-spinner></jelly-spinner>\n<jelly-spinner type=\"blob\" variant=\"mint\"></jelly-spinner>"
      }
    ]
  },
  {
    "tag": "jelly-toaster",
    "group": "Feedback",
    "summary": "Bubbly toast notifications that pop in from the inline-end and drift away — usually driven through the jellyToast() helper.",
    "description": "jellyToast(message, { tone, duration }) creates a shared <jelly-toaster> on <body> automatically; place one yourself to control stacking. The rail is an aria-live region and every toast carries a spoken tone prefix, so tone is never color-only. Each toast has a keyboard-reachable dismiss button and also dismisses on click or after its duration.",
    "attributes": [
      {
        "name": "quality",
        "type": "\"low\" | \"medium\" | \"high\" (accepts \"lo\" | \"med\" | \"md\" | \"hi\", canonicalized on connect)",
        "default": "medium, or the nearest data-droplet-quality scope",
        "description": "Rendering budget read from the element or the closest data-droplet-quality scope. Reported in Phase 1; nothing acts on it in this component yet."
      },
      {
        "name": "position",
        "type": "\"top\" | \"bottom\"",
        "default": "top",
        "description": "Which edge the stack grows from (logical inline-end side; mirrors in RTL)."
      }
    ],
    "properties": [],
    "methods": [
      {
        "signature": "push(message, { tone = \"info\", duration = 3500 })",
        "description": "Adds a toast; returns its element. duration 0 keeps it until dismissed. Also available globally as jellyToast(message, options)."
      }
    ],
    "events": [],
    "slots": [],
    "parts": [
      {
        "name": "toast",
        "description": "One toast pill."
      },
      {
        "name": "dot",
        "description": "The tone dot inside a toast."
      },
      {
        "name": "close",
        "description": "The dismiss button inside a toast."
      }
    ],
    "cssProperties": [
      {
        "name": "--jelly-toast-radius",
        "default": "999px",
        "description": "Toast pill corner radius."
      },
      {
        "name": "--jelly-toast-font-size",
        "default": "14px",
        "description": "Toast text size."
      }
    ],
    "keyboard": [
      {
        "keys": "Tab, Enter / Space",
        "description": "Reaches and activates a toast's dismiss button."
      }
    ],
    "examples": [
      {
        "title": "Fire a toast",
        "code": "<jelly-button onclick=\"jellyToast('Saved!', { tone: 'success' })\">Toast</jelly-button>"
      }
    ]
  },
  {
    "tag": "jelly-accordion",
    "group": "Surfaces",
    "summary": "Groups <jelly-collapsible> items; `single` mode bounces the others closed when one opens.",
    "attributes": [
      {
        "name": "single",
        "type": "boolean",
        "description": "Allow at most one open item."
      },
      {
        "name": "size",
        "type": "\"small\" | \"medium\" | \"large\"",
        "description": "Propagates to child collapsibles that haven't set their own."
      }
    ],
    "properties": [],
    "methods": [
      {
        "signature": "focus(options?)",
        "description": "Focuses the first item."
      }
    ],
    "events": [
      {
        "name": "toggle",
        "detail": "-",
        "description": "Bubbles up from child collapsibles."
      }
    ],
    "slots": [
      {
        "name": "(default)",
        "description": "<jelly-collapsible> items."
      }
    ],
    "parts": [],
    "cssProperties": [
      {
        "name": "--jelly-accordion-radius",
        "default": "12px",
        "description": "Corner radius of the grouped items."
      }
    ],
    "keyboard": [],
    "examples": [
      {
        "code": "<jelly-accordion single>\n  <jelly-collapsible open><span slot=\"header\">Motion</span>Soft and contained.</jelly-collapsible>\n  <jelly-collapsible><span slot=\"header\">Forms</span>Native and composed.</jelly-collapsible>\n</jelly-accordion>"
      }
    ]
  },
  {
    "tag": "jelly-card",
    "group": "Surfaces",
    "summary": "A jelly surface container; add `squish` to make it press in like a soft cushion and act as a button.",
    "attributes": [
      {
        "name": "squish",
        "type": "boolean",
        "description": "Pressable mode: tabindex=0 + role=\"button\", pointer presses dent the surface, Enter/Space activates with a composed click."
      },
      {
        "name": "size",
        "type": "\"small\" | \"medium\" | \"large\"",
        "default": "medium",
        "description": "Padding / radius / type scale."
      }
    ],
    "properties": [],
    "methods": [
      {
        "signature": "focus(options?)",
        "description": "Focuses the card surface (squish mode)."
      }
    ],
    "events": [
      {
        "name": "click",
        "detail": "-",
        "description": "In squish mode: pointer tap, or a synthetic composed click on Enter/Space keyup."
      }
    ],
    "slots": [
      {
        "name": "(default)",
        "description": "Card content."
      }
    ],
    "parts": [
      {
        "name": "card",
        "description": "The padded content box."
      },
      {
        "name": "jelly",
        "description": "The canvas."
      }
    ],
    "cssProperties": [
      {
        "name": "--jelly-fill",
        "description": "Card surface (defaults through the surface token)."
      },
      {
        "name": "--jelly-radius",
        "default": "22px",
        "description": "Corner radius (also shapes the jelly)."
      },
      {
        "name": "--jelly-card-padding-block",
        "default": "22px",
        "description": "Vertical padding."
      },
      {
        "name": "--jelly-card-padding-inline",
        "default": "24px",
        "description": "Horizontal padding."
      }
    ],
    "keyboard": [
      {
        "keys": "Enter / Space",
        "description": "Squish mode: press-and-hold squishes; release activates."
      }
    ],
    "examples": [
      {
        "code": "<jelly-card style=\"max-width: 360px\"><h3>Title</h3><p>Cards keep their jelly under the content.</p></jelly-card>"
      },
      {
        "title": "Pressable",
        "code": "<jelly-card squish style=\"max-width: 240px\">Tap me</jelly-card>"
      }
    ]
  },
  {
    "tag": "jelly-chip",
    "group": "Surfaces",
    "summary": "A small jelly capsule: static label, toggleable filter, or removable tag.",
    "description": "Selecting bulges the jelly out and crossfades the fill toward the accent; removing fires a cancelable `remove` event, then collapses the chip's width so neighbours slide in organically.",
    "attributes": [
      {
        "name": "selectable",
        "type": "boolean",
        "description": "Makes the chip a toggle button (aria-pressed)."
      },
      {
        "name": "selected",
        "type": "boolean",
        "description": "The toggle state."
      },
      {
        "name": "removable",
        "type": "boolean",
        "description": "Adds the ✕ remove button."
      },
      {
        "name": "variant",
        "type": "palette name",
        "default": "accent",
        "description": "The selected fill hue."
      },
      {
        "name": "size",
        "type": "\"small\" | \"medium\" | \"large\"",
        "default": "medium",
        "description": "Capsule scale (30 / 36 / 42px tall)."
      },
      {
        "name": "shape",
        "type": "\"pill\" | \"square\"",
        "default": "pill",
        "description": "Membrane silhouette. \"square\" swaps the pill for a smaller rounded-rectangle radius (matching jelly-button and jelly-badge); any other value (or none) keeps the full pill. Observed live."
      },
      {
        "name": "disabled",
        "type": "boolean",
        "description": "Disables all interaction."
      }
    ],
    "properties": [
      {
        "name": "selected",
        "type": "boolean",
        "description": "Get or set the toggle state."
      }
    ],
    "methods": [
      {
        "signature": "focus(options?)",
        "description": "Focuses the chip's main (or remove) button."
      }
    ],
    "events": [
      {
        "name": "change",
        "detail": "-",
        "description": "Fires when the selection toggles."
      },
      {
        "name": "remove",
        "detail": "-",
        "description": "Cancelable; preventDefault() keeps the chip in the DOM."
      }
    ],
    "slots": [
      {
        "name": "(default)",
        "description": "The chip label."
      }
    ],
    "parts": [
      {
        "name": "chip",
        "description": "The capsule layout."
      },
      {
        "name": "main",
        "description": "The label / toggle button."
      },
      {
        "name": "remove",
        "description": "The ✕ button."
      },
      {
        "name": "jelly",
        "description": "The canvas."
      }
    ],
    "cssProperties": [
      {
        "name": "--jelly-fill",
        "description": "Resting fill (platinum token)."
      },
      {
        "name": "--jelly-on",
        "description": "Selected fill (accent token, or the variant hue)."
      },
      {
        "name": "--jelly-label",
        "description": "Resting label color."
      },
      {
        "name": "--jelly-label-on",
        "description": "Selected label color."
      },
      {
        "name": "--jelly-chip-radius",
        "default": "999px (pill); 9-13px for shape=\"square\"",
        "description": "Corner radius of the painted chip (a plain-px value overrides the shape)."
      }
    ],
    "keyboard": [
      {
        "keys": "Enter / Space",
        "description": "Toggles a selectable chip."
      }
    ],
    "examples": [
      {
        "code": "<jelly-chip>Design</jelly-chip>\n<jelly-chip selectable selected variant=\"mint\">Filter</jelly-chip>\n<jelly-chip removable>Dismiss me</jelly-chip>"
      }
    ]
  },
  {
    "tag": "jelly-collapsible",
    "group": "Surfaces",
    "summary": "A bouncy disclosure section: a header button springs its panel open and closed.",
    "description": "Proper disclosure semantics (aria-expanded, aria-controls, a named region) and exactly one `toggle` event per real state change. The chevron mirrors in RTL.",
    "attributes": [
      {
        "name": "quality",
        "type": "\"low\" | \"medium\" | \"high\" (accepts \"lo\" | \"med\" | \"md\" | \"hi\", canonicalized on connect)",
        "default": "medium, or the nearest data-droplet-quality scope",
        "description": "Rendering budget read from the element or the closest data-droplet-quality scope. Reported in Phase 1; nothing acts on it in this component yet."
      },
      {
        "name": "open",
        "type": "boolean",
        "description": "The expanded state (reflected)."
      },
      {
        "name": "size",
        "type": "\"small\" | \"medium\" | \"large\"",
        "default": "medium",
        "description": "Density scale."
      }
    ],
    "properties": [
      {
        "name": "open",
        "type": "boolean",
        "description": "Get or set the expanded state."
      }
    ],
    "methods": [
      {
        "signature": "toggle(force?)",
        "description": "Flips (or forces) the open state; fires toggle only on a real change."
      },
      {
        "signature": "focus(options?)",
        "description": "Focuses the header button."
      }
    ],
    "events": [
      {
        "name": "toggle",
        "detail": "-",
        "description": "Fires once per open/close change."
      }
    ],
    "slots": [
      {
        "name": "header",
        "description": "The header label."
      },
      {
        "name": "(default)",
        "description": "The collapsible content."
      }
    ],
    "parts": [
      {
        "name": "header",
        "description": "The header button."
      }
    ],
    "cssProperties": [
      {
        "name": "--jelly-collapsible-padding-block",
        "default": "13px",
        "description": "Header vertical padding."
      },
      {
        "name": "--jelly-collapsible-padding-inline",
        "default": "14px",
        "description": "Header horizontal padding."
      },
      {
        "name": "--jelly-collapsible-radius",
        "default": "12px",
        "description": "Header corner radius."
      }
    ],
    "keyboard": [
      {
        "keys": "Enter / Space",
        "description": "Toggles the section."
      }
    ],
    "examples": [
      {
        "code": "<jelly-collapsible open>\n  <span slot=\"header\">What moves?</span>\n  The surface, not the text.\n</jelly-collapsible>"
      }
    ]
  },
  {
    "tag": "jelly-divider",
    "group": "Surfaces",
    "summary": "A hairline separator: horizontal, vertical, or labelled.",
    "attributes": [
      {
        "name": "direction",
        "type": "\"vertical\"",
        "description": "A column rule instead of a row rule."
      },
      {
        "name": "content",
        "type": "string",
        "default": "(text content)",
        "description": "The label; falls back to slotted text."
      },
      {
        "name": "size",
        "type": "\"small\" | \"medium\" | \"large\"",
        "default": "medium",
        "description": "Label type scale."
      }
    ],
    "properties": [
      {
        "name": "content",
        "type": "string",
        "description": "Read-only resolved visible text (the content attribute, else slotted text)."
      },
      {
        "name": "label",
        "type": "string",
        "description": "Alias of content (kept for compatibility; label means the aria-label on other components)."
      }
    ],
    "methods": [],
    "events": [],
    "slots": [
      {
        "name": "(default)",
        "description": "Optional label text."
      }
    ],
    "parts": [],
    "cssProperties": [
      {
        "name": "--jelly-divider",
        "description": "Line color (line token)."
      },
      {
        "name": "--jelly-divider-font-size",
        "default": "12px",
        "description": "Label font size."
      },
      {
        "name": "--jelly-divider-gap",
        "default": "14px",
        "description": "Gap between line and label."
      }
    ],
    "keyboard": [],
    "examples": [
      {
        "title": "Horizontal rule",
        "code": "<div style=\"width: 260px; display: grid; gap: 14px\">\n  Above the line\n  <jelly-divider></jelly-divider>\n  Below the line\n</div>"
      },
      {
        "title": "Labelled",
        "code": "<div style=\"width: 260px\">\n  <jelly-divider>or</jelly-divider>\n</div>"
      },
      {
        "title": "Vertical",
        "code": "<div style=\"display: flex; align-items: center; gap: 14px; height: 44px\">\n  Left\n  <jelly-divider direction=\"vertical\"></jelly-divider>\n  Right\n</div>"
      }
    ]
  },
  {
    "tag": "jelly-kbd",
    "group": "Surfaces",
    "summary": "A jelly keyboard key: poke it, or bind it to a real key so it depresses whenever that key is held.",
    "attributes": [
      {
        "name": "key",
        "type": "key name",
        "description": "Mirrors this physical key document-wide (e.g. key=\"k\", key=\"Meta\", key=\"Meta+k\"). Stays still while the visitor types in a field, with Ctrl, Alt, or Meta held that the value doesn't name, or inside data-droplet-shortcuts=\"off\"."
      },
      {
        "name": "decorative",
        "type": "boolean",
        "description": "Display-only hint: no button role and no tab stop, so the cap can sit inside a real button whose accessible name keeps the key text."
      },
      {
        "name": "size",
        "type": "\"small\" | \"medium\" | \"large\"",
        "default": "medium",
        "description": "Cap scale (24 / 28 / 34px tall)."
      }
    ],
    "properties": [],
    "methods": [],
    "events": [],
    "slots": [
      {
        "name": "(default)",
        "description": "The key legend."
      }
    ],
    "parts": [
      {
        "name": "cap",
        "description": "The keycap (travels down 2px while pressed)."
      },
      {
        "name": "jelly",
        "description": "The canvas."
      }
    ],
    "cssProperties": [
      {
        "name": "--jelly-fill",
        "description": "Cap fill (platinum token)."
      },
      {
        "name": "--jelly-label",
        "description": "Legend color."
      }
    ],
    "keyboard": [
      {
        "keys": "Enter / Space",
        "description": "Depresses the focused cap."
      },
      {
        "keys": "(bound key)",
        "description": "With key=\"…\", holding that key anywhere presses the cap. Put data-droplet-shortcuts=\"off\" on any ancestor (the closest one wins) to silence it (WCAG 2.1.4)."
      }
    ],
    "examples": [
      {
        "code": "<jelly-kbd key=\"Meta\">⌘</jelly-kbd><jelly-kbd key=\"Meta+k\">K</jelly-kbd>"
      }
    ]
  },
  {
    "tag": "jelly-breadcrumbs",
    "group": "Navigation",
    "summary": "A breadcrumb trail built from light-DOM children; the last item is the current page.",
    "description": "Rebuilds automatically when items change. The separator chevron mirrors in RTL and the trail is a labelled <nav> with aria-current on the last crumb.",
    "attributes": [
      {
        "name": "size",
        "type": "\"small\" | \"medium\" | \"large\"",
        "default": "medium",
        "description": "Type scale."
      }
    ],
    "properties": [],
    "methods": [
      {
        "signature": "focus(options?)",
        "description": "Focuses the first link."
      }
    ],
    "events": [],
    "slots": [
      {
        "name": "(default)",
        "description": "The crumb sources: <a href> for links, anything else for the current page."
      }
    ],
    "parts": [],
    "cssProperties": [
      {
        "name": "--jelly-breadcrumbs-font-size",
        "default": "13.5px",
        "description": "Crumb font size."
      },
      {
        "name": "--jelly-breadcrumbs-radius",
        "default": "9px",
        "description": "Hover pill radius."
      }
    ],
    "keyboard": [],
    "examples": [
      {
        "code": "<jelly-breadcrumbs>\n  <a href=\"#\">Home</a><a href=\"#\">Library</a><span>Switch</span>\n</jelly-breadcrumbs>"
      }
    ]
  },
  {
    "tag": "jelly-pagination",
    "group": "Navigation",
    "summary": "Page navigation built from jelly buttons, with a windowed page list and direction-aware arrows.",
    "attributes": [
      {
        "name": "total",
        "type": "number",
        "default": "1",
        "description": "Total page count."
      },
      {
        "name": "page",
        "type": "number",
        "default": "1",
        "description": "The current page (clamped into range)."
      },
      {
        "name": "size",
        "type": "\"small\" | \"medium\" | \"large\"",
        "default": "small",
        "description": "Passed to the child buttons."
      }
    ],
    "properties": [
      {
        "name": "page",
        "type": "number",
        "description": "Get or set the current page."
      },
      {
        "name": "total",
        "type": "number",
        "description": "Read-only total."
      }
    ],
    "methods": [
      {
        "signature": "focus(options?)",
        "description": "Focuses the current (or first enabled) page button."
      }
    ],
    "events": [
      {
        "name": "change",
        "detail": "{ page }",
        "description": "Fires when the page changes."
      }
    ],
    "slots": [],
    "parts": [],
    "cssProperties": [
      {
        "name": "--jelly-pagination-gap",
        "default": "7px",
        "description": "Gap between buttons."
      }
    ],
    "keyboard": [
      {
        "keys": "Tab + Enter / Space",
        "description": "Standard button navigation (each page is a jelly-button)."
      }
    ],
    "examples": [
      {
        "code": "<jelly-pagination total=\"12\" page=\"3\"></jelly-pagination>"
      }
    ]
  },
  {
    "tag": "jelly-resizable",
    "group": "Navigation",
    "summary": "A resizable panel grid: drag the jelly dividers, or resize from the keyboard.",
    "description": "Dividers follow the window-splitter pattern — focusable separators with live aria-valuenow (percent of the first pane). Horizontal drags and arrow keys respect reading direction.",
    "attributes": [
      {
        "name": "direction",
        "type": "\"row\" | \"vertical\" | \"both\"",
        "default": "row",
        "description": "Side-by-side panes, stacked panes, or a 2×2 two-axis split."
      }
    ],
    "properties": [
      {
        "name": "sizes",
        "type": "number[] | { cols, rows }",
        "description": "The current pane fractions (each axis sums to 1); a flat array for a single axis, or { cols, rows } for the 2x2 layout."
      }
    ],
    "methods": [
      {
        "signature": "focus(options?)",
        "description": "Focuses the first divider."
      }
    ],
    "events": [
      {
        "name": "change",
        "detail": "{ sizes }",
        "description": "Fires when a resize commits (drag end or keyboard step); detail.sizes is the new layout."
      }
    ],
    "slots": [
      {
        "name": "(default)",
        "description": "The panes (each child becomes one)."
      }
    ],
    "parts": [
      {
        "name": "container",
        "description": "The flex/grid layout container."
      }
    ],
    "cssProperties": [
      {
        "name": "--jelly-resizable-handle",
        "description": "Divider handle color (platinum token)."
      },
      {
        "name": "--jelly-resizable-handle-active",
        "description": "Hover / drag handle color (accent token)."
      }
    ],
    "keyboard": [
      {
        "keys": "Arrow keys",
        "description": "Moves the focused divider one step (direction-aware on horizontal dividers)."
      }
    ],
    "examples": [
      {
        "title": "Side by side",
        "code": "<jelly-resizable style=\"height: 220px; width: 100%; border: 1px solid var(--jelly-color-border-default, #ECECEF); border-radius: 14px\">\n  <div style=\"padding: 14px\">Left</div>\n  <div style=\"padding: 14px\">Middle</div>\n  <div style=\"padding: 14px\">Right</div>\n</jelly-resizable>"
      },
      {
        "title": "Stacked",
        "code": "<jelly-resizable direction=\"vertical\" style=\"height: 260px; width: 100%; border: 1px solid var(--jelly-color-border-default, #ECECEF); border-radius: 14px\">\n  <div style=\"padding: 14px\">Top</div>\n  <div style=\"padding: 14px\">Bottom</div>\n</jelly-resizable>"
      },
      {
        "title": "Two axes",
        "code": "<jelly-resizable direction=\"both\" style=\"height: 280px; width: 100%; border: 1px solid var(--jelly-color-border-default, #ECECEF); border-radius: 14px\">\n  <div style=\"padding: 14px\">One</div>\n  <div style=\"padding: 14px\">Two</div>\n  <div style=\"padding: 14px\">Three</div>\n  <div style=\"padding: 14px\">Four</div>\n</jelly-resizable>"
      }
    ]
  },
  {
    "tag": "jelly-tab-panel",
    "group": "Navigation",
    "summary": "One panel inside <jelly-tabs>: shown when its tab is active, hidden otherwise.",
    "attributes": [
      {
        "name": "label",
        "type": "string",
        "description": "The tab label (also the panel's accessible name)."
      },
      {
        "name": "value",
        "type": "string",
        "default": "(index)",
        "description": "The value reported by jelly-tabs."
      },
      {
        "name": "active",
        "type": "boolean",
        "description": "Marks the initially visible panel."
      }
    ],
    "properties": [
      {
        "name": "label",
        "type": "string",
        "description": "Read-only label."
      }
    ],
    "methods": [],
    "events": [],
    "slots": [
      {
        "name": "(default)",
        "description": "Panel content."
      }
    ],
    "parts": [],
    "cssProperties": [],
    "keyboard": [],
    "examples": [
      {
        "code": "<jelly-tab-panel label=\"Overview\" active>…</jelly-tab-panel>"
      }
    ]
  },
  {
    "tag": "jelly-tabs",
    "group": "Navigation",
    "summary": "Tabbed views: a sliding jelly pill tab bar with real tablist semantics and panels that bounce in.",
    "description": "The tab bar is a <jelly-segmented roles=\"tablist\">, so tabs are announced as tabs with aria-selected. Panels are light-DOM <jelly-tab-panel> children; each panel is named after its tab label.",
    "attributes": [
      {
        "name": "value",
        "type": "string",
        "default": "(the panel marked active, else the first)",
        "description": "The active panel's value. Observed live — setting it switches tabs, like assigning the value property."
      },
      {
        "name": "size",
        "type": "\"small\" | \"medium\" | \"large\"",
        "description": "Passed to the tab bar."
      }
    ],
    "properties": [
      {
        "name": "value",
        "type": "string",
        "description": "Get or set the active panel value."
      }
    ],
    "methods": [
      {
        "signature": "focus(options?)",
        "description": "Focuses the active tab."
      }
    ],
    "events": [
      {
        "name": "change",
        "detail": "-",
        "description": "Fires when the active tab changes (not on initial mount)."
      }
    ],
    "slots": [
      {
        "name": "(default)",
        "description": "<jelly-tab-panel> children."
      }
    ],
    "parts": [
      {
        "name": "tabs",
        "description": "The inner jelly-segmented tab bar."
      }
    ],
    "cssProperties": [],
    "keyboard": [
      {
        "keys": "Arrow keys",
        "description": "Move between tabs (direction-aware, wraps)."
      },
      {
        "keys": "Home / End",
        "description": "First / last tab."
      }
    ],
    "examples": [
      {
        "code": "<jelly-tabs>\n  <jelly-tab-panel label=\"Overview\" active>Project summary.</jelly-tab-panel>\n  <jelly-tab-panel label=\"Activity\">Recent events.</jelly-tab-panel>\n</jelly-tabs>"
      }
    ]
  },
  {
    "tag": "jelly-dialog",
    "group": "Overlays",
    "summary": "A modal dialog that springs in with a jello pop, locks the page and returns focus on close.",
    "description": "While open it portals itself to <body>, freezes background scroll, inerts everything behind it (a true focus trap for keyboard and screen readers) and restores it all on close — even if removed mid-open. Named by its label attribute or its first heading.",
    "attributes": [
      {
        "name": "open",
        "type": "boolean",
        "description": "The open state (reflected; the closing animation plays before it drops)."
      },
      {
        "name": "label",
        "type": "string",
        "description": "Accessible name (falls back to the first h1–h3)."
      }
    ],
    "properties": [
      {
        "name": "open",
        "type": "boolean",
        "description": "Get or set the open state."
      }
    ],
    "methods": [
      {
        "signature": "showModal()",
        "description": "Opens the dialog (mirrors the native API)."
      },
      {
        "signature": "focus(options?)",
        "description": "Focuses the dialog surface."
      }
    ],
    "events": [
      {
        "name": "open",
        "detail": "-",
        "description": "Fires when the dialog opens."
      },
      {
        "name": "close",
        "detail": "-",
        "description": "Fires when it closes."
      }
    ],
    "slots": [
      {
        "name": "(default)",
        "description": "Dialog content (first heading becomes the accessible name)."
      }
    ],
    "parts": [
      {
        "name": "dialog",
        "description": "The dialog surface."
      },
      {
        "name": "backdrop",
        "description": "The dimming backdrop."
      }
    ],
    "cssProperties": [
      {
        "name": "--jelly-dialog-radius",
        "default": "24px",
        "description": "Surface corner radius."
      },
      {
        "name": "--jelly-dialog-padding",
        "default": "26px",
        "description": "Surface padding."
      },
      {
        "name": "--jelly-dialog-width",
        "default": "min(460px, 100%)",
        "description": "Surface width."
      }
    ],
    "keyboard": [
      {
        "keys": "Escape",
        "description": "Closes the dialog."
      },
      {
        "keys": "Tab",
        "description": "Cycles inside the dialog only (everything behind is inert)."
      }
    ],
    "examples": [
      {
        "code": "<jelly-button size=\"small\" onclick=\"this.nextElementSibling.open = true\">Open dialog</jelly-button>\n<jelly-dialog label=\"Example\">\n  <h2>Hello</h2>\n  <p>Escape, the ✕, or the backdrop closes me.</p>\n</jelly-dialog>"
      }
    ]
  },
  {
    "tag": "jelly-drawer",
    "group": "Overlays",
    "summary": "A floating slide-in sheet with a springy overshoot, from the inline-end, inline-start, or bottom.",
    "description": "side accepts logical end (default) / start — which mirror in RTL — plus physical right / left / bottom. Same modal plumbing as the dialog: portal, scroll lock, inert background, focus restore.",
    "attributes": [
      {
        "name": "open",
        "type": "boolean",
        "description": "The open state (reflected; the slide-out plays before it drops)."
      },
      {
        "name": "side",
        "type": "\"end\" | \"start\" | \"right\" | \"left\" | \"bottom\"",
        "default": "end",
        "description": "Which edge the sheet slides from. end/start follow reading direction."
      },
      {
        "name": "label",
        "type": "string",
        "description": "Accessible name (falls back to the first h1–h3)."
      }
    ],
    "properties": [
      {
        "name": "open",
        "type": "boolean",
        "description": "Get or set the open state."
      }
    ],
    "methods": [
      {
        "signature": "focus(options?)",
        "description": "Focuses the sheet."
      }
    ],
    "events": [
      {
        "name": "open",
        "detail": "-",
        "description": "Fires when the drawer opens."
      },
      {
        "name": "close",
        "detail": "-",
        "description": "Fires when it closes."
      }
    ],
    "slots": [
      {
        "name": "(default)",
        "description": "Sheet content."
      }
    ],
    "parts": [
      {
        "name": "sheet",
        "description": "The floating sheet."
      },
      {
        "name": "backdrop",
        "description": "The dimming backdrop."
      },
      {
        "name": "close",
        "description": "The close button."
      }
    ],
    "cssProperties": [
      {
        "name": "--jelly-drawer-radius",
        "default": "24px",
        "description": "Sheet corner radius."
      },
      {
        "name": "--jelly-drawer-padding",
        "default": "22px",
        "description": "Sheet padding."
      }
    ],
    "keyboard": [
      {
        "keys": "Escape",
        "description": "Closes the drawer."
      }
    ],
    "examples": [
      {
        "code": "<jelly-button size=\"small\" onclick=\"this.nextElementSibling.open = true\">Open drawer</jelly-button>\n<jelly-drawer label=\"Navigation\">\n  <h3>Drawer</h3>\n  <p>I float in from the inline-end.</p>\n</jelly-drawer>"
      }
    ]
  },
  {
    "tag": "jelly-menu",
    "group": "Overlays",
    "summary": "A dropdown action menu with roving focus, typeahead keyboard support and declarative light-DOM items.",
    "description": "Items are <jelly-menu-item> children, re-read on every open so dynamic additions always appear. Focus roves between rows (arrows wrap and skip disabled items); Escape or Tab closes and returns focus to the trigger.",
    "attributes": [
      {
        "name": "placement",
        "type": "\"top\" | \"bottom\" | \"left\" | \"right\" | \"start\" | \"end\"",
        "default": "bottom",
        "description": "Preferred side (flips when clipped)."
      },
      {
        "name": "size",
        "type": "\"small\" | \"medium\" | \"large\"",
        "default": "medium",
        "description": "Menu scale."
      }
    ],
    "properties": [
      {
        "name": "trigger",
        "type": "Element",
        "description": "Read-only: the current slotted trigger."
      }
    ],
    "methods": [
      {
        "signature": "open()",
        "description": "Opens the menu and focuses the first enabled item."
      },
      {
        "signature": "close()",
        "description": "Closes it and restores focus to the trigger."
      },
      {
        "signature": "toggle()",
        "description": "Flips between the two."
      }
    ],
    "events": [
      {
        "name": "select",
        "detail": "{ value, item }",
        "description": "Fires when an item is picked."
      },
      {
        "name": "open",
        "detail": "-",
        "description": "Fires when the menu opens."
      },
      {
        "name": "close",
        "detail": "-",
        "description": "Fires when it closes."
      }
    ],
    "slots": [
      {
        "name": "trigger",
        "description": "The element that toggles the menu."
      },
      {
        "name": "(default)",
        "description": "<jelly-menu-item> children."
      }
    ],
    "parts": [
      {
        "name": "menu",
        "description": "The floating menu surface (role=\"menu\")."
      }
    ],
    "cssProperties": [
      {
        "name": "--jelly-menu-min-width",
        "default": "190px",
        "description": "Menu minimum width."
      },
      {
        "name": "--jelly-menu-item-height",
        "default": "40px",
        "description": "Row height."
      },
      {
        "name": "--jelly-menu-radius",
        "default": "15px",
        "description": "Panel corner radius."
      },
      {
        "name": "--jelly-menu-padding",
        "default": "7px",
        "description": "Padding around the row list."
      },
      {
        "name": "--jelly-menu-font-size",
        "default": "14.5px",
        "description": "Row text size."
      },
      {
        "name": "--jelly-menu-item-padding-inline",
        "default": "12px",
        "description": "Row horizontal padding."
      },
      {
        "name": "--jelly-menu-item-radius",
        "default": "9px",
        "description": "Row corner radius."
      }
    ],
    "keyboard": [
      {
        "keys": "Arrow Up / Down",
        "description": "Rove between items (wraps, skips disabled)."
      },
      {
        "keys": "Home / End",
        "description": "First / last enabled item."
      },
      {
        "keys": "Enter / Space",
        "description": "Picks the focused item."
      },
      {
        "keys": "Escape / Tab",
        "description": "Closes and returns focus to the trigger."
      }
    ],
    "examples": [
      {
        "code": "<jelly-menu>\n  <jelly-button slot=\"trigger\" size=\"small\">Actions</jelly-button>\n  <jelly-menu-item value=\"edit\">Edit</jelly-menu-item>\n  <jelly-menu-item value=\"duplicate\">Duplicate</jelly-menu-item>\n  <jelly-menu-item value=\"delete\" danger>Delete</jelly-menu-item>\n</jelly-menu>"
      }
    ]
  },
  {
    "tag": "jelly-menu-item",
    "group": "Overlays",
    "summary": "One entry inside <jelly-menu>: declarative value, disabled and danger states.",
    "attributes": [
      {
        "name": "value",
        "type": "string",
        "default": "(text content)",
        "description": "The value reported in the select event."
      },
      {
        "name": "disabled",
        "type": "boolean",
        "description": "Unpickable, skipped by keyboard navigation."
      },
      {
        "name": "danger",
        "type": "boolean",
        "description": "Destructive styling (rose)."
      }
    ],
    "properties": [
      {
        "name": "value",
        "type": "string",
        "description": "Read-only resolved value."
      },
      {
        "name": "disabled",
        "type": "boolean",
        "description": "Read-only disabled state."
      }
    ],
    "methods": [],
    "events": [],
    "slots": [
      {
        "name": "(default)",
        "description": "The item content."
      }
    ],
    "parts": [],
    "cssProperties": [],
    "keyboard": [],
    "examples": [
      {
        "code": "<jelly-menu-item value=\"delete\" danger>Delete</jelly-menu-item>"
      }
    ]
  },
  {
    "tag": "jelly-popover",
    "group": "Overlays",
    "summary": "A click-triggered floating panel: non-modal, anchored to its trigger, dismissed by Escape or clicking outside.",
    "description": "Focus moves into the panel on open and returns to the trigger on close. The trigger is resolved live from its slot, so swapping it never leaves a stale reference.",
    "attributes": [
      {
        "name": "placement",
        "type": "\"top\" | \"bottom\" | \"left\" | \"right\" | \"start\" | \"end\"",
        "default": "bottom",
        "description": "Preferred side (flips when clipped)."
      },
      {
        "name": "label",
        "type": "string",
        "description": "Accessible name for the panel dialog."
      },
      {
        "name": "size",
        "type": "\"small\" | \"medium\" | \"large\"",
        "default": "medium",
        "description": "Panel scale."
      }
    ],
    "properties": [
      {
        "name": "trigger",
        "type": "Element",
        "description": "Read-only: the current slotted trigger."
      }
    ],
    "methods": [
      {
        "signature": "open()",
        "description": "Opens the panel."
      },
      {
        "signature": "close()",
        "description": "Closes it and restores focus."
      },
      {
        "signature": "toggle()",
        "description": "Flips between the two."
      }
    ],
    "events": [
      {
        "name": "open",
        "detail": "-",
        "description": "Fires when the panel opens."
      },
      {
        "name": "close",
        "detail": "-",
        "description": "Fires when it closes."
      }
    ],
    "slots": [
      {
        "name": "trigger",
        "description": "The element that toggles the panel."
      },
      {
        "name": "content",
        "description": "The panel content."
      }
    ],
    "parts": [
      {
        "name": "panel",
        "description": "The floating panel (role=\"dialog\", aria-modal=\"false\")."
      }
    ],
    "cssProperties": [
      {
        "name": "--jelly-popover-min-width",
        "default": "180px",
        "description": "Panel minimum width."
      },
      {
        "name": "--jelly-popover-radius",
        "default": "16px",
        "description": "Panel corner radius."
      }
    ],
    "keyboard": [
      {
        "keys": "Escape",
        "description": "Closes the panel."
      }
    ],
    "examples": [
      {
        "code": "<jelly-popover placement=\"bottom\" label=\"Options\">\n  <jelly-button slot=\"trigger\" size=\"small\">Options</jelly-button>\n  <div slot=\"content\">Anything can live here.</div>\n</jelly-popover>"
      }
    ]
  },
  {
    "tag": "jelly-tooltip",
    "group": "Overlays",
    "summary": "A lightweight tooltip that anchors a themed bubble over its trigger on hover or keyboard focus.",
    "description": "The tooltip text is exposed as the trigger's accessible description via ARIA reflection (idrefs can't cross shadow roots). Escape dismisses without moving the pointer (WCAG 1.4.13). The bubble inverts with the theme and stays AA in both modes.",
    "attributes": [
      {
        "name": "text",
        "type": "string",
        "description": "The tooltip text (observed live)."
      },
      {
        "name": "placement",
        "type": "\"top\" | \"bottom\" | \"left\" | \"right\" | \"start\" | \"end\"",
        "default": "top",
        "description": "Preferred side; flips when it would clip and start/end follow reading direction."
      },
      {
        "name": "size",
        "type": "\"small\" | \"medium\" | \"large\"",
        "default": "medium",
        "description": "Bubble scale."
      }
    ],
    "properties": [],
    "methods": [
      {
        "signature": "show()",
        "description": "Shows the bubble (positions + tracks the trigger)."
      },
      {
        "signature": "hide()",
        "description": "Hides the bubble and stops tracking."
      }
    ],
    "events": [],
    "slots": [
      {
        "name": "(default)",
        "description": "The trigger element."
      },
      {
        "name": "content",
        "description": "Rich bubble content (replaces the text attribute)."
      }
    ],
    "parts": [],
    "cssProperties": [
      {
        "name": "--jelly-tooltip-background",
        "description": "Bubble fill (defaults to the text token, inverting per theme)."
      },
      {
        "name": "--jelly-tooltip-max-width",
        "default": "240px",
        "description": "Bubble wrap width."
      },
      {
        "name": "--jelly-tooltip-color",
        "description": "Bubble text colour (defaults to the surface token)."
      },
      {
        "name": "--jelly-tooltip-radius",
        "default": "11px",
        "description": "Bubble corner radius."
      },
      {
        "name": "--jelly-tooltip-font-size",
        "default": "12.5px",
        "description": "Bubble text size."
      },
      {
        "name": "--jelly-tooltip-padding-block",
        "description": "Bubble vertical padding."
      },
      {
        "name": "--jelly-tooltip-padding-inline",
        "description": "Bubble horizontal padding."
      }
    ],
    "keyboard": [
      {
        "keys": "Escape",
        "description": "Dismisses the visible tooltip."
      }
    ],
    "examples": [
      {
        "code": "<jelly-tooltip text=\"Copy link\" placement=\"top\">\n  <jelly-icon-button id=\"copy\" label=\"Copy\"></jelly-icon-button>\n</jelly-tooltip>\n\n<script type=\"module\">\n  import { jellyIcon } from './package.js';\n\n  copy.innerHTML = jellyIcon('link', { size: 18 });\n</script>"
      }
    ]
  }
];
