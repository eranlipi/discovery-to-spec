// Builds the discoverytospec.com site into site/dist.
// Zero dependencies: plain Node.js. Cloudflare Pages runs `node site/build.mjs`.
//
// The sandbox runs the real CLI from src/, so the site always matches the code.

import fs from 'node:fs';
import path from 'node:path';
import { SITE, ROOT, read, walk, scriptSafe, jsonSafe, pkg, sandboxScript } from './bundle.mjs';
import { assistantInstructions, assistantDescription } from '../integrations/claude-app/instructions.mjs';

const OUT = path.resolve(process.argv[2] || path.join(SITE, 'dist'));

// ---------- the CLI as browser modules ----------

const sandbox = sandboxScript();

// ---------- sample text for "fill", "approve" and "Use example text" ----------

function sectionsOf(text) {
  const body = text.replace(/^---\n[\s\S]*?\n---\n/, '');
  const map = {};
  let key = null;
  for (const line of body.split('\n')) {
    const m = line.match(/^##\s+(.+?)\s*$/);
    if (m) {
      key = m[1].replace(/\((optional|אופציונלי)\)/i, '').trim();
      map[key] = [];
    } else if (key) map[key].push(line);
  }
  for (const k of Object.keys(map)) {
    map[k] = map[k].join('\n').replace(/<!--[\s\S]*?-->/g, '').trim();
    if (!map[k]) delete map[k];
  }
  return map;
}

const STAGE_FILES = ['brief.md', 'insights.md', 'options.md', 'decision.md', 'spec.md'];
const sampleDirs = {
  en: path.join(ROOT, 'examples', 'checkout', 'design', 'explorations', '001-checkout-mobile'),
  he: path.join(SITE, 'samples', 'he'),
};
const samples = {};
for (const [lang, dir] of Object.entries(sampleDirs)) {
  samples[lang] = {};
  for (const file of STAGE_FILES) samples[lang][file] = sectionsOf(read(dir, file));
}

// ---------- page ----------

const i18n = read(SITE, 'src', 'i18n.js');
const form = read(SITE, 'src', 'stage-form.js');
const designer = read(SITE, 'src', 'designer.js');
const app = read(SITE, 'src', 'app.js');
// The d2s assistant's instructions and sample notes, for the copy buttons.
const assistant = {
  instructions: assistantInstructions(),
  description: assistantDescription(),
  notes: { en: read(SITE, 'samples', 'notes-en.md'), he: read(SITE, 'samples', 'notes-he.md') },
};
const data = `window.D2S_SAMPLES = ${jsonSafe(samples)};\nwindow.D2S_VERSION = ${jsonSafe(pkg.version)};\nwindow.D2S_ASSISTANT = ${jsonSafe(assistant)};`;

let html = read(SITE, 'src', 'index.html');
const slots = {
  '/*@styles*/': read(SITE, 'src', 'styles.css'),
  '/*@sandbox*/': sandbox,
  '/*@data*/': data,
  '/*@i18n*/': scriptSafe(i18n, 'i18n.js').split('{{version}}').join(pkg.version),
  '/*@form*/': scriptSafe(form, 'stage-form.js'),
  '/*@designer*/': scriptSafe(designer, 'designer.js'),
  '/*@app*/': scriptSafe(app, 'app.js'),
};
for (const [slot, value] of Object.entries(slots)) {
  if (!html.includes(slot)) throw new Error(`index.html is missing ${slot}`);
  html = html.split(slot).join(value);
}
html = html.split('{{version}}').join(pkg.version);

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'index.html'), html);
for (const rel of walk(path.join(SITE, 'public'))) {
  fs.mkdirSync(path.dirname(path.join(OUT, rel)), { recursive: true });
  fs.copyFileSync(path.join(SITE, 'public', rel), path.join(OUT, rel));
}

const kb = (fs.statSync(path.join(OUT, 'index.html')).size / 1024).toFixed(1);
console.log(`Built ${path.relative(ROOT, OUT) || OUT}/index.html (${kb} kB), discovery-to-spec ${pkg.version}`);
