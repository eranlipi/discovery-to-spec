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
const { createFakeDom } = require('../figma-plugin/dev/fake-dom.js');
const lib = require('../src/lib.js');

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

  const pending = { 'acme/app#main#001-x': [{ stage: 'options', text: '## Direction A\nSaved cards.' }] };
  await f.send('store', { key: 'd2s-pending', value: pending });
  assert.deepEqual((await f.send('init')).result.pending, pending, 'the parts of a pasted session wait on this computer');

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

// ---------- the panel, run for real ----------

let builtScripts = null;
/** The built ui.html's scripts: the d2s core, the stage form, the GitHub client and the panel. */
function panelScripts() {
  if (builtScripts) return builtScripts;
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'd2s-plugin-'));
  const r = spawnSync(process.execPath, [path.join(PLUGIN, 'build.mjs'), out], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr || r.stdout);
  builtScripts = [...fs.readFileSync(path.join(out, 'ui.html'), 'utf8').matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  return builtScripts;
}

/** A repository with d2s set up and one exploration at Frame, on a fake GitHub. */
function seededGitHub(lang = 'en') {
  const files = {
    '.d2s.json': JSON.stringify({ version: 1, lang, dir: 'design', cli: 'npx d2s', approvals: lib.DEFAULT_APPROVALS }),
    'design/decisions.md': lib.packagedTemplate(lang, 'decisions'),
    'design/explorations/001-checkout/brief.md': lib.render(lib.packagedTemplate(lang, 'brief'), { id: '001-checkout', title: 'Checkout', date: '2026-11-09', owner: 'Dana' }),
  };
  for (const name of ['brief', 'insights', 'options', 'decision', 'spec', 'handoff', 'summary']) files[`design/templates/${name}.md`] = lib.packagedTemplate(lang, name);
  return createFakeGitHub({ files });
}

/**
 * Open the panel the way Figma runs the plugin: code.js on one side, the built ui.html's scripts
 * on the other, talking through messages; GitHub is fake and the DOM is a stand-in.
 * `storage` is Figma's clientStorage on this computer: pass the same one to reopen the panel.
 */
async function openPanel(fake, storage) {
  const { document, Event, findAll } = createFakeDom();
  const app = document.createElement('div');
  app.id = 'app';
  document.body.appendChild(app);
  const clone = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v))); // messages and storage are copies
  const listeners = [];
  const panel = {
    document,
    Event,
    console,
    atob,
    TextDecoder,
    fetch: fake.fetch,
    setTimeout,
    clearTimeout,
    setInterval: () => 0,
    requestAnimationFrame: (fn) => setImmediate(fn),
    navigator: {},
    addEventListener: (type, fn) => type === 'message' && listeners.push(fn),
  };
  panel.window = panel;
  const figma = {
    showUI: () => {},
    ui: { onmessage: null, postMessage: (m) => setImmediate(() => listeners.forEach((fn) => fn({ data: { pluginMessage: clone(m) } }))) },
    currentUser: { name: 'Dana Levi' },
    fileKey: 'KEY1',
    root: { name: 'Checkout', getPluginData: () => '', setPluginData: () => {} },
    currentPage: { selection: [] },
    clientStorage: {
      getAsync: async (k) => clone(storage[k]),
      setAsync: async (k, v) => void (storage[k] = clone(v)),
      deleteAsync: async (k) => void delete storage[k],
    },
    notify: () => {},
    on: () => {},
  };
  vm.runInNewContext(fs.readFileSync(path.join(PLUGIN, 'src', 'code.js'), 'utf8'), { figma, __html__: '' });
  panel.parent = { postMessage: (data) => setImmediate(() => figma.ui.onmessage(clone(data.pluginMessage))) };
  vm.createContext(panel);
  for (const script of panelScripts()) vm.runInContext(script, panel);

  const all = (test) => findAll(app, test);
  const ui = {
    text: () => app.textContent,
    button: (label) => all((el) => el.tagName === 'BUTTON' && (label instanceof RegExp ? label.test(el.textContent) : el.textContent === label))[0],
    field: (key) => all((el) => el.getAttribute('data-key') === key)[0].querySelector('textarea'),
    type(key, value) {
      const area = ui.field(key);
      area.value = value;
      area.dispatchEvent(new Event('input', { bubbles: true }));
    },
    paste(text, labels = { open: 'Paste from AI', apply: 'Fill the fields' }) {
      ui.button(labels.open).click();
      all((el) => el.classList.contains('paste'))[0].querySelector('textarea').value = text;
      ui.button(labels.apply).click();
    },
    async until(test, what) {
      for (let i = 0; i < 2000; i++) {
        if (test()) return;
        await new Promise((resolve) => setImmediate(resolve));
      }
      throw new Error(`timed out waiting for ${what}\n${app.textContent}`);
    },
  };
  await ui.until(() => ui.button(/^Checkout/), 'the list of explorations');
  ui.button(/^Checkout/).click();
  return ui;
}

