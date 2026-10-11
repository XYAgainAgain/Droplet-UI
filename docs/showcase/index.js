/*
 * Showcase renderer: one live panel per component, its attribute table built from the
 * library's own chips and inputs. Picking or typing updates the preview and snippet, and
 * interacting with the preview writes back into the table. Demo config: playgrounds.js.
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

// The hero and top-bar buttons are droplet-buttons, not links, so their navigation is wired here
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

const ordered = GROUP_ORDER
  .flatMap((group) => COMPONENTS.filter((c) => c.group === group))
  .filter((c) => !NO_PANEL.has(c.tag) && PLAYGROUNDS[c.tag]);

// Keep the hero's public custom-element count honest as the library grows
const countStat = document.querySelector('[data-stat-count]');

if (countStat) {
  countStat.textContent = `${COMPONENTS.length} custom elements`;
}

// Attribute values

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

// Numbers walk evenly from min to max with the default merged in, so the selected
// chip always exists. Field controls render an input instead (see valueControl).
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

function typedValue (spec, raw) {
  if (spec.kind === 'bool')   return raw === 'true';
  if (spec.kind === 'number') {
    return Number(raw);
  }

  return raw;
}

// Number controls flagged `field` (an OTP length, say) get a spinner, which reads
// better than a row of counts
function isField (spec) {
  return spec.kind === 'text' || (spec.kind === 'number' && spec.field);
}

function displayValue (spec, value) {
  if (spec.kind === 'bool') {
    return value ? 'true' : 'false';
  }

  if (value === '' || value == null) {
    return spec.placeholder || '-';
  }

  return String(value);
}

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

// Applying state to the preview and the code

// An alias's `off` value (a default like shape="pill") clears the attribute instead of writing it
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

function formatInner (inner) {
  if (!inner || !inner.includes('<')) {
    return escapeHTML(inner || '');
  }

  const lines = inner.replace(/>\s*</g, '>\n<').split('\n');

  return `\n  ${lines.map((l) => escapeHTML(l)).join('\n  ')}\n`;
}

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

function refreshCode (panel) {
  panel.querySelector('[data-code]').innerHTML = codeFor(panel.item, panel.cfg, panel.state);
}

// A field is only rewritten when its value differs, so typing never fights the caret
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

// Panel construction

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
    // A real height lets a vertical divider stretch; the host's own align-self keeps
    // a horizontal one centered and full-width
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

// The reverse direction: a bound preview event (typing, toggling, selecting) writes
// the new value back into the table and the snippet
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

function wirePreview (panel) {
  const item = panel.item;
  const root = panel.root;

  panel.querySelectorAll('[data-open]').forEach((button) => {
    button.addEventListener('click', () => { if (root) root.open = true; });
  });

  panel.querySelectorAll('[data-toast]').forEach((button) => {
    button.addEventListener('click', () => dropletToast('Droplet toast', { tone: panel.state.tone }));
  });

  // Demo links must not navigate. composedPath() catches links inside shadow DOM
  // (droplet-breadcrumbs), where event.target is retargeted to the host.
  panel.querySelector('.stage-inner').addEventListener('click', (event) => {
    if (event.composedPath().some((node) => node instanceof HTMLAnchorElement)) {
      event.preventDefault();
    }
  });

  if (!root || item.tag === 'droplet-toaster') {
    return;
  }

  wireBinds(panel);

  // A removed chip or dismissed alert regrows so the demo never empties
  root.addEventListener('remove', () => setTimeout(() => rebuildPreview(panel), 1500));
  root.addEventListener('dismiss', () => setTimeout(() => rebuildPreview(panel), 400));

  // Fired events tick along the stage edge as graphite badges, so they read as
  // telemetry rather than as option chips
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

// Returns true only when the value changed, so callers repaint the snippet only then
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

function mountPanel (panel) {
  if (panel.mounted) {
    return;
  }

  panel.mounted = true;

  const item = panel.item;
  const cfg  = panel.cfg;

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

  // Number fields clamp to the documented range once they hold a number; an empty
  // field is left alone so it can be cleared while editing
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

// Render

document.getElementById('panels').innerHTML = ordered.map(panelMarkup).join('');

const panels = [...document.querySelectorAll('.panel')];

panels.forEach((panel) => {
  panel.item = ordered[+panel.dataset.index];
  panel.cfg  = PLAYGROUNDS[panel.dataset.tag];
});

// Panels publish their tag as the URL hash; the hero stands for the bare showcase URL,
// so returning to it drops only the hash and keeps the path and query
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

// Scroll

// Mount panels just before they arrive
const mountObserver = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (entry.isIntersecting) mountPanel(entry.target);
  }
}, { rootMargin: '700px 0px' });

panels.forEach((p) => mountObserver.observe(p));

// Scroll progress bar, throttled to one update per animation frame
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

    // IntersectionObserver can skip states during a long smooth scroll, so the hero
    // is checked here too and arriving at the top always clears the last fragment
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

// A selectable chip self-toggles on click; updateValue always runs to re-assert
// single-select, so clicking the current option keeps it selected
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
