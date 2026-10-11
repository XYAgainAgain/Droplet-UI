# Updating the website & documentation

Everything on both pages is generated from **two hand-edited data files**
(`content/content.js` and `showcase/playgrounds.js`) plus one generated one
(`content/data.js`). You almost never touch HTML or renderer code to update the
docs.

| File                          | What it drives                                                            |
| ----------------------------- | ------------------------------------------------------------------------- |
| `docs/content/content.js`     | **The curated source you edit.** Every summary, description, keyboard map, method, property and code example. Its attribute/event/slot/part/token descriptions are merged, at build time, with the API surface the component TypeScript actually exposes. |
| `docs/content/data.js`        | **Generated — never edit by hand.** `npm run docs` reconciles `content.js` against `custom-elements.json` (the Custom Elements Manifest built from the component TypeScript + JSDoc) and writes this file, which the API reference (`/api`) and every showcase panel render. Untracked (gitignored) — run `npm run docs` once after a fresh clone. |
| `docs/showcase/playgrounds.js`| **The live demos.** Per component: the preview's markup, which attributes the showcase offers as clickable options / editable text and which DOM events write back into the table. |

The other files are plumbing you rarely touch:

- `docs/api/index.js` — renders `data.js` into the reference tables
- `docs/showcase/index.js` — renders the showcase (one section per component)
- `docs/shared/common.js` — the shared theme and reduced-motion toggles
- `docs/lottie/index.js` — lazy-loads the decorative Lottie illustrations (hero + outro)
- `docs/shared/site.css` — shared chrome: tokens, the top bar, code blocks, placeholders
- `docs/showcase/showcase.css` / `docs/api/reference.css` — per-page styles
- `docs/showcase/index.html` / `docs/api/index.html` — markup skeletons only (no styles, no content)

Each page is authored for its final URL depth (the showcase at `/`, the API page
at `/api/`), so `npm run build:site` assembles them into `_site/` by copying —
no path rewriting. `npm run serve` mirrors the same URLs from the source tree.

## Fix a typo / edit documentation

Edit the component's descriptor in `docs/content/content.js`, then run
`npm run docs` to regenerate `docs/content/data.js`. Both pages update on reload.
The reconciler warns if the docs mention an attribute/event/slot/part the source
no longer exposes (or miss a new one), so the reference can't silently drift.

## Add a new component

1. **Document it** — copy an existing descriptor in `docs/content/content.js`
   (entries are grouped by product area; keep `tag`, `group`, `summary` and at
   least `attributes` + one `examples` entry), then run `npm run docs`. It now
   appears on `/api` and in the showcase's group order.
2. **Give it a demo** — add an entry to `PLAYGROUNDS` in
   `docs/showcase/playgrounds.js`, keyed by tag:

   ```js
   'droplet-thing': {
     slot: 'Label text',                        // or `inner` for child markup
     attrs: { label: 'Accessible demo name' },  // optional static attributes
     controls: [variant(), size(), bool('disabled')],
     bind: [{ event: 'change', attr: 'value', get: (el) => el.value }],
     defaults: { disabled: false },             // only where they differ
     note: 'Shown under the attribute table.',  // optional
   },
   ```

   The control shorthands (`bool`, `size`, `variant`, `pick`, `numField`, `text`)
   are defined at the top of the file. Every control's options render at once
   as clickable badges (text controls as an editable field). Components that
   should not get their own panel (child-only elements like `droplet-option`)
   go in `NO_PANEL` instead — documented on the reference,
   skipped by the showcase.
3. **Reload.** Each panel is one section; nothing else to wire.

## Change an existing demo

- **Different preview markup** → `slot` (plain text) or `inner` (HTML) in its
  `PLAYGROUNDS` entry.
- **Different options** → the control's `options`
  (`pick('tone', ['info', 'success'])`).
- **Reflect user interaction back into the table** → a `bind` entry
  (`{ event, attr, get }`).

## Change the homepage (hero / outro)

The hero copy, stat badges and CTA buttons are plain markup at the top of
`docs/showcase/index.html`; the outro (footer) sits at the bottom of the same
file. The two decorative Lottie illustrations are `docs/lottie/hero-lottie.json`
and `docs/lottie/footer-lottie.json` — swap either file to swap the animation
(512×512 Lottie JSON works best; they load lazily via `docs/lottie/index.js`).
The Lottie player itself is the `lottie-web` dev dependency — the dev server
streams it from `node_modules` and `build:site` copies it into `_site/`, so
nothing is vendored.

## Icons

The site (and `droplet-alert`) use the Fluent System Icons. Each glyph is a
standalone 24×24 file under `src/icons/*.svg`, imported as a raw string and
registered in `src/icons/index.ts`. To use one anywhere:

```js
import { dropletIcon } from '../../package.js';

element.innerHTML = dropletIcon('heart', { size: 18 });
```

To add a new icon, drop its 24×24 SVG from
[microsoft/fluentui-system-icons](https://github.com/microsoft/fluentui-system-icons)
(MIT) into `src/icons/<name>.svg`, then import it in `src/icons/index.ts` and add
it to the `ICONS` map — its name joins the typed `IconName` union automatically.

## Publishing

Push to `main` — `.github/workflows/deploy-pages.yml` type-checks, tests and
**builds** the site with `npm run build:site` (which builds `dist/droplet.js`,
regenerates the docs data, and assembles a clean `_site/`), then deploys only
`_site/` to GitHub Pages.
