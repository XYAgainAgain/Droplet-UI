// One small palette as CSS custom properties, shared by the DOM and the canvas painter

// The three document-wide theme modes ('auto' follows the operating system)
export type ThemeMode = 'light' | 'dark' | 'auto';

// A resolved theme, grouped the way the CSS custom properties are named
export interface Theme {
  background: {
    default: string;
    surface: string;
    muted: string;
    neutral: string;
    neutralEmphasis: string;
    white: string;
    rose: string;
    amber: string;
    azure: string;
    mint: string;
    accent: string;
  };
  foreground: {
    default: string;
    muted: string;
    onEmphasis: string;
    onNeutral: string;
    onWhite: string;
    onAccent: string;
  };
  border: {
    default: string;
    focus: string;
  };
  shadow: string;
}

// A flattened token map: `<group>-<role>` var suffix → oklch value
export type TokenMap = Record<string, string>;

// The rounded display stack used by every component label
export const FONT_STACK = `ui-rounded, 'SF Pro Rounded', system-ui, -apple-system, 'Segoe UI', sans-serif`;

// Shared so no component re-types the stacks; override site-wide with --droplet-font-text and --droplet-font-mono
export const BODY_FONT_STACK = `system-ui, -apple-system, 'Segoe UI', sans-serif`;
export const MONO_FONT_STACK = `ui-monospace, 'SF Mono', Menlo, monospace`;

// Shared swatches: the four hues and white read identically in both modes.
// `sky` is the lightened azure dark mode uses for accent and focus, where base azure is too dim.

const WHITE = 'oklch(1 0 0)';                     // #FFFFFF
const INK   = 'oklch(0.2609 0.0238 267.11)';      // #1F2430

const ROSE  = 'oklch(0.5771 0.2152 27.33)';       // #DC2626
const AMBER = 'oklch(0.5779 0.1495 51.54)';       // #BC5A00
const AZURE = 'oklch(0.5601 0.1577 249.8)';       // #0077CC
const MINT  = 'oklch(0.5489 0.1374 151.7)';       // #178746
const SKY   = 'oklch(0.7112 0.1559 250.96)';      // #4DA6FF

// Semantic themes, grouped by role: background, foreground (text and on-fill labels), border.
// `accent` is the primary interactive fill, re-tintable per subtree by <droplet-theme accent="...">.

export const LIGHT: Theme = {
  background: {
    default:         WHITE,                          // page background
    surface:         WHITE,                          // raised surface (cards, sheets)
    muted:           'oklch(0.9906 0.0017 247.84)',  // #FBFCFD  input/field rest fill
    neutral:         'oklch(0.8884 0 0)',            // #DADADA  neutral fill (platinum)
    neutralEmphasis: 'oklch(0.4676 0 0)',            // #5A5A5A  strong neutral fill (graphite)
    white:           WHITE,                          // explicit white fill
    rose:            ROSE,
    amber:           AMBER,
    azure:           AZURE,
    mint:            MINT,
    accent:          AZURE,
  },
  foreground: {
    default:    INK,                                 // primary text
    muted:      'oklch(0.503 0.0269 266.68)',        // #5D6474  secondary text
    onEmphasis: WHITE,                               // label on a saturated/graphite fill
    onNeutral:  INK,                                 // label on a neutral fill
    onWhite:    INK,                                 // label on the white fill
    onAccent:   WHITE,                               // label on the accent fill
  },
  border: {
    default: 'oklch(0.9439 0.004 286.32)',           // #ECECEF  hairline
    focus:   AZURE,                                  // focus ring
  },
  shadow: '20, 26, 38',                              // rgb triple, consumed inside rgba()
};

export const DARK: Theme = {
  background: {
    default:         'oklch(0.2198 0.006 236.84)',   // #181B1D
    surface:         'oklch(0.2514 0.0163 264.22)',  // #1E222A
    muted:           'oklch(0.288 0.018 262.21)',    // #262B34
    neutral:         'oklch(0.3674 0.0201 266.01)',  // #3A3F4A  neutral fill + hairline
    neutralEmphasis: 'oklch(0.4707 0.0189 266.12)',  // #565B66
    white:           'oklch(0.94 0.0071 268.55)',    // #E9EBF0
    rose:            ROSE,
    amber:           AMBER,
    azure:           AZURE,
    mint:            MINT,
    accent:          SKY,
  },
  foreground: {
    default:    'oklch(0.9645 0.0054 274.97)',       // #F2F3F7
    muted:      'oklch(0.7595 0.0259 265.54)',       // #A9B1C2
    onEmphasis: WHITE,
    onNeutral:  'oklch(0.9645 0.0054 274.97)',       // #F2F3F7  light label on a dark neutral fill
    onWhite:    INK,                                 // dark label on the near-white fill
    onAccent:   'oklch(0.2514 0.0163 264.22)',       // #1E222A  card surface, not pure black
  },
  border: {
    default: 'oklch(0.3674 0.0201 266.01)',          // #3A3F4A  shares the neutral step
    focus:   SKY,
  },
  shadow: '0, 0, 0',
};

// Flatten a theme to { <var-suffix>: value } for --droplet-color-*, named `<group>-<role>` in kebab-case

const kebab = (key: string): string => key.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());

function flatten (t: Theme): TokenMap {
  const out: TokenMap = {};

  for (const group of ['background', 'foreground', 'border'] as const) {
    for (const [role, value] of Object.entries(t[group])) {
      out[`${group}-${kebab(role)}`] = value;
    }
  }

  out['shadow'] = t.shadow;

  return out;
}

// Full var-suffix → value maps, one per mode
export const LIGHT_TOKENS: TokenMap = flatten(LIGHT);
export const DARK_TOKENS: TokenMap  = flatten(DARK);

// Concrete light-mode colors for JS (canvas fills, themeColor() fallbacks), keyed like the CSS tokens.
// Prefer the CSS tokens in styles.
export const PALETTE: TokenMap = LIGHT_TOKENS;

// Focus ring geometry (and default color) shared by every painted ring; themeTokenCSS()
// in runtime.ts emits the --droplet-ring-* counterparts from these values.
export const FOCUS_RING = {
  color: LIGHT.border.focus,
  width: 4.5,
  gap:   0,
  alpha: 0.5,
};
