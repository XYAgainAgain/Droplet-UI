/*
 * The migration page renderer (/migration): the name tables are generated
 * from the shipped registry and the docs data so they cannot drift from the code.
 */

import '../../package.js';

import { escapeHTML, wireMotionToggle, wireThemeToggle } from '../shared/common.js';

import * as registry        from '../../dist/droplet.js';
import { COMPONENTS }       from '../content/data.js';

wireMotionToggle(document.getElementById('motionToggle'));
wireThemeToggle(document.getElementById('themeToggle'));

// The top bar's page links are droplet-buttons, not anchors, so wire navigation
document.querySelector('[data-subnav-showcase]')?.addEventListener('click', () => {
  window.location.href = '../';
});
document.querySelector('[data-subnav-api]')?.addEventListener('click', () => {
  window.location.href = '../api/';
});
document.querySelector('[data-subnav-migration]')?.addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// Element Names

const PREFIX = /^(jelly|droplet)-/;

const pascal = (key) => key.charAt(0).toUpperCase() + key.slice(1);

const { TAGS = {}, LEGACY_TAGS } = registry;
const legacyTagFor = (key) => LEGACY_TAGS?.[key] ?? TAGS[key].replace(PREFIX, 'jelly-');

const elementRows = Object.keys(TAGS).sort((a, b) => TAGS[a].localeCompare(TAGS[b])).map((key) => `
  <tr>
    <td><code>&lt;${escapeHTML(legacyTagFor(key))}&gt;</code></td>
    <td><code>&lt;${escapeHTML(TAGS[key])}&gt;</code></td>
    <td><code>Jelly${escapeHTML(pascal(key))}</code></td>
    <td><code>Droplet${escapeHTML(pascal(key))}</code></td>
  </tr>`).join('');

document.querySelector('#elementTable tbody').innerHTML = elementRows
  || '<tr><td colspan="4">The registry exported no tags; rebuild <code>dist/</code>.</td></tr>';

// CSS Custom Properties

// Reduce either prefix to the stem and emit both names from it
const stemOf = (name) => name.replace(/^--(jelly|droplet)-/, '');

function tokenGroup (item) {
  const stems = [...new Map((item.cssProperties || []).map((p) => [stemOf(p.name), p])).entries()];

  if (stems.length === 0) {
    return '';
  }

  const tag  = item.tag.replace(PREFIX, 'droplet-');
  const rows = stems.map(([stem, p]) => `
    <tr>
      <td><code>--jelly-${escapeHTML(stem)}</code></td>
      <td><code>--droplet-${escapeHTML(stem)}</code></td>
      <td>${p.default != null ? `<code>${escapeHTML(String(p.default))}</code>` : '<span class="dash">–</span>'}</td>
    </tr>`).join('');

  return `
    <section class="token-group" aria-labelledby="tokens-${escapeHTML(tag)}">
      <h3 id="tokens-${escapeHTML(tag)}">&lt;${escapeHTML(tag)}&gt;</h3>
      <div class="table-scroll">
        <table>
          <caption>Custom properties read by ${escapeHTML(tag)}, under both names</caption>
          <thead>
            <tr>
              <th scope="col">Jelly name</th>
              <th scope="col">Droplet name</th>
              <th scope="col">Default</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>`;
}

document.getElementById('tokenGroups').innerHTML = COMPONENTS.map(tokenGroup).join('')
  || '<p class="note">No token data yet; run <code>npm run docs</code>.</p>';

// Copy buttons

document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-copy]');

  if (!button) {
    return;
  }

  const code = button.closest('.code')?.querySelector('code')?.textContent || '';

  // The label changes too, so a screen reader hears the result, not just the old name
  const label = button.getAttribute('aria-label');

  navigator.clipboard?.writeText(code).then(() => {
    button.textContent = 'Copied';
    button.setAttribute('aria-label', 'Copied');
    setTimeout(() => {
      button.textContent = 'Copy';
      if (label) button.setAttribute('aria-label', label);
    }, 1200);
  });
});
