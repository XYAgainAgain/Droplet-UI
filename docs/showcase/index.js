/*
 * The showcase renderer (index.html)
 *
 * One live preview per component. Each component is a viewport-height "panel"
 * The attribute table beside the preview shows EVERY option of
 * every attribute at once, rendered with the library's own components
 * (droplet-badge for enums / booleans / numbers, droplet-input for text), so the
 * docs dogfood what they document. Clicking a badge - or typing into a text
 * field - sets that attribute on the live preview and rewrites the HTML
 * snippet; interacting with the preview itself writes back into the table.
 *
 * The demo config lives in docs/showcase/playgrounds.js; the full tables live on
 * /api.
 */

import '../../package.js';

import { dropletToast }       from '../../package.js';

import { escapeHTML }       from '../shared/common.js';
import { formatInlineCode } from '../shared/common.js';
import { wireMotionToggle } from '../shared/common.js';
import { wireThemeToggle }  from '../shared/common.js';

import { COMPONENTS }       from '../content/data.js';
import { GROUP_ORDER }      from '../content/data.js';

import { PLAYGROUNDS }      from './playgrounds.js';
import { NO_PANEL }         from './playgrounds.js';

import { initLottie }       from '../lottie/index.js';

wireMotionToggle(document.getElementById('motionToggle'));
wireThemeToggle(document.getElementById('themeToggle'));
initLottie(document.getElementById('heroLottie'), './docs/lottie/hero-lottie.json');
initLottie(document.getElementById('footerLottie'), './docs/lottie/footer-lottie.json');

// The hero and subnav call-to-action buttons are droplet-buttons, not links, so
// wire their navigation here: smooth-scroll to the first showcased component,
// or jump to the API reference page.
document.querySelector('[data-hero-scroll]')?.addEventListener('click', () => {
  document.getElementById('panels')?.scrollIntoView({ behavior: 'smooth' });
});
document.querySelector('[data-hero-api]')?.addEventListener('click', () => {
  window.location.href = './api/';
});
document.querySelector('[data-subnav-showcase]')?.addEventListener('click', () => {
  document.getElementById('panels')?.scrollIntoView({ behavior: 'smooth' });
});
document.querySelector('[data-subnav-api]')?.addEventListener('click', () => {
  window.location.href = './api/';
});
document.querySelector('[data-subnav-migration]')?.addEventListener('click', () => {
  window.location.href = './migration/';
});

// The showcased components, in group order, minus the child-only elements
const ordered = GROUP_ORDER
  .flatMap((group) => COMPONENTS.filter((c) => c.group === group))
  .filter((c) => !NO_PANEL.has(c.tag) && PLAYGROUNDS[c.tag]);

// Keep the hero's public custom-element count honest as the library grows
const countStat = document.querySelector('[data-stat-count]');

if (countStat) {
  countStat.textContent = `${COMPONENTS.length} custom elements`;
}

/* ---- Attribute values --------------------------------------------------- */

