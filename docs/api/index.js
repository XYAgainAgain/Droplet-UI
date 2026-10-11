/*
 * The API reference renderer (/api)
 *
 * Pure reference: every component from docs/data.js becomes a section of
 * aligned tables - attributes, properties, methods, events, slots, parts,
 * CSS custom properties, keyboard - plus its code examples as text. No
 * live previews; the showcase (index.html) handles those.
 */

import '../../package.js';

import { escapeHTML }       from '../shared/common.js';
import { formatInlineCode } from '../shared/common.js';
import { wireMotionToggle } from '../shared/common.js';
import { wireThemeToggle }  from '../shared/common.js';

import { COMPONENTS }       from '../content/data.js';
import { GROUP_ORDER }      from '../content/data.js';

wireMotionToggle(document.getElementById('motionToggle'));
wireThemeToggle(document.getElementById('themeToggle'));

// The shared top bar's page links are droplet-buttons, not anchors - wire their
// navigation (the same handlers the showcase page installs for its bar)
document.querySelector('[data-subnav-showcase]')?.addEventListener('click', () => {
  window.location.href = '../';
});
document.querySelector('[data-subnav-api]')?.addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});
document.querySelector('[data-subnav-migration]')?.addEventListener('click', () => {
  window.location.href = '../migration/';
});

/* ---- Rendering --------------------------------------------------------- */

/*
 * Column layouts per column count. Every layout starts its name column on
 * the same 20% share and ends its description column on the same 44%, so
 * ALL the tables on the page sit on one vertical grid - the eye can scan
 * the descriptions (or names) straight down a section. The tables use
 * table-layout: fixed, so these widths are exact, not hints.
 */
const COLUMN_WIDTHS = {
  2: ['56%', '44%'],
  3: ['20%', '36%', '44%'],
  4: ['20%', '24%', '12%', '44%'],
};

// One aligned API table, omitted entirely when there are no rows
function apiTable (title, rows, columns) {
  if (!rows || rows.length === 0) {
    return '';
  }

  const widths = COLUMN_WIDTHS[columns.length] || [];
  const cols   = widths.map((w) => `<col style="width: ${w}" />`).join('');
  const head   = columns.map((c) => `<th>${c.label}</th>`).join('');

  const body = rows.map((row) =>
    `<tr>${columns.map((c) =>
      `<td>${c.code ? `<code>${escapeHTML(row[c.key] ?? '')}</code>` : formatInlineCode(row[c.key] ?? '')}</td>`,
    ).join('')}</tr>`,
  ).join('');

  return `
    <section class="api-group">
      <h3>${title}</h3>
      <div class="table-scroll">
        <table>
          <colgroup>${cols}</colgroup>
          <thead><tr>${head}</tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    </section>`;
}

// Example code rendered as text (the showcase renders it live)
function exampleBlock (example, index, tag) {
  const title = example.title ? `<h4>${escapeHTML(example.title)}</h4>` : '';

  return `
    <div class="example">
      ${title}
      <div class="code">
        <div class="code-head">
          <droplet-button class="copy" size="small" variant="white" data-copy aria-label="Copy example ${index + 1} for ${tag}">Copy</droplet-button>
        </div>
        <pre><code>${escapeHTML(example.code.trim())}</code></pre>
      </div>
    </div>`;
}

// The full reference section for one component
function componentSection (item) {
  const events = (item.events || []).map((e) => ({ ...e, detail: e.detail || '-' }));

  return `
    <section class="component" id="${item.tag}" data-tag="${item.tag}" data-group="${escapeHTML(item.group)}">
      <header class="component-head">
        <p class="kicker">${escapeHTML(item.group)}</p>
        <h2>&lt;${item.tag}&gt;</h2>
        <p class="summary">${formatInlineCode(item.summary)}</p>
        ${item.description ? `<p class="description">${formatInlineCode(item.description)}</p>` : ''}
        <a class="showcase-link" href="./index.html#${item.tag}">See it live in the showcase →</a>
      </header>

      ${apiTable('Attributes', item.attributes, [
        { key: 'name', label: 'Name', code: true },
        { key: 'type', label: 'Type' },
        { key: 'default', label: 'Default', code: true },
        { key: 'description', label: 'Description' },
      ])}
      ${apiTable('Properties', item.properties, [
        { key: 'name', label: 'Name', code: true },
        { key: 'type', label: 'Type' },
        { key: 'description', label: 'Description' },
      ])}
      ${apiTable('Methods', item.methods, [
        { key: 'signature', label: 'Signature', code: true },
        { key: 'description', label: 'Description' },
      ])}
      ${apiTable('Events', events, [
        { key: 'name', label: 'Event', code: true },
        { key: 'detail', label: 'detail' },
        { key: 'description', label: 'Description' },
      ])}
      ${apiTable('Slots', item.slots, [
        { key: 'name', label: 'Slot', code: true },
        { key: 'description', label: 'Description' },
      ])}
      ${apiTable('CSS custom properties', item.cssProperties, [
        { key: 'name', label: 'Property', code: true },
        { key: 'default', label: 'Default', code: true },
        { key: 'description', label: 'Description' },
      ])}
      ${apiTable('Shadow parts', item.parts, [
        { key: 'name', label: 'Part', code: true },
        { key: 'description', label: 'Description' },
      ])}
      ${apiTable('Keyboard', item.keyboard, [
        { key: 'keys', label: 'Keys', code: true },
        { key: 'description', label: 'Action' },
      ])}

      ${(item.examples || []).map((example, i) => exampleBlock(example, i, item.tag)).join('')}
    </section>`;
}

