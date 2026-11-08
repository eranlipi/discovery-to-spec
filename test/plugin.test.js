'use strict';

// The Figma plugin: its GitHub client against a fake GitHub, its Figma side
// (code.js) against a stand-in figma object, and its build.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const PLUGIN = path.join(ROOT, 'figma-plugin');
const GitHub = require('../figma-plugin/src/github.js');
const { createFakeGitHub } = require('../figma-plugin/dev/fake-github.js');

const DOC = 'design/explorations/001-x/brief.md';
const OTHER = 'design/explorations/001-x/insights.md';

function setup() {
  const fake = createFakeGitHub({ files: { '.d2s.json': '{"dir":"design"}', [DOC]: '## Problem\n', [OTHER]: '## Sources\n' } });
  const client = GitHub.createClient({ repo: fake.repo, token: fake.token, api: 'https://fake', fetch: fake.fetch });
  return { fake, client };
}

test('plugin: loads a branch and saves changes as one commit', async () => {
  const { fake, client } = setup();
  const head = await client.head('main');
  assert.ok(head);
  assert.equal(await client.head('nope'), null, 'a missing branch is null, not an error');

  const entries = await client.entries(head);
  assert.ok(entries.some((e) => e.path === 'design/explorations' && e.type === 'tree'), 'folders are listed');
  const files = await client.readFiles(entries.filter((e) => e.type === 'blob'));
  assert.equal(files[DOC], '## Problem\n');

  const changes = { [DOC]: '## Problem\nUsers abandon checkout. עברית תקינה.\n', 'design/explorations/001-x/options.md': '## A\n' };
  const r = await client.save('main', head, changes, 'brief updated by Dana via d2s plugin');
  assert.deepEqual(r.conflicts, []);
  assert.equal(fake.log.at(-1), 'brief updated by Dana via d2s plugin');
  assert.equal(fake.log.length, 2, 'one commit for all the files');
  assert.equal(fake.files()[DOC], changes[DOC], 'UTF-8 survives the round trip');
  assert.equal(fake.files()['design/explorations/001-x/options.md'], '## A\n');
  assert.equal(await client.head('main'), r.commit);
});

test('plugin: saving notices when someone else changed the same file', async () => {
  const { fake, client } = setup();
  const base = await client.head('main');

  fake.push({ [OTHER]: '## Sources\nTheirs.\n' }, 'teammate: insights');
  let r = await client.save('main', base, { [DOC]: '## Problem\nMine.\n' }, 'mine');
  assert.deepEqual(r.conflicts, [], 'a change to another file is not a conflict');
  assert.equal(fake.files()[OTHER], '## Sources\nTheirs.\n', 'their change is kept');

  const base2 = r.commit;
  fake.push({ [DOC]: '## Problem\nTheirs.\n' }, 'teammate: brief');
  r = await client.save('main', base2, { [DOC]: '## Problem\nMine again.\n' }, 'mine again');
  assert.deepEqual(r.conflicts, [DOC]);
  assert.equal(r.theirs[DOC], '## Problem\nTheirs.\n', 'their text comes back for the choice');
  assert.equal(fake.files()[DOC], '## Problem\nTheirs.\n', 'nothing was written');

  r = await client.save('main', base2, { [DOC]: '## Problem\nTheirs.\n' }, 'same text');
  assert.deepEqual(r.conflicts, [], 'the same text on both sides is no conflict');

  r = await client.save('main', base2, { [DOC]: '## Problem\nMine wins.\n' }, 'keep mine', [DOC]);
  assert.deepEqual(r.conflicts, []);
  assert.equal(fake.files()[DOC], '## Problem\nMine wins.\n', '"Keep mine" overwrites');
});

test('plugin: branches and errors', async () => {
  const { fake, client } = setup();
  const head = await client.head('main');
  await client.createBranch('d2s/pilot', head);
  assert.equal(await client.head('d2s/pilot'), head, 'branch names with slashes work');
  await client.save('d2s/pilot', head, { [DOC]: 'pilot\n' }, 'on the pilot branch');
  assert.equal(fake.files('main')[DOC], '## Problem\n', 'main is untouched');
  assert.equal(fake.files('d2s/pilot')[DOC], 'pilot\n');

  const bad = GitHub.createClient({ repo: fake.repo, token: 'wrong', api: 'https://fake', fetch: fake.fetch });
  await assert.rejects(bad.head('main'), /GitHub refused the token/);
  assert.throws(() => GitHub.createClient({ repo: 'not a repo', token: 'x' }), /owner\/name/);
});