// Resolve an attribute's starting value: an explicit playground default,
// else the documented default parsed for the control's kind
function controlDefault (item, spec, cfg) {
  if (cfg.defaults && spec.attr in cfg.defaults) {
    return cfg.defaults[spec.attr];
  }

  const attr = (item.attributes || []).find((a) => a.name === spec.attr);
  const raw  = String(attr?.default ?? '').replace(/^["']|["']$/g, '').trim();

  if (spec.kind === 'bool')   return raw === 'true';
  if (spec.kind === 'number') { const n = parseFloat(raw); return Number.isFinite(n) ? n : spec.min; }
  if (spec.kind === 'enum')   return spec.options.includes(raw) ? raw : spec.options[0];

  return raw && !raw.startsWith('(') ? raw : '';
}

// Every option a control offers, in its natural documented order: booleans
// show false / true, enums their documented options, numbers an even walk
// from min to max (with the default merged in, so the selected badge always
// exists). Text attributes render an editable field instead - see valueControl.
function optionsFor (spec, def) {
  if (spec.kind === 'bool') {
    return [false, true];
  }

  if (spec.kind === 'enum') {
    return spec.options.map(String);
  }

  if (spec.kind === 'number') {
    const step = Math.max(spec.step, Math.round((spec.max - spec.min) / 4));
    const out  = [];

    for (let v = spec.min; v <= spec.max; v += step) {
      out.push(v);
    }

    if (Number.isFinite(Number(def)) && !out.includes(Number(def))) {
      out.push(Number(def));
      out.sort((a, b) => a - b);
    }

    return out;
  }

  return [];
}

// Parse a badge's data-opt string back into the control's typed value
function typedValue (spec, raw) {
  if (spec.kind === 'bool')   return raw === 'true';
  if (spec.kind === 'number') {
    return Number(raw);
  }

  return raw;
}

// True when a control is rendered as an editable field rather than option
// badges: every text control and number controls flagged `field` (e.g. an
// otp length, where a spinner reads more naturally than a row of counts).
function isField (spec) {
  return spec.kind === 'text' || (spec.kind === 'number' && spec.field);
}

// The label shown for a value
function displayValue (spec, value) {
  if (spec.kind === 'bool') {
    return value ? 'true' : 'false';
  }

  if (value === '' || value == null) {
    return spec.placeholder || '-';
  }

  return String(value);
}

// The value display for one attribute row, built from the library's own
// components. A field control is a free-typed droplet-input (text, or a number
// spinner) whose input lands on the preview; every other kind (enum, boolean,
// number) shows ALL of its options at once as selectable droplet-chips - the
// current one selected (accent), the rest at rest (platinum). Single-select is
// managed here (updateValue keeps exactly one chip selected per row).
function valueControl (spec, value) {
  if (isField(spec)) {
    const type = spec.kind === 'number' ? 'number' : 'text';

    return `<droplet-input class="attr-field" data-value="${spec.attr}" size="small" type="${type}"`
      + ` value="${escapeHTML(String(value ?? ''))}"`
      + ` placeholder="${escapeHTML(spec.placeholder || '')}"`
      + ` label="Current ${escapeHTML(spec.attr)}"></droplet-input>`;
  }

  const chips = optionsFor(spec, value).map((option) => {
    const selected = String(option) === String(value);

    return `<droplet-chip class="attr-chip" data-opt="${escapeHTML(String(option))}"`
      + ` shape="square" selectable${selected ? ' selected' : ''}>`
      + `${escapeHTML(displayValue(spec, option))}</droplet-chip>`;
  }).join('');

  return `<div class="attr-options" data-value="${spec.attr}">${chips}</div>`;
}

/* ---- Applying state to the preview + the code -------------------------- */

// Set (or clear) the real attribute on the preview element, honoring
// aliases (e.g. the "circle" control maps to shape="circle")
function applyToRoot (root, spec, value, cfg) {
  const alias = cfg.aliases?.[spec.attr];

  if (alias) {
    if (spec.kind === 'bool') {
      if (value) root.setAttribute(alias.attr, alias.on);
      else       root.removeAttribute(alias.attr);
    } else if (String(value) === String(alias.off)) {
      root.removeAttribute(alias.attr);
    } else {
      root.setAttribute(alias.attr, String(value));
    }
    return;
  }

  if (spec.kind === 'bool') {
    root.toggleAttribute(spec.attr, !!value);
  } else if (value === '' || value == null) {
    root.removeAttribute(spec.attr);
  } else {
    root.setAttribute(spec.attr, String(value));
  }
}

// Indent child elements onto their own lines so the snippet reads cleanly
function formatInner (inner) {
  if (!inner || !inner.includes('<')) {
    return escapeHTML(inner || '');
  }

  const lines = inner.replace(/>\s*</g, '>\n<').split('\n');

  return `\n  ${lines.map((l) => escapeHTML(l)).join('\n  ')}\n`;
}

// Build the HTML snippet that mirrors the current attribute values
function codeFor (item, cfg, state) {
  if (item.tag === 'droplet-toaster') {
    return `dropletToast('Saved!', { tone: '${state.tone}' });`;
  }

  const attrs = [];

  for (const spec of cfg.controls) {
    const value = state[spec.attr];
    const alias = cfg.aliases?.[spec.attr];

    if (spec.kind === 'bool') {
      if (value) {
        attrs.push(alias ? `${alias.attr}="${alias.on}"` : spec.attr);
      }
      continue;
    }

    if (value === '' || value == null) {
      continue;
    }

    if (alias) {
      if (String(value) !== String(alias.off)) {
        attrs.push(`${alias.attr}="${escapeHTML(String(value))}"`);
      }
      continue;
    }

    if (String(value) !== String(controlDefault(item, spec, cfg))) {
      attrs.push(`${spec.attr}="${escapeHTML(String(value))}"`);
    }
  }

  const open  = `&lt;${item.tag}${attrs.length ? ' ' + attrs.join(' ') : ''}&gt;`;
  const close = `&lt;/${item.tag}&gt;`;
  const inner = cfg.inner ?? cfg.slot ?? '';

  return open + formatInner(inner) + close;
}

// Repaint the snippet from the panel's current state
function refreshCode (panel) {
  panel.querySelector('[data-code]').innerHTML = codeFor(panel.item, panel.cfg, panel.state);
}

// Update one attribute's value display: a field value is written into the
// input (skipped while it already matches, so typing in the field itself
// never fights the caret); every other kind keeps all its option chips on
// screen and just moves the selection - exactly one chip stays selected, so
// this also corrects the self-toggle a selectable chip does on click.
function updateValue (panel, attr) {
  const spec  = panel.specByAttr[attr];
  const value = panel.state[attr];
  const el    = panel.querySelector(`[data-value="${attr}"]`);

  if (!el) {
    return;
  }

  if (isField(spec)) {
    if (String(el.value ?? '') !== String(value ?? '')) {
      el.setAttribute('value', String(value ?? ''));
    }
    return;
  }

  for (const chip of el.querySelectorAll('droplet-chip[data-opt]')) {
    chip.toggleAttribute('selected', chip.getAttribute('data-opt') === String(value));
  }
}

/* ---- Panel construction ------------------------------------------------- */

// One showcase panel (header + attribute table + code + sticky preview)
function panelMarkup (item, index) {
  const events = (item.events || []).map((e) => e.name);

  return `
    <article class="panel" id="${item.tag}" data-index="${index}" data-tag="${item.tag}"
             data-events="${escapeHTML(events.join(','))}">
      <div class="scene">
        <div class="panel-grid">
          <div class="doc">
            <header class="doc-head">
              <p class="kicker">${escapeHTML(item.group)} · ${String(index + 1).padStart(2, '0')}</p>
              <h2>&lt;${item.tag}&gt;</h2>
              <p class="summary">${formatInlineCode(item.summary)}</p>
            </header>

            <div class="attrs"><!-- built on mount --></div>

            <div class="code">
              <div class="code-head">
                <droplet-button class="copy" size="small" variant="white" data-copy aria-label="Copy the ${item.tag} snippet">Copy</droplet-button>
              </div>
              <pre><code data-code></code></pre>
            </div>

            <a class="api-link" href="./api/#${item.tag}">Full API reference →</a>
          </div>

          <div class="stage">
            <div class="stage-frame">
              <div class="stage-inner" data-demo></div>
              <div class="stage-events" aria-hidden="true"></div>
            </div>
          </div>
        </div>
      </div>
    </article>`;
}

// The attribute table for one component: each row is the attribute name and
// all of its options, rendered with the library's own components (droplet-badge /
// droplet-input) so the docs dogfood what they document. No per-row description -
// the options speak for themselves.
function attrsMarkup (item, cfg, state) {
  const rows = cfg.controls.map((spec) => {
    return `
      <div class="attr" data-row="${spec.attr}">
        <div class="attr-name"><code>${escapeHTML(spec.attr)}</code></div>
        <div class="attr-body">
          ${valueControl(spec, state[spec.attr])}
        </div>
      </div>`;
  }).join('');

  const note = cfg.note ? `<p class="note">${escapeHTML(cfg.note)}</p>` : '';

  return rows + note;
}

// Assemble the preview element (plus any external trigger) in the stage
function buildPreview (panel, item, cfg, state) {
  const stage = panel.querySelector('.stage-inner');
  const extra = cfg.extra || '';
  const inner = cfg.inner ?? escapeHTML(cfg.slot ?? '');
  const attrs = Object.entries(cfg.attrs || {}).map(([name, value]) =>
    value === '' ? ` ${name}` : ` ${name}="${escapeHTML(value)}"`,
  ).join('');

  let rootHTML;

  if (item.tag === 'droplet-resizable') {
    rootHTML = `<${item.tag}${attrs} style="height: 220px; width: 100%; overflow: hidden; background: #fff; border: 1px solid var(--droplet-color-border-default, #ECECEF); border-radius: 14px">${inner}</${item.tag}>`;
  } else {
    rootHTML = `<${item.tag}${attrs}>${inner}</${item.tag}>`;
  }

  if (cfg.wrap === 'block') {
    // A flex box with a real height so a vertical divider can stretch into it
    // (its rule lines grow to fill the height); the host's own align-self keeps
    // a horizontal divider centered and full-width.
    rootHTML = `<div style="display: flex; align-items: stretch; justify-content: center; width: 280px; height: 150px">${rootHTML}</div>`;
  }

  stage.innerHTML = extra + rootHTML;

  const root = stage.querySelector(item.tag);

  panel.root = root;

  if (root && item.tag !== 'droplet-toaster') {
    for (const spec of cfg.controls) {
      applyToRoot(root, spec, state[spec.attr], cfg);
    }
  }
}

// Rebuild the preview after a self-removing demo (chip removed, alert dismissed)
function rebuildPreview (panel) {
  buildPreview(panel, panel.item, panel.cfg, panel.state);
  wirePreview(panel);
}

// Reflect user interaction back into the table: when the preview fires a bound
// event (typing, toggling, selecting), read the new value and update that
// attribute's state, its value display and the code snippet - the reverse
// direction of the scroll scrub, so the two stay in sync either way.
function wireBinds (panel) {
  const binds = panel.cfg.bind;

  if (!binds || !panel.root) {
    return;
  }

  for (const bind of binds) {
    const spec = panel.specByAttr[bind.attr];

    panel.root.addEventListener(bind.event, () => {
      const raw   = bind.get(panel.root);
      const value = spec?.kind === 'number' ? Number(raw)
        : spec?.kind === 'bool' ? !!raw
          : raw;

      if (String(panel.state[bind.attr]) === String(value)) {
        return;
      }

      panel.state[bind.attr] = value;
      updateValue(panel, bind.attr);
      refreshCode(panel);
    });
  }
}

// Wire the preview element: triggers, event ticker, self-heal, link guard
function wirePreview (panel) {
  const item = panel.item;
  const root = panel.root;

  // Trigger buttons for the modal / toast demos
  panel.querySelectorAll('[data-open]').forEach((button) => {
    button.addEventListener('click', () => { if (root) root.open = true; });
  });

  panel.querySelectorAll('[data-toast]').forEach((button) => {
    button.addEventListener('click', () => dropletToast('Droplet toast', { tone: panel.state.tone }));
  });

  // Prevent demo links from navigating (a breadcrumb href would jump the page).
  // composedPath() is used rather than event.target so links rendered inside a
  // component's shadow DOM (droplet-breadcrumbs) are caught too - a shadow click
  // retargets event.target to the host, where closest('a') finds nothing.
  panel.querySelector('.stage-inner').addEventListener('click', (event) => {
    if (event.composedPath().some((node) => node instanceof HTMLAnchorElement)) {
      event.preventDefault();
    }
  });

  if (!root || item.tag === 'droplet-toaster') {
    return;
  }

  // Interacting with the preview reflects straight back into the table
  wireBinds(panel);

  // A removed chip / dismissed alert regrows so the demo never empties
  root.addEventListener('remove', () => setTimeout(() => rebuildPreview(panel), 1500));
  root.addEventListener('dismiss', () => setTimeout(() => rebuildPreview(panel), 400));

  // Fired events tick along the stage edge - real droplet-badges (graphite, so
  // they read as telemetry, distinct from the azure/platinum option badges)
  const ticker = panel.querySelector('.stage-events');

  for (const name of (panel.dataset.events || '').split(',').filter(Boolean)) {
    root.addEventListener(name, () => {
      const chip = document.createElement('droplet-badge');

      chip.className = 'event-chip';
      chip.setAttribute('variant', 'graphite');
      chip.setAttribute('size', 'small');
      chip.setAttribute('shape', 'square');
      chip.textContent = name;
      ticker.prepend(chip);

      while (ticker.children.length > 3) {
        ticker.lastChild.remove();
      }

      setTimeout(() => chip.classList.add('fading'), 900);
      setTimeout(() => chip.remove(), 1600);
    });
  }
}

// Set one attribute to an explicit value, updating preview + value display.
// Returns true when the value actually changed (so the code snippet is only
// repainted when something is new).
function setValue (panel, attr, value) {
  if (String(panel.state[attr]) === String(value)) {
    return false;
  }

  panel.state[attr] = value;

  const spec = panel.specByAttr[attr];

  if (panel.root && panel.item.tag !== 'droplet-toaster') {
    applyToRoot(panel.root, spec, value, panel.cfg);
  }

  updateValue(panel, attr);
  return true;
}

// Build a panel's table + preview the first time it nears the viewport
function mountPanel (panel) {
  if (panel.mounted) {
    return;
  }

  panel.mounted = true;

  const item = panel.item;
  const cfg  = panel.cfg;

  // Starting state from the attribute defaults + playground overrides
  panel.state      = {};
  panel.specByAttr = {};
  for (const spec of cfg.controls) {
    panel.state[spec.attr]      = controlDefault(item, spec, cfg);
    panel.specByAttr[spec.attr] = spec;
  }

  panel.querySelector('.attrs').innerHTML = attrsMarkup(item, cfg, panel.state);

  buildPreview(panel, item, cfg, panel.state);
  wirePreview(panel);
  refreshCode(panel);

  // Typing into a field control writes straight onto the preview + snippet.
  // A number field is clamped to its documented range once it holds a number
  // (an empty field is left alone so the value can be cleared while editing).
  for (const field of panel.querySelectorAll('.attr-field')) {
    field.addEventListener('input', () => {
      const spec = panel.specByAttr[field.dataset.value];

      let value = field.value ?? '';

      if (spec?.kind === 'number' && value !== '') {
        const n = Number(value);

        if (Number.isFinite(n)) {
          value = Math.max(spec.min, Math.min(spec.max, n));

          // Pagination's page can never exceed its total, so the snippet never
          // shows a page the component would clamp away
          if (field.dataset.value === 'page' && Number.isFinite(+panel.state?.total)) {
            value = Math.min(value, +panel.state.total);
          }
        }
      }

      if (setValue(panel, field.dataset.value, value)) {
        refreshCode(panel);
      }
    });
  }
}

/* ---- Render ------------------------------------------------------------- */

document.getElementById('panels').innerHTML = ordered.map(panelMarkup).join('');

const panels = [...document.querySelectorAll('.panel')];

// Attach the descriptor + config to each panel. The panels are fixed
// one-viewport sections, so there is no
// per-panel scroll budget to precompute.
panels.forEach((panel) => {
  panel.item = ordered[+panel.dataset.index];
  panel.cfg  = PLAYGROUNDS[panel.dataset.tag];
});

// Component panels publish their tag in the URL. The hero represents the
// unfragmented showcase URL, so returning to it removes only the hash while
// preserving the current path and query string.
const hero = document.querySelector('.hero');
const hashSections = [hero, ...panels].filter(Boolean);

function clearShowcaseHash () {
  if (location.hash) {
    history.replaceState(null, '', `${location.pathname}${location.search}`);
  }
}

function heroIsActive () {
  if (!hero) {
    return false;
  }

  const center = window.innerHeight / 2;
  const rect   = hero.getBoundingClientRect();

  return rect.top <= center && rect.bottom > center;
}

/* ---- Scroll ------------------------------------------------------------- */

// Mount panels just before they arrive
const mountObserver = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (entry.isIntersecting) mountPanel(entry.target);
  }
}, { rootMargin: '700px 0px' });