/* ---- Build the page ----------------------------------------------------- */

const groups = GROUP_ORDER.filter((group) => COMPONENTS.some((c) => c.group === group));

document.getElementById('nav').innerHTML = groups.map((group) => `
  <div class="nav-group">
    <p class="nav-title">${escapeHTML(group)}</p>
    ${COMPONENTS.filter((c) => c.group === group).map((c) =>
      `<a href="#${c.tag}" data-nav="${c.tag}">${c.tag}</a>`,
    ).join('')}
  </div>`,
).join('');

document.getElementById('sections').innerHTML = groups.map((group) =>
  COMPONENTS.filter((c) => c.group === group).map(componentSection).join(''),
).join('');

/* ---- Page behavior ------------------------------------------------------ */

// Copy buttons
document.addEventListener('click', (event) => {
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

// Highlight the section currently in view
const sectionObserver = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) {
      continue;
    }

    document.querySelectorAll('[data-nav].active').forEach((a) => a.classList.remove('active'));
    document.querySelector(`[data-nav="${entry.target.dataset.tag}"]`)?.classList.add('active');
  }
}, { rootMargin: '-15% 0px -75% 0px' });

document.querySelectorAll('.component').forEach((section) => sectionObserver.observe(section));

/*
 * Scroll a section under the sticky header. The sections use
 * content-visibility: auto, so off-screen ones are only size-estimated - a
 * plain anchor jump to a far section lands off, then the sections near the
 * landing render their real height and shift the target. Re-pin the target
 * across a few frames until its position stops moving, so one click lands it.
 */
function scrollToSection (id) {
  const target = document.getElementById(id);

  if (!target) {
    return;
  }

  const headerH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h'));
  const pad     = (Number.isFinite(headerH) ? headerH : 68) + 16;

  let prev  = -1;
  let tries = 0;

  const pin = () => {
    const top = Math.round(window.scrollY + target.getBoundingClientRect().top - pad);

    // behavior:instant overrides the page's smooth scroll-behavior, so the jump
    // lands immediately instead of animating slowly across a tall reference page.
    window.scrollTo({ top: Math.max(0, top), left: 0, behavior: 'instant' });
    tries += 1;

    // Re-pin until the target stops moving (late font / layout settling can
    // shift it a frame or two after the first jump), then stop.
    if (Math.abs(top - prev) > 1 && tries < 30) {
      prev = top;
      requestAnimationFrame(pin);
    }
  };

  pin();
}

// In-page nav links (the sidebar) scroll through the correction loop above
document.addEventListener('click', (event) => {
  const link = event.target.closest('a[href^="#"]');

  if (!link) {
    return;
  }

  const id = link.getAttribute('href').slice(1);

  if (!document.getElementById(id)) {
    return;
  }

  event.preventDefault();
  history.replaceState(null, '', `#${id}`);
  scrollToSection(id);
});

// Mobile sidebar
const navToggle = document.getElementById('navToggle');
const sidebar   = document.getElementById('sidebar');

if (navToggle && sidebar) {
  navToggle.addEventListener('click', () => {
    const open = sidebar.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', String(open));
  });

  sidebar.addEventListener('click', (event) => {
    if (event.target.closest('a')) {
      sidebar.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
    }
  });
}

// Deep links resolve after render
if (location.hash) {
  scrollToSection(location.hash.slice(1));
}
