// The real d2s CLI as a browser script, shared by the website and the Figma plugin.
// It wraps src/lib.js and src/cli.js as modules, embeds the packaged files, and adds
// site/src/runtime.js, which supplies an in-memory fs, path, process and console.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SITE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(SITE, '..');

export const read = (...p) => fs.readFileSync(path.join(...p), 'utf8');

export function walk(dir, base = dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? walk(full, base) : [path.relative(base, full).split(path.sep).join('/')];
  });
}

// Anything inlined into <script> must not open an HTML comment or close the script.
export function scriptSafe(js, label) {
  const safe = js.replace(/<!--/g, '<\\!--');
  if (/<\/script/i.test(safe)) throw new Error(`${label} contains "</script"`);
  return safe;
}
export const jsonSafe = (value) => JSON.stringify(value).replace(/</g, '\\u003c');

export const pkg = JSON.parse(read(ROOT, 'package.json'));

/**
 * A script that defines window.D2S_NEW(), which returns a fresh in-memory d2s,
 * and window.D2S, one ready instance. `dirs` are the packaged folders to embed.
 */
export function sandboxScript({ dirs = ['templates', 'integrations'] } = {}) {
  const modules = ['src/lib.js', 'src/cli.js']
    .map((rel) => {
      const src = scriptSafe(read(ROOT, rel), rel);
      return `${JSON.stringify('/pkg/' + rel)}: function (module, exports, require, __dirname, __filename, process, console) {\n${src}\n}`;
    })
    .join(',\n');
  const packaged = {};
  for (const dir of dirs) {
    for (const rel of walk(path.join(ROOT, dir))) packaged[`${dir}/${rel}`] = read(ROOT, dir, rel);
  }
  return [
    '(function () {',
    `var BUNDLE = { pkg: ${jsonSafe({ name: pkg.name, version: pkg.version })}, files: ${jsonSafe(packaged)}, modules: {\n${modules}\n} };`,
    scriptSafe(read(SITE, 'src', 'runtime.js'), 'runtime.js'),
    '// Each view gets its own in-memory project.',
    'window.D2S_NEW = function () { return createD2sSandbox(BUNDLE); };',
    'window.D2S = window.D2S_NEW();',
    '})();',
  ].join('\n');
}