/** Run code.js against a stand-in figma object and talk to it like the panel does. */
function figmaSide() {
  const posted = [];
  const pluginData = {};
  const storage = {};
  const pages = { a: { type: 'PAGE', name: 'Page 1', selection: [] }, b: { type: 'PAGE', name: 'Flows', selection: [] } };
  const nodes = { '10:1': { id: '10:1', name: 'Checkout', type: 'FRAME', parent: pages.a }, '20:5': { id: '20:5', name: 'Done', type: 'FRAME', parent: pages.b } };
  const calls = [];
  const figma = {
    showUI: (html, opts) => calls.push(['showUI', opts]),
    ui: { postMessage: (m) => posted.push(m), onmessage: null },
    currentUser: { name: 'Dana Levi' },
    fileKey: 'KEY1',
    root: { name: 'Checkout', getPluginData: (k) => pluginData[k] || '', setPluginData: (k, v) => (pluginData[k] = v) },
    currentPage: pages.a,
    clientStorage: {
      getAsync: async (k) => storage[k],
      setAsync: async (k, v) => void (storage[k] = v),
      deleteAsync: async (k) => void delete storage[k],
    },
    getNodeByIdAsync: async (id) => nodes[id] || null,
    setCurrentPageAsync: async (p) => void (figma.currentPage = p),
    viewport: { scrollAndZoomIntoView: (list) => calls.push(['zoom', list.map((n) => n.id)]) },
    openExternal: (url) => calls.push(['open', url]),
    notify: (text) => calls.push(['notify', text]),
    on: () => {},
  };
  vm.runInNewContext(fs.readFileSync(path.join(PLUGIN, 'src', 'code.js'), 'utf8'), { figma, __html__: '' });
  let id = 0;
  const send = async (type, data = {}) => {
    const msgId = ++id;
    figma.ui.onmessage({ type, id: msgId, ...data });
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setImmediate(r));
      const reply = posted.find((m) => m.type === 'reply' && m.id === msgId);
      // Plain copies: objects made inside the vm sandbox belong to another realm.
      if (reply) return JSON.parse(JSON.stringify(reply));
    }
    throw new Error(`no reply to ${type}`);
  };
  return { figma, send, calls, storage, pluginData, pages, nodes };
}

test('plugin: the Figma side answers the panel', async () => {
  const f = figmaSide();
  assert.equal(f.calls[0][1].themeColors, true);

  await f.send('store', { key: 'd2s-settings', value: { repo: 'acme/app' } });
  f.figma.currentPage.selection = [f.nodes['10:1']];
  let r = await f.send('init');
  assert.equal(r.result.user, 'Dana Levi');
  assert.equal(r.result.fileKey, 'KEY1');
  assert.deepEqual(r.result.settings, { repo: 'acme/app' }, 'settings come back from clientStorage');
  assert.deepEqual(r.result.selection, [{ id: '10:1', name: 'Checkout', type: 'FRAME' }]);

  await f.send('link', { ref: 'acme/app#001-x' });
  r = await f.send('link', { ref: 'acme/app#001-x' });
  assert.deepEqual(r.result, ['acme/app#001-x'], 'an exploration is linked to the file once');
  assert.deepEqual((await f.send('init')).result.linked, ['acme/app#001-x']);

  r = await f.send('show-node', { nodeId: '20:5' });
  assert.equal(r.result, true);
  assert.equal(f.figma.currentPage, f.pages.b, 'it moves to the frame’s page');
  assert.equal(f.pages.b.selection.length, 1);
  assert.equal(f.pages.b.selection[0], f.nodes['20:5'], 'the frame is selected');
  assert.equal(JSON.stringify(f.calls.at(-1)), '["zoom",["20:5"]]', 'and zooms to it');
  assert.equal((await f.send('show-node', { nodeId: '99:9' })).result, false, 'a deleted frame is reported, not thrown');

  await f.send('store', { key: 'd2s-settings', value: null });
  assert.equal(f.storage['d2s-settings'], undefined, 'storing null deletes');
  assert.match((await f.send('nope')).error, /Unknown message/);
});

test('plugin: builds into a manifest-ready folder that embeds the real d2s', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'd2s-plugin-'));
  const r = spawnSync(process.execPath, [path.join(PLUGIN, 'build.mjs'), out], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr || r.stdout);

  const manifest = JSON.parse(fs.readFileSync(path.join(PLUGIN, 'manifest.json'), 'utf8'));
  assert.equal(manifest.main, 'dist/code.js');
  assert.equal(manifest.ui, 'dist/ui.html');
  assert.deepEqual(manifest.networkAccess.allowedDomains, ['https://api.github.com']);
  assert.ok(manifest.permissions.includes('currentuser'), 'the plugin reads the user’s name');
  assert.equal(manifest.documentAccess, 'dynamic-page');

  const html = fs.readFileSync(path.join(out, 'ui.html'), 'utf8');
  assert.doesNotMatch(html, /\/\*@\w+\*\//, 'every slot is filled');
  assert.match(html, new RegExp(`discovery-to-spec ${require('../package.json').version.replace(/\./g, '\\.')}`));
  assert.equal(fs.readFileSync(path.join(out, 'code.js'), 'utf8'), fs.readFileSync(path.join(PLUGIN, 'src', 'code.js'), 'utf8'));

  // The scripts parse, and the embedded d2s runs the same gate as the CLI.
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  assert.equal(scripts.length, 4);
  scripts.forEach((s) => new vm.Script(s));
  const context = { window: {} };
  vm.runInNewContext(scripts[0], context);
  const d2s = context.window.D2S_NEW();
  d2s.write('.d2s.json', JSON.stringify({ lang: 'en', dir: 'design' }));
  assert.equal(d2s.run(['new', 'Saved cards', '--slug', 'cards']).code, 0, 'packaged templates are embedded');
  assert.match(d2s.run(['next', '1']).lines.join('\n'), /section "Problem" is empty/);
});
