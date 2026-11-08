'use strict';

// A small in-memory GitHub for developing and testing the plugin without the
// network: refs, commits, trees and blobs, behind the same REST routes the
// plugin uses. `fetch` serves it in-process; `listen()` serves it over HTTP
// with CORS, for the plugin UI in a browser.

const http = require('node:http');

function createFakeGitHub({ repo = 'acme/app', branch = 'main', token = 'test-token', files = {} } = {}) {
  const blobs = new Map();
  const trees = new Map();
  const commits = new Map();
  const refs = new Map();
  const log = [];
  let n = 0;
  const id = (prefix) => prefix + (++n).toString(16).padStart(39, '0');

  const putTree = (map) => {
    const sha = id('t');
    trees.set(sha, { ...map });
    return sha;
  };
  const putBlob = (text) => {
    const sha = id('b');
    blobs.set(sha, text);
    return sha;
  };
  const putCommit = (tree, parents, message) => {
    const sha = id('c');
    commits.set(sha, { tree, parents, message });
    log.push(message);
    return sha;
  };
  const treeOf = (b) => trees.get(commits.get(refs.get(b)).tree);

  const initial = {};
  for (const [p, text] of Object.entries(files)) initial[p] = putBlob(text);
  refs.set(branch, putCommit(putTree(initial), [], 'initial'));

  function handle(method, url, body, headers = {}) {
    if (headers.authorization !== `Bearer ${token}`) return { status: 401, json: { message: 'Bad credentials' } };
    const u = new URL(url, 'http://fake');
    const prefix = `/repos/${repo}`;
    if (!u.pathname.startsWith(prefix)) return { status: 404, json: { message: 'Not Found' } };
    const route = decodeURIComponent(u.pathname.slice(prefix.length));
    let m;
    if (method === 'GET' && route === '') return { status: 200, json: { full_name: repo, default_branch: branch } };
    if (method === 'GET' && (m = /^\/git\/ref\/heads\/(.+)$/.exec(route))) {
      return refs.has(m[1]) ? { status: 200, json: { object: { sha: refs.get(m[1]) } } } : { status: 404, json: { message: 'Not Found' } };
    }
    if (method === 'POST' && route === '/git/refs') {
      refs.set(body.ref.replace(/^refs\/heads\//, ''), body.sha);
      return { status: 201, json: { ref: body.ref, object: { sha: body.sha } } };
    }
    if (method === 'PATCH' && (m = /^\/git\/refs\/heads\/(.+)$/.exec(route))) {
      refs.set(m[1], body.sha);
      return { status: 200, json: { object: { sha: body.sha } } };
    }
    if (method === 'GET' && (m = /^\/git\/commits\/(\w+)$/.exec(route))) {
      const c = commits.get(m[1]);
      return c ? { status: 200, json: { sha: m[1], tree: { sha: c.tree }, parents: c.parents.map((sha) => ({ sha })), message: c.message } } : { status: 404, json: {} };
    }
    if (method === 'GET' && (m = /^\/git\/trees\/(\w+)$/.exec(route))) {
      const map = trees.get(m[1]);
      if (!map) return { status: 404, json: {} };
      const dirs = new Set();
      for (const p of Object.keys(map)) {
        const parts = p.split('/');
        for (let i = 1; i < parts.length; i++) dirs.add(parts.slice(0, i).join('/'));
      }
      const tree = [...dirs].map((p) => ({ path: p, type: 'tree', sha: 'dir' })).concat(Object.entries(map).map(([p, sha]) => ({ path: p, type: 'blob', sha })));
      return { status: 200, json: { sha: m[1], tree, truncated: false } };
    }
    if (method === 'GET' && (m = /^\/git\/blobs\/(\w+)$/.exec(route))) {
      if (!blobs.has(m[1])) return { status: 404, json: {} };
      return { status: 200, json: { sha: m[1], encoding: 'base64', content: Buffer.from(blobs.get(m[1]), 'utf8').toString('base64') } };
    }
    if (method === 'POST' && route === '/git/trees') {
      const map = { ...(trees.get(body.base_tree) || {}) };
      for (const e of body.tree) {
        if (e.sha === null) delete map[e.path];
        else map[e.path] = e.content !== undefined ? putBlob(e.content) : e.sha;
      }
      return { status: 201, json: { sha: putTree(map) } };
    }
    if (method === 'POST' && route === '/git/commits') {
      return { status: 201, json: { sha: putCommit(body.tree, body.parents, body.message) } };
    }
    return { status: 404, json: { message: `No fake route for ${method} ${route}` } };
  }

  const fake = {
    repo,
    branch,
    token,
    log,
    /** The files on a branch, as { path: text }. */
    files(b = branch) {
      const out = {};
      for (const [p, sha] of Object.entries(treeOf(b))) out[p] = blobs.get(sha);
      return out;
    },
    /** Someone else pushes a commit. */
    push(changes, message = 'someone else', b = branch) {
      const map = { ...treeOf(b) };
      for (const [p, text] of Object.entries(changes)) map[p] = putBlob(text);
      refs.set(b, putCommit(putTree(map), [refs.get(b)], message));
    },
    handle,
    /** A fetch() for the in-process API. */
    fetch(url, init = {}) {
      const headers = {};
      for (const [k, v] of Object.entries(init.headers || {})) headers[k.toLowerCase()] = v;
      const r = handle(init.method || 'GET', url, init.body ? JSON.parse(init.body) : null, headers);
      const text = JSON.stringify(r.json);
      return Promise.resolve({ ok: r.status < 400, status: r.status, text: () => Promise.resolve(text) });
    },
    /** Serve the API over HTTP with CORS. Resolves to the base URL. */
    listen(port = 0) {
      const server = http.createServer((req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Accept');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          return res.end();
        }
        let raw = '';
        req.on('data', (c) => (raw += c));
        req.on('end', () => {
          const r = handle(req.method, req.url, raw ? JSON.parse(raw) : null, req.headers);
          res.statusCode = r.status;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(r.json));
        });
      });
      fake.server = server;
      return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`)));
    },
  };
  return fake;
}

module.exports = { createFakeGitHub };