const FRAME = ['## Problem', 'Returning customers type their card on every order.', '## Who it matters to', 'Returning mobile customers.',
  '## Where it lives today', 'The Payment screen. Figma: to be added by design.', '## Desired outcome', 'More finished payments on mobile.',
  '## Appetite', 'Two weeks.', '## No-gos', 'No new payment provider.'];
const RESEARCH = ['## Sources', '5 interviews.', '## Key insights', '1. **Typing the card is where they give up.** 3 of 5. Confidence: medium.', '## Opportunities', 'How might we skip typing?'];
const OPTIONS = ['## Direction A', 'Saved cards. What changes in the product: a card picker in Payment.', '## Direction B', 'A wallet button.', '## Recommendation', 'A, as a suggestion.'];
const block = (lines) => ['```markdown', ...lines, '```', 'In d2s (the Figma plugin or the website), choose **Paste from AI** and paste it.'].join('\n');
const EXP = 'design/explorations/001-checkout/';
const settings = (fake) => ({ 'd2s-settings': { repo: fake.repo, branch: 'main', token: fake.token, api: 'https://fake' } });

test('plugin: a pasted discovery session passes Frame and Research and is saved as one commit', async () => {
  const fake = seededGitHub();
  const ui = await openPanel(fake, settings(fake));

  // A single-stage document behaves as before: it fills the fields and waits for Save.
  ui.paste(block(['## Problem', 'Typing the card again.']));
  assert.match(ui.text(), /Filled from the AI document: Problem\./);
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(fake.log.length, 1, 'nothing is committed until Save');

  ui.paste(block(['# Frame', ...FRAME, '# Research', ...RESEARCH, '# Options', ...OPTIONS, '# Decide', '## Approved by', '- Claude, design, 2026-11-20']));
  await ui.until(() => fake.log.length === 2 && /Saved to project/.test(ui.text()), 'the commit');
  assert.equal(fake.log[1], '001-checkout: Frame, Research and Options drafted by Dana Levi via d2s plugin');
  assert.match(ui.text(), /Passed the gate: Frame and Research\. Options is filled from your document and stays open/);
  assert.match(ui.text(), /A pasted session stops before Decide, so these parts were not used: Decide\./);
  const files = fake.files();
  assert.match(files[EXP + 'brief.md'], /^stage: options$/m, 'Options stays open');
  assert.match(files[EXP + 'brief.md'], /## Where it lives today\n<!--[^\n]*-->\nThe Payment screen\./);
  assert.match(files[EXP + 'insights.md'], /Typing the card is where they give up/);
  assert.match(files[EXP + 'options.md'], /Saved cards\. What changes in the product/);
  assert.equal(files[EXP + 'decision.md'], undefined, 'nothing in Decide is touched');
});

test('plugin: when Research has no evidence, the paste stops there and keeps Options for later', async () => {
  const fake = seededGitHub();
  const storage = settings(fake);
  let ui = await openPanel(fake, storage);
  ui.paste(block(['# Frame', ...FRAME, '# Research', '## Sources', 'None shared yet.', '## Key insights', '', '## Opportunities', '', '# Options', ...OPTIONS]));
  await ui.until(() => fake.log.length === 2 && /Saved to project/.test(ui.text()), 'the commit');
  assert.equal(fake.log[1], '001-checkout: Frame and Research drafted by Dana Levi via d2s plugin');
  assert.match(ui.text(), /Passed the gate: Frame\. The gate stopped at Research\./);
  assert.match(ui.text(), /Key insights is still empty/, 'the gaps show as today');
  assert.match(ui.text(), /From your pasted document: Options is waiting until Research passes the gate\./);
  assert.match(fake.files()[EXP + 'brief.md'], /^stage: research$/m);
  assert.deepEqual(storage['d2s-pending']['acme/app#main#001-checkout'].map((p) => p.stage), ['options'], 'kept on this computer, not lost');

  // Closing the panel loses nothing.
  ui = await openPanel(fake, storage);
  await ui.until(() => /Options is waiting until Research passes/.test(ui.text()), 'the kept part');

  // Once Research passes, the Options part is offered again.
  ui.type('key insights', '1. **Typing the card is where they give up.** 3 of 5. Confidence: medium.');
  ui.type('opportunities', 'How might we skip typing?');
  ui.button('Next stage').click();
  await ui.until(() => fake.log.length === 3 && /Ready from your pasted document: Options\./.test(ui.text()), 'the offer');
  assert.equal(fake.log[2], '001-checkout: research → options by Dana Levi via d2s plugin');
  ui.button('Fill Options').click();
  await ui.until(() => fake.log.length === 4 && /Saved to project/.test(ui.text()), 'the second commit');
  assert.equal(fake.log[3], '001-checkout: Options drafted by Dana Levi via d2s plugin');
  assert.match(fake.files()[EXP + 'options.md'], /Saved cards\./);
  assert.match(fake.files()[EXP + 'brief.md'], /^stage: options$/m, 'Options is never passed automatically');
  assert.equal(storage['d2s-pending']['acme/app#main#001-checkout'], undefined, 'nothing is left waiting');
  assert.doesNotMatch(ui.text(), /From your pasted document/);
});

test('plugin: pasting Research again once there is evidence brings the kept Options along', async () => {
  const fake = seededGitHub();
  const storage = settings(fake);
  const ui = await openPanel(fake, storage);
  ui.paste(block(['# Frame', ...FRAME, '# Research', '## Sources', 'None shared yet.', '## Key insights', '', '## Opportunities', '', '# Options', ...OPTIONS]));
  await ui.until(() => fake.log.length === 2 && /Saved to project/.test(ui.text()), 'the first commit');
  ui.paste(block(['# Research', ...RESEARCH]));
  await ui.until(() => fake.log.length === 3 && /Saved to project/.test(ui.text()), 'the second commit');
  assert.equal(fake.log[2], '001-checkout: Research and Options drafted by Dana Levi via d2s plugin');
  assert.match(fake.files()[EXP + 'options.md'], /Saved cards\./, 'the Options part from the first paste was not lost');
  assert.equal(storage['d2s-pending']['acme/app#main#001-checkout'], undefined);
});

test('plugin: a Hebrew discovery session fills the Hebrew stages and commits in Hebrew', async () => {
  const fake = seededGitHub('he');
  const ui = await openPanel(fake, settings(fake));
  const doc = ['# מסגור', '## הבעיה', 'לקוחות חוזרים מקלידים כרטיס בכל הזמנה.', '## למי זה חשוב', 'לקוחות חוזרים במובייל.',
    '## איפה זה חי היום', 'מסך התשלום.', '## מה רוצים שיקרה', 'יותר תשלומים שמושלמים.', '## מסגרת זמן', 'שבועיים.', '## מה לא עושים', 'לא מחליפים ספק סליקה.',
    '# חקר', '## מקורות', '5 ראיונות.', '## תובנות מרכזיות', '1. **ההקלדה היא הרגע שבו מוותרים.** 3 מתוך 5. ביטחון: בינוני.', '## הזדמנויות', 'איך נוכל לחסוך את ההקלדה?',
    '# כיוונים', "## כיוון א'", 'כרטיס שמור.', '## כיוון ב׳', 'כפתור ארנק.', '## המלצה', 'כיוון א׳, כהצעה לצוות.'];
  ui.paste(['```markdown', ...doc, '```', 'ב-d2s (בתוסף ב-Figma או באתר) בוחרים **הדבקה מ-AI** ומדביקים.'].join('\n'), { open: 'הדבקה מ-AI', apply: 'למלא את השדות' });
  await ui.until(() => fake.log.length === 2 && /נשמר בפרויקט/.test(ui.text()), 'the commit');
  assert.equal(fake.log[1], '001-checkout: מסגור, חקר וכיוונים נוסחו על ידי Dana Levi דרך התוסף של d2s');
  assert.match(ui.text(), /עברו את השער: מסגור וחקר\. הכיוונים מולאו מהמסמך/);
  assert.match(fake.files()[EXP + 'options.md'], /## כיוון א׳\n<!--[^\n]*-->\nכרטיס שמור\./);
});
