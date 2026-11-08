// Develop the plugin without Figma: serves the built panel next to a fake Figma
// canvas (harness.html runs the real code.js against a stand-in figma object)
// and a fake GitHub seeded with examples/checkout.
//
//   npm run plugin:dev        then open the printed address
//
// The panel connects to the fake GitHub with the token "test-token".

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { createFakeGitHub } = require('./fake-github.js');
const DEV = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN = path.resolve(DEV, '..');
const ROOT = path.resolve(PLUGIN, '..');

function exampleFiles() {
  const base = path.join(ROOT, 'examples', 'checkout');
  const files = {};
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name !== 'README.md' || dir !== base) files[path.relative(base, full).split(path.sep).join('/')] = fs.readFileSync(full, 'utf8');
    }
  };
  walk(base);
  return files;
}

export async function start({ port = 0, files = exampleFiles(), storage, fileKey, pluginData } = {}) {
  const github = createFakeGitHub({ files });
  // What the fake Figma starts with on each page load; tests can change it between loads.
  const state = { storage, fileKey, pluginData };
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://local');
    if (url.pathname.startsWith('/api/')) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Accept');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
      if (req.method === 'OPTIONS') return res.writeHead(204).end();
      let raw = '';
      req.on('data', (c) => (raw += c));
      req.on('end', () => {
        const r = github.handle(req.method, req.url.slice(4), raw ? JSON.parse(raw) : null, req.headers);
        res.writeHead(r.status, { 'Content-Type': 'application/json' }).end(JSON.stringify(r.json));
      });
      return;
    }
    const origin = `http://${req.headers.host}`;
    if (url.pathname === '/' || url.pathname === '/harness.html') {
      const config = {
        storage: state.storage || { 'd2s-settings': { repo: github.repo, branch: '', token: github.token, api: `${origin}/api` } },
        fileKey: state.fileKey,
        pluginData: state.pluginData,
      };
      const html = fs.readFileSync(path.join(DEV, 'harness.html'), 'utf8')
        .replace('<script>\n  // A stand-in', `<script>window.HARNESS = ${JSON.stringify(config)};</script>\n<script>\n  // A stand-in`);
      return res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(html);
    }
    const file = { '/ui.html': 'ui.html', '/code.js': 'code.js' }[url.pathname];
    if (file) {
      const type = file.endsWith('.html') ? 'text/html; charset=utf-8' : 'text/javascript';
      return res.writeHead(200, { 'Content-Type': type }).end(fs.readFileSync(path.join(PLUGIN, 'dist', file)));
    }
    res.writeHead(404).end('Not found');
  });
  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${server.address().port}/`, api: `http://127.0.0.1:${server.address().port}/api`, github, server, state };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { url } = await start({ port: Number(process.env.PORT) || 8787 });
  console.log(`Plugin harness: ${url}`);
}
