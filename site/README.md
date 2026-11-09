# discoverytospec.com

The project website: one static page, English by default with a Hebrew option, and a sandbox that runs the real `d2s` CLI in the browser. The sandbox has two views: **Designer** (forms and a Next stage button, the default) and **Developer** (a file tree, an editor and a terminal). Each view runs its own in-memory project.

## How it works

- `site/build.mjs` reads `src/lib.js` and `src/cli.js`, wraps them as browser modules, embeds the templates and agent files, and inlines everything into `site/dist/index.html`. There are no dependencies and no bundler.
- `site/src/runtime.js` gives that code what Node would: an in-memory file system, `path`, `process` and `console`. Nothing is stored on a server and nothing leaves the page.
- Because the sandbox runs the code from `src/`, the site always matches the library. `test/site.test.js` builds the site and runs the sandbox bundle, so a change that breaks it fails CI.
- The `fill` and `approve` sandbox commands, and the Designer view's **Use example text**, write example text from `examples/checkout` (English) and `site/samples/he` (Hebrew).

| File | What it is |
| --- | --- |
| `src/index.html` | Page template. English text lives here. |
| `src/i18n.js` | Hebrew strings, keyed by each element's `data-i18n` |
| `src/styles.css` | Styles, light and dark themes, right-to-left support |
| `src/app.js` | Theme and language switching, tabs, the Developer view |
| `src/designer.js` | The Designer view: stage rail, gate, approvals, handoff preview |
| `src/stage-form.js` | The stage form, shared with the Figma plugin: Markdown to fields and back, Paste from AI (one stage, or a discovery session through the gate), plus a small Markdown preview |
| `src/runtime.js` | The in-browser runtime for the CLI |
| `public/` | Copied as is: `_headers`, `favicon.svg`, `robots.txt` |

## Build locally

```bash
npm run site                      # writes site/dist
npx serve site/dist               # or any static server
```

## Deploy on Cloudflare Pages

1. In the Cloudflare dashboard, open **Workers & Pages**, create a new **Pages** project and connect it to the `eranlipi/discovery-to-spec` GitHub repository.
2. Build settings:
   - Framework preset: **None**
   - Build command: `node site/build.mjs`
   - Build output directory: `site/dist`
   - Root directory: leave empty
   - Environment variable (optional): `NODE_VERSION` = `20`
3. Deploy. Every push to `master` redeploys the site, and pull requests get preview URLs.
4. Under the project's **Custom domains**, add `discoverytospec.com`. Because the domain is already on Cloudflare, the DNS record is created for you. Add `www.discoverytospec.com` too if you want it.

The labels in the dashboard change from time to time, but the four values in step 2 are all Pages needs.

## Editing copy

- English: edit `src/index.html`.
- Hebrew: edit the matching key in `src/i18n.js`. Every element with a `data-i18n` attribute needs a Hebrew entry, or it stays in English.
