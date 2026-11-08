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