panels.forEach((p) => mountObserver.observe(p));

// Scroll progress bar, throttled to one rAF
const progress = document.getElementById('scrollProgress');

let ticking = false;

function onScroll () {
  if (ticking) {
    return;
  }

  ticking = true;

  requestAnimationFrame(() => {
    ticking = false;

    const max = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`;

    // IntersectionObserver can skip intermediate states during a long smooth
    // scroll. Check the hero here as well so arriving at the top always
    // clears the last component fragment before a refresh.
    if (heroIsActive()) {
      clearShowcaseHash();
    }
  });
}

window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

// Copy buttons
document.getElementById('panels').addEventListener('click', (event) => {
  const button = event.target.closest('[data-copy]');
  if (!button) {
    return;
  }

  const code = button.closest('.code')?.querySelector('code')?.textContent || '';

  navigator.clipboard?.writeText(code).then(() => {
    button.textContent = 'Copied';
    setTimeout(() => { button.textContent = 'Copy'; }, 1200);
  });
});

// Clicking an option chip sets that value on the preview. The chip is
// selectable, so it self-toggles on click; updateValue (always run) then
// re-asserts single-select across the row - clicking the current option keeps
// it selected rather than clearing it.
document.getElementById('panels').addEventListener('click', (event) => {
  const chip = event.target.closest('.attr-chip');
  if (!chip) {
    return;
  }

  const row   = chip.closest('.attr');
  const panel = chip.closest('.panel');
  const spec  = panel.specByAttr?.[row.dataset.row];

  if (!spec) {
    return;
  }

  setValue(panel, row.dataset.row, typedValue(spec, chip.dataset.opt));
  updateValue(panel, row.dataset.row);
  refreshCode(panel);
});

// Keep the URL hash on the component in view, so deep links stay shareable.

function syncSectionHash () {
  const center = window.innerHeight / 2;
  const active = hashSections.find((section) => {
    const rect = section.getBoundingClientRect();

    return rect.top <= center && rect.bottom > center;
  });

  if (!active) {
    return;
  }

  if (active === hero) {
    clearShowcaseHash();
    return;
  }

  const hash = `#${active.dataset.tag}`;

  if (location.hash !== hash) {
    history.replaceState(null, '', hash);
  }
}

const activeObserver = new IntersectionObserver(() => {
  syncSectionHash();
}, { rootMargin: '-45% 0px -45% 0px' });

hashSections.forEach((section) => activeObserver.observe(section));
