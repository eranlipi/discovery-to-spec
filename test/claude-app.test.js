'use strict';

// The d2s-discovery skill for the Claude apps: its package and its contract
// with the templates (Claude's documents must paste straight into the forms).

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const lib = require('../src/lib.js');
const Form = require('../site/src/stage-form.js');

const ROOT = path.resolve(__dirname, '..');
const STAGES = ['brief', 'insights', 'options', 'decision', 'spec'];

function build() {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'd2s-skill-'));
  const r = spawnSync(process.execPath, [path.join(ROOT, 'integrations', 'claude-app', 'build.mjs'), out], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr || r.stdout);
  return out;
}

test('claude app: the skill packages as the apps expect', () => {
  const out = build();
  const dir = path.join(out, 'd2s-discovery');
  const skill = fs.readFileSync(path.join(dir, 'SKILL.md'), 'utf8');
  const fm = lib.parseFrontMatter(skill).data;
  assert.equal(fm.name, 'd2s-discovery', 'the folder name matches the skill name');
  assert.match(fm.name, /^[a-z0-9-]{1,64}$/);
  assert.doesNotMatch(fm.name, /claude|anthropic/, 'reserved words are not allowed in a skill name');
  assert.ok(fm.description.length > 0 && fm.description.length <= 1024, `description is ${fm.description.length} characters`);
  assert.ok(skill.split('\n').length < 500, 'SKILL.md stays under 500 lines');

  for (const lang of ['en', 'he']) {
    for (const stage of STAGES) {
      const asset = fs.readFileSync(path.join(dir, 'assets', lang, `${stage}.md`), 'utf8');
      assert.doesNotMatch(asset, /\{\{\w+\}\}|^---/m, `${lang}/${stage}: no placeholders or front matter`);
      assert.match(skill, new RegExp('`assets/' + lang + '/' + stage + '\\.md`'), `SKILL.md points to ${lang}/${stage}`);
    }
  }
  const plain = fs.readFileSync(path.join(out, 'assistant-instructions.md'), 'utf8');
  assert.doesNotMatch(plain, /assets\/|^---/m, 'the plain instructions stand alone, for any chat assistant');
  assert.match(plain, /Never invent research/);
  assert.match(plain, /Paste from AI/);
  assert.ok(plain.length <= 8000, `the instructions stay under 8,000 characters (${plain.length})`);
});

test('claude app: every template heading is in the skill, so its documents fill the forms', () => {
  const skill = fs.readFileSync(path.join(ROOT, 'integrations', 'claude-app', 'd2s-discovery', 'SKILL.md'), 'utf8');
  for (const lang of ['en', 'he']) {
    for (const stage of STAGES) {
      for (const s of lib.parseSections(lib.packagedTemplate(lang, stage))) {
        assert.ok(skill.includes('`## ' + s.heading + '`'), `SKILL.md lists "## ${s.heading}" (${lang}/${stage})`);
      }
    }
  }
});

test('claude app: a document written in Claude pastes into the stage form', () => {
  const tpl = lib.packagedTemplate('he', 'decision');
  const doc = lib.render(tpl, { title: 'שמירת כרטיס' });
  const pasted = [
    '```markdown',
    "## הכיוון שנבחר",
    'כרטיס שמור עם שקיפות (כיוון א\').',
    '',
    '## למה',
    'עונה על התובנה "אמון לפני נוחות".',
    '',
    '## מה נדחה ולמה',
    '',
    '## מי אישר',
    '- Claude, עיצוב, 2026-11-20',
    '',
    '## הערות נוספות',
    'לא שייך לתבנית.',
    '```',
  ].join('\n');
  const approvals = Form.keyOf(lib.KEY_SECTIONS.he.approvedBy);
  const r = Form.applyDocument(doc, tpl, pasted, { skip: [approvals] });
  assert.deepEqual(r.filled, ['הכיוון שנבחר', 'למה'], 'filled by heading; an empty section changes nothing');
  assert.deepEqual(r.skipped, ['מי אישר'], 'a pasted document never fills "Approved by"');
  assert.deepEqual(r.ignored, ['הערות נוספות']);
  const fields = Form.model(r.text, tpl).fields;
  assert.equal(fields[0].value, "כרטיס שמור עם שקיפות (כיוון א').");
  assert.equal(fields.find((f) => f.key === approvals).value, '');
  assert.match(r.text, /## הכיוון שנבחר\n<!-- [^\n]*-->\nכרטיס שמור/, 'the guidance note stays');

  const options = lib.packagedTemplate('he', 'options');
  const o = Form.applyDocument(lib.render(options, { title: 'x' }), options, "## כיוון א'\nכרטיס שמור.\n\n## כיוון ב׳\nארנק.");
  assert.deepEqual(o.filled, ['כיוון א׳', 'כיוון ב׳'], 'an apostrophe matches the Hebrew geresh');
  assert.deepEqual(Form.applyDocument(doc, tpl, 'just text, no headings').filled, []);

  // A whole chat reply, pasted as is: the text around the block and the paste line stay out.
  const reply = 'זה שלב 4, החלטה. הנה המסמך:\n\n```markdown\n## למה\nעונה על התובנה.\n```\n\nבתוסף של d2s ב-Figma: פותחים את השלב, בוחרים **הדבקה מ-Claude** ומדביקים.';
  const whole = Form.applyDocument(doc, tpl, reply);
  assert.deepEqual(whole.filled, ['למה']);
  assert.equal(Form.model(whole.text, tpl).fields.find((f) => f.label === 'למה').value, 'עונה על התובנה.');
  // Without a code block, the paste line still doesn't land in the last field, old wording or new.
  for (const line of ['In the d2s plugin in Figma, open this stage, choose **Paste from Claude** and paste it.', 'ב-d2s (בתוסף ב-Figma או באתר): פותחים את השלב, בוחרים **הדבקה מ-AI** ומדביקים.']) {
    const bare = Form.applyDocument(doc, tpl, '## למה\nעונה על התובנה.\n\n' + line);
    assert.equal(Form.model(bare.text, tpl).fields.find((f) => f.label === 'למה').value, 'עונה על התובנה.');
  }
});
