// Builds the Figma plugin into figma-plugin/dist: code.js (Figma's side) and
// ui.html (the panel), which embeds the real d2s core, so the plugin's gate is
// the CLI's gate. Zero dependencies: plain Node.js. Run: npm run plugin

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT, read, scriptSafe, pkg, sandboxScript } from '../site/bundle.mjs';

const PLUGIN = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(process.argv[2] || path.join(PLUGIN, 'dist'));

let html = read(PLUGIN, 'src', 'ui.html');
const slots = {
  '/*@styles*/': read(PLUGIN, 'src', 'ui.css'),
  '/*@sandbox*/': sandboxScript({ dirs: ['templates'] }),
  '/*@form*/': scriptSafe(read(ROOT, 'site', 'src', 'stage-form.js'), 'stage-form.js'),
  '/*@github*/': scriptSafe(read(PLUGIN, 'src', 'github.js'), 'github.js'),
  '/*@ui*/': scriptSafe(read(PLUGIN, 'src', 'ui.js'), 'ui.js'),
};
for (const [slot, value] of Object.entries(slots)) {
  if (!html.includes(slot)) throw new Error(`ui.html is missing ${slot}`);
  html = html.split(slot).join(value);
}
html = html.split('{{version}}').join(pkg.version);

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'ui.html'), html);
fs.copyFileSync(path.join(PLUGIN, 'src', 'code.js'), path.join(OUT, 'code.js'));

const kb = (fs.statSync(path.join(OUT, 'ui.html')).size / 1024).toFixed(1);
console.log(`Built ${path.relative(ROOT, OUT) || OUT}: code.js and ui.html (${kb} kB), discovery-to-spec ${pkg.version}`);
