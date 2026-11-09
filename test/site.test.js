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

test('the site offers the d2s assistant for Claude, ChatGPT and Gemini', () => {
  const html = fs.readFileSync(path.join(buildSite(), 'index.html'), 'utf8');
  const version = require('../package.json').version;
  assert.match(html, /<section id="assistant"/);
  for (const tab of ['panel-claude', 'panel-chatgpt', 'panel-gemini']) assert.match(html, new RegExp(`id="${tab}"`));
  assert.doesNotMatch(html, /\{\{version\}\}/, 'the version is filled in, in English and in Hebrew');
  assert.match(html, new RegExp(`releases/download/v${version.replace(/\./g, '\\.')}/d2s-discovery-skill-v${version.replace(/\./g, '\\.')}\.zip`));
  const m = html.match(/window\.D2S_ASSISTANT = (\{.*?\});<\/script>/);
  assert.ok(m, 'the instructions and notes are embedded for the copy buttons');
  const assistant = JSON.parse(m[1]);
  assert.match(assistant.instructions, /Never invent research/);
  assert.ok(assistant.instructions.length <= 8000);
  assert.match(assistant.notes.en, /Interview 1/);
  assert.match(assistant.notes.he, /ראיון 1/);
  assert.ok((html.match(/data-copy-key="instructions"/g) || []).length === 3, 'one copy button per tool');
  assert.ok(assistant.description.length > 0 && assistant.description.length <= 1024, 'the description fits a Gemini skill');
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
  assert.deepEqual(m.fields.map((f) => f.label), ['Problem', 'Who it matters to', 'Where it lives today', 'Desired outcome', 'Appetite', 'No-gos', 'Open questions']);
  assert.equal(m.fields[2].optional, false, 'where it lives today is required');
  assert.match(m.fields[2].helper, /New area, nothing exists yet/, 'a brand-new area is told what counts');
  assert.equal(m.fields[6].optional, true, '"(optional)" becomes a badge');
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

  const figma = Form.markdown('- Cart: https://www.figma.com/design/AbC/Checkout?node-id=10-2&t=x');
  assert.match(figma, /<a href="https:\/\/www\.figma\.com\/design\/AbC\/Checkout\?node-id=10-2&amp;t=x"[^>]*>Figma · 10-2 ↗<\/a>/, 'Figma frame links read short');
  assert.match(Form.markdown('See https://example.com/a'), />https:\/\/example\.com\/a<\/a>/, 'other links stay as they are');
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

// ---------- Paste from AI: a discovery session's document ----------

/** A fresh in-memory d2s from the built page, with one exploration at Frame. */
function sandboxProject(html, lang = 'en') {
  const m = html.match(/<script id="d2s-sandbox">([\s\S]*?)<\/script>/);
  const context = { window: {} };
  vm.runInNewContext(m[1], context);
  const d2s = context.window.D2S_NEW();
  assert.equal(d2s.run(['init', '--lang', lang, '--cli', 'd2s', '--agents', 'none']).code, 0);
  assert.equal(d2s.run(['new', lang === 'he' ? 'שמירת כרטיס' : 'Saved cards', '--slug', 'cards']).code, 0);
  return d2s;
}

const EN_FRAME = [
  '## Problem', 'Returning customers type their card again on every order.',
  '## Who it matters to', 'Returning customers who order on their phone.',
  '## Where it lives today', 'The Payment screen in checkout. Figma: to be added by design.',
  '## Desired outcome', 'More returning customers finish paying on mobile.',
  '## Appetite', 'Two weeks of a small team.',
  '## No-gos', 'No new payment provider.',
].join('\n');
const EN_RESEARCH = [
  '## Sources', '5 interviews with returning customers.',
  '## Key insights', '1. **Typing the card is where they give up.** 3 of 5 participants. Confidence: medium.',
  '## Opportunities', 'How might we let returning customers pay without typing?',
].join('\n');
const EN_OPTIONS = [
  '## Direction A', 'Saved cards. What changes in the product: a card picker in Payment. Figma: to be added by design.',
  '## Direction B', 'A wallet button. What changes in the product: a new button above the form. Figma: to be added by design.',
  '## Recommendation', 'Direction A, as a suggestion for the team.',
].join('\n');
const session = (parts) => ['Here is the whole session.', '', '```markdown', ...parts, '```', '', 'In d2s (the Figma plugin or the website), choose **Paste from AI** and paste it.'].join('\n');

test('Paste from AI tells a discovery session from a single-stage document, in English and Hebrew', () => {
  const Form = require('../site/src/stage-form.js');
  const parts = Form.splitStages(session(['# Frame', EN_FRAME, '', '# Research', EN_RESEARCH, '', '# Options', EN_OPTIONS]));
  assert.deepEqual(parts.map((p) => p.stage), ['frame', 'research', 'options']);
  assert.match(parts[0].text, /^## Problem\nReturning customers/);
  assert.doesNotMatch(parts[2].text, /Paste from AI/, 'the closing line stays out');

  const he = Form.splitStages('# מסגור\n## הבעיה\nא\n\n# חקר\n## מקורות\nב\n\n# כיוונים\n## כיוון א׳\nג');
  assert.deepEqual(he.map((p) => p.stage), ['frame', 'research', 'options']);
  assert.deepEqual(
    Form.splitStages('# 1. Frame\n## Problem\nx\n# Stage 2 · Research\n## Sources\ny\n# **Options:**\n## Direction A\nz').map((p) => p.stage),
    ['frame', 'research', 'options'],
    'numbered and bold stage headings',
  );
  assert.equal(Form.splitStages('## Problem\nNo stage headings here.'), null, 'a single-stage document is pasted as before');
  assert.equal(Form.splitStages('# Checkout drop-off: brief\n## Problem\nx'), null, 'a title is not a stage');
  assert.equal(Form.splitStages('```\n# Frame\n```\n## Problem\nx'), null, 'headings inside code blocks do not count');
});

test('Paste from AI fills a discovery session stage by stage through the real gate, up to Options', () => {
  const Form = require('../site/src/stage-form.js');
  const html = fs.readFileSync(path.join(buildSite(), 'index.html'), 'utf8');
  const dir = 'design/explorations/001-cards/';
  const decide = ['# Decide', '## Chosen direction', 'A', '## Approved by', '- Dana Levi, design, 2026-11-20'];

  // Given an exploration at Frame and a complete combined document,
  let d2s = sandboxProject(html);
  let r = Form.applySession(d2s, '001-cards', Form.splitStages(session(['# Frame', EN_FRAME, '# Research', EN_RESEARCH, '# Options', EN_OPTIONS, ...decide])));
  // then Frame and Research pass, Options is filled and stays open, and nothing in Decide is touched.
  assert.deepEqual(r.steps.map((s) => [s.stage, s.passed]), [['frame', true], ['research', true], ['options', false]]);
  assert.equal(r.to, 'options');
  assert.equal(r.stopped, null);
  assert.deepEqual(r.pending, []);
  assert.deepEqual(JSON.parse(JSON.stringify(r.unused)), [{ stage: 'decide', why: 'team' }]);
  assert.match(d2s.read(dir + 'brief.md'), /^stage: options$/m);
  assert.match(d2s.read(dir + 'brief.md'), /## Where it lives today\n<!--[^\n]*-->\nThe Payment screen in checkout\./);
  assert.match(d2s.read(dir + 'insights.md'), /Typing the card is where they give up/);
  assert.match(d2s.read(dir + 'options.md'), /## Direction B\n<!--[^\n]*-->\nA wallet button\./);
  assert.ok(!d2s.exists(dir + 'decision.md'), 'Decide is never filled or passed');

  // Given a combined document with an empty Research part,
  d2s = sandboxProject(html);
  const empty = ['# Research', '## Sources', 'None shared yet: no interviews, tickets or data.', '## Key insights', '', '## Opportunities', ''];
  r = Form.applySession(d2s, '001-cards', Form.splitStages(session(['# Frame', EN_FRAME, ...empty, '# Options', EN_OPTIONS])));
  // then Frame passes, Research shows its gaps, and the Options part is kept.
  assert.deepEqual(r.steps.map((s) => [s.stage, s.passed]), [['frame', true], ['research', false]]);
  assert.equal(r.stopped, 'research');
  const ctx = d2s.lib.loadContext(d2s.cwd);
  const exp = d2s.lib.listExplorations(ctx)[0];
  const gaps = Array.from(d2s.lib.checkStageDoc(ctx, exp, d2s.lib.STAGES[1]).issues, (i) => i.section); // a copy: the sandbox is another realm
  assert.deepEqual(gaps, ['Key insights', 'Opportunities'], 'the gaps are the ones the form shows next to its fields');
  assert.match(r.gate.join('\n'), /section "Key insights" is empty/);
  assert.deepEqual(r.pending.map((p) => p.stage), ['options']);
  assert.ok(!d2s.exists(dir + 'options.md'));
  // Once Research passes, the kept Options part is offered again and fills Options.
  d2s.write(dir + 'insights.md', Form.applyDocument(d2s.read(dir + 'insights.md'), d2s.lib.getTemplate(ctx, 'insights'), EN_RESEARCH).text);
  assert.equal(d2s.run(['next', '1']).code, 0);
  r = Form.applySession(d2s, '001-cards', r.pending);
  assert.deepEqual(r.steps.map((s) => [s.stage, s.passed]), [['options', false]]);
  assert.match(d2s.read(dir + 'options.md'), /Saved cards\./);
  assert.match(d2s.read(dir + 'brief.md'), /^stage: options$/m, 'Options is never passed automatically');

  // A part for a stage that already passed is not used, and one for the current stage starts it.
  r = Form.applySession(d2s, '001-cards', Form.splitStages(session(['# Frame', EN_FRAME, '# Options', EN_OPTIONS])));
  assert.deepEqual(JSON.parse(JSON.stringify(r.unused)), [{ stage: 'frame', why: 'passed' }]);
  assert.deepEqual(r.steps.map((s) => s.stage), ['options']);

  // Nothing for the stage it is at: nothing is filled, and the rest waits.
  d2s = sandboxProject(html);
  r = Form.applySession(d2s, '001-cards', Form.splitStages(session(['# Research', EN_RESEARCH, '# Options', EN_OPTIONS])));
  assert.deepEqual(r.steps, []);
  assert.deepEqual(r.pending.map((p) => p.stage), ['research', 'options']);
  assert.match(d2s.read(dir + 'brief.md'), /^stage: frame$/m);
});

test('a Hebrew discovery session goes through the same gates with the Hebrew headings', () => {
  const Form = require('../site/src/stage-form.js');
  const html = fs.readFileSync(path.join(buildSite(), 'index.html'), 'utf8');
  const d2s = sandboxProject(html, 'he');
  const frame = ['# מסגור', '## הבעיה', 'לקוחות חוזרים מקלידים כרטיס בכל הזמנה.', '## למי זה חשוב', 'לקוחות חוזרים במובייל.',
    '## איפה זה חי היום', 'מסך התשלום. Figma: יתווסף על ידי עיצוב.', '## מה רוצים שיקרה', 'יותר תשלומים שמושלמים.',
    '## מסגרת זמן', 'שבועיים.', '## מה לא עושים', 'לא מחליפים ספק סליקה.'];
  const research = ['# חקר', '## מקורות', '5 ראיונות.', '## תובנות מרכזיות', '', '## הזדמנויות', ''];
  const options = ['# כיוונים', "## כיוון א'", 'כרטיס שמור. מה משתנה במוצר: בוחר כרטיסים במסך התשלום.', '## כיוון ב׳', 'כפתור ארנק.', '## המלצה', 'כיוון א׳.'];
  const r = Form.applySession(d2s, '001-cards', Form.splitStages(['```markdown', ...frame, ...research, ...options, '```', 'ב-d2s (בתוסף ב-Figma או באתר) בוחרים **הדבקה מ-AI** ומדביקים.'].join('\n')));
  assert.deepEqual(r.steps.map((s) => [s.stage, s.passed]), [['frame', true], ['research', false]]);
  assert.deepEqual(r.steps[0].filled, ['הבעיה', 'למי זה חשוב', 'איפה זה חי היום', 'מה רוצים שיקרה', 'מסגרת זמן', 'מה לא עושים']);
  assert.match(r.gate.join('\n'), /section "תובנות מרכזיות" is empty/);
  assert.deepEqual(r.pending.map((p) => p.stage), ['options']);
  assert.match(r.pending[0].text, /כרטיס שמור/);
});
