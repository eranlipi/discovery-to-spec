// Builds the discoverytospec.com site into site/dist.
// Zero dependencies: plain Node.js. Cloudflare Pages runs `node site/build.mjs`.
//
// The sandbox runs the real CLI from src/, so the site always matches the code.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SITE, '..');
const OUT = path.resolve(process.argv[2] || path.join(SITE, 'dist'));

const read = (...p) => fs.readFileSync(path.join(...p), 'utf8');

function walk(dir, base = dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? walk(full, base) : [path.relative(base, full).split(path.sep).join('/')];
  });
}

// Anything inlined into <script> must not open an HTML comment or close the script.
function scriptSafe(js, label) {
  const safe = js.replace(/<!--/g, '<\\!--');
  if (/<\/script/i.test(safe)) throw new Error(`${label} contains "</script"`);
  return safe;
}
const jsonSafe = (value) => JSON.stringify(value).replace(/</g, '\\u003c');

// ---------- the CLI as browser modules ----------

const pkg = JSON.parse(read(ROOT, 'package.json'));
const modules = ['src/lib.js', 'src/cli.js']
  .map((rel) => {
    const src = scriptSafe(read(ROOT, rel), rel);
    return `${JSON.stringify('/pkg/' + rel)}: function (module, exports, require, __dirname, __filename, process, console) {\n${src}\n}`;
  })
  .join(',\n');

const packaged = {};
for (const dir of ['templates', 'integrations']) {
  for (const rel of walk(path.join(ROOT, dir))) packaged[`${dir}/${rel}`] = read(ROOT, dir, rel);
}

const sandbox = [
  '(function () {',
  `var BUNDLE = { pkg: ${jsonSafe({ name: pkg.name, version: pkg.version })}, files: ${jsonSafe(packaged)}, modules: {\n${modules}\n} };`,
  scriptSafe(read(SITE, 'src', 'runtime.js'), 'runtime.js'),
  '// Each view gets its own in-memory project.',
  'window.D2S_NEW = function () { return createD2sSandbox(BUNDLE); };',
  'window.D2S = window.D2S_NEW();',
  '})();',
].join('\n');

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
const data = `window.D2S_SAMPLES = ${jsonSafe(samples)};\nwindow.D2S_VERSION = ${jsonSafe(pkg.version)};`;

let html = read(SITE, 'src', 'index.html');
const slots = {
  '/*@styles*/': read(SITE, 'src', 'styles.css'),
  '/*@sandbox*/': sandbox,
  '/*@data*/': data,
  '/*@i18n*/': scriptSafe(i18n, 'i18n.js'),
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
