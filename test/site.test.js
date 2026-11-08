'use strict';

// The website's sandbox runs the real CLI in the browser. These tests build the
// site and run that bundle in a plain JS context, so a broken build fails CI.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');

function buildSite() {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'd2s-site-'));
  const r = spawnSync(process.execPath, [path.join(ROOT, 'site', 'build.mjs'), out], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr || r.stdout);
  return out;
}

function loadSandbox(html) {
  const m = html.match(/<script id="d2s-sandbox">([\s\S]*?)<\/script>/);
  assert.ok(m, 'the sandbox script is inlined');
  const context = { window: {} };
  vm.runInNewContext(m[1], context);
  return context.window.D2S;
}

test('the site builds into one self-contained page plus static files', () => {
  const out = buildSite();
  for (const f of ['index.html', '_headers', 'favicon.svg', 'robots.txt']) {
    assert.ok(fs.existsSync(path.join(out, f)), `${f} is in the build`);
  }
  const html = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
  assert.doesNotMatch(html, /\/\*@\w+\*\//, 'every slot is filled');
  assert.match(html, new RegExp(`discovery-to-spec v${require('../package.json').version}`));
});

test('the sandbox runs the real CLI in memory', () => {
  const html = fs.readFileSync(path.join(buildSite(), 'index.html'), 'utf8');
  const d2s = loadSandbox(html);
  assert.equal(d2s.version, require('../package.json').version);

  assert.equal(d2s.run(['init', '--cli', 'd2s']).code, 0);
  assert.ok(d2s.exists('design/templates/brief.md'));
  assert.ok(d2s.exists('.claude/skills/d2s-frame/SKILL.md'));

  assert.equal(d2s.run(['new', 'Checkout drop-off']).code, 0);
  const blocked = d2s.run(['next', '1']);
  assert.equal(blocked.code, 1, 'the gate works in the browser too');
  assert.match(blocked.lines.join('\n'), /section "Problem" is empty/);

  const brief = 'design/explorations/001-checkout-drop-off/brief.md';
  d2s.write(brief, d2s.read(brief).replace(/^(## .+)$/gm, '$1\nFilled.'));
  assert.equal(d2s.run(['next', '1']).code, 0);
  assert.ok(d2s.exists('design/explorations/001-checkout-drop-off/insights.md'));

  d2s.reset();
  assert.equal(d2s.files().length, 0, 'reset empties the workspace');
  assert.equal(d2s.run(['init', '--lang', 'he']).code, 0);
  assert.match(d2s.read('design/templates/brief.md'), /## הבעיה/);
});

test('the stage form reads and writes the same Markdown the CLI checks', () => {
  const Form = require('../site/src/stage-form.js');
  const lib = require('../src/lib.js');
  const template = lib.packagedTemplate('en', 'brief');
  let doc = lib.render(template, { id: '001-x', title: 'X', date: '2026-11-08', owner: 'Dana' });

  const m = Form.model(doc, template);
  assert.deepEqual(m.fields.map((f) => f.label), ['Problem', 'Who it matters to', 'Desired outcome', 'Appetite', 'No-gos', 'Open questions']);
  assert.equal(m.fields[5].optional, true, '"(optional)" becomes a badge');
  assert.match(m.fields[0].helper, /^What isn't working today/, 'the template note is the helper text');
  assert.match(m.intro, /^Stage 1 of 6: frame/);

  doc = Form.setField(doc, 'problem', 'Users abandon checkout.\n## Not a new section');
  assert.match(doc, /## Problem\n<!-- What isn't working[^\n]*-->\nUsers abandon checkout\.\n### Not a new section\n\n## Who it matters to/);
  assert.equal(Form.model(doc, template).fields[0].value, 'Users abandon checkout.\n### Not a new section');
  doc = Form.setField(doc, 'problem', '');
  assert.equal(Form.model(doc, template).fields[0].value, '', 'clearing a field keeps the note and the heading');
  assert.match(doc, /^stage: frame$/m, 'front matter is untouched');
});

test('the preview escapes HTML and only links http(s) URLs', () => {
  const Form = require('../site/src/stage-form.js');
  const html = Form.markdown('---\nid: x\n---\n\n## Title\n<script>alert(1)</script>\n\n- [ok](https://example.com/a?b=1&c=2)\n- [bad](javascript:alert(1))\n\n| A | B |\n| --- | --- |\n| `x` | **y** |\n');
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /<a href="https:\/\/example\.com\/a\?b=1&amp;c=2"/);
  assert.doesNotMatch(html, /href="javascript/);
  assert.match(html, /<h3>Title<\/h3>/);
  assert.match(html, /<td><code>x<\/code><\/td><td><strong>y<\/strong><\/td>/);
  assert.doesNotMatch(html, /id: x/, 'front matter is not shown');
});

test('each sandbox view gets its own project, and status fits the terminal', () => {
  const html = fs.readFileSync(path.join(buildSite(), 'index.html'), 'utf8');
  const m = html.match(/<script id="d2s-sandbox">([\s\S]*?)<\/script>/);
  const context = { window: {} };
  vm.runInNewContext(m[1], context);
  const designer = context.window.D2S_NEW();
  const developer = context.window.D2S;
  assert.equal(designer.run(['init', '--cli', 'd2s']).code, 0);
  assert.equal(developer.files().length, 0, 'the two views do not share files');

  designer.run(['new', 'A very long exploration title that would wrap the table', '--slug', 'long']);
  const wide = designer.run(['status']).lines.join('\n');
  const narrow = designer.run(['status'], { columns: 70 }).lines;
  assert.match(wide, /A very long exploration title that would wrap the table/);
  assert.match(narrow.join('\n'), / A very long explorat… /);
  assert.ok(narrow.every((l) => l.length <= 70), 'every line fits in 70 columns');

  assert.match(designer.run(['check', '--verify-approvals']).lines.join('\n'), /verification is off/, 'no network in the browser');
});
