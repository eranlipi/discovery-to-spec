'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const lib = require('../src/lib.js');

const PKG_ROOT = path.resolve(__dirname, '..');
const BIN = path.join(PKG_ROOT, 'bin', 'd2s.js');

function tmpRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'd2s-'));
}

function run(cwd, ...args) {
  return runBin(BIN, cwd, ...args);
}

function runBin(bin, cwd, ...args) {
  const r = spawnSync(process.execPath, [bin, ...args], { cwd, encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' } });
  return { code: r.status, out: r.stdout + r.stderr };
}

/** Put text under every `## ` heading of a document. `extra` overrides by heading. */
function fill(file, extra = {}) {
  let text = fs.readFileSync(file, 'utf8');
  text = text.replace(/^(## (.+))$/gm, (line, _h, heading) => {
    const key = heading.replace(/\((optional|אופציונלי)\)/, '').trim();
    return `${line}\n${key in extra ? extra[key] : 'Filled in by the test.'}`;
  });
  fs.writeFileSync(file, text);
}

const exp = (repo, id, file) => path.join(repo, 'design', 'explorations', id, file);
const read = (...p) => fs.readFileSync(path.join(...p), 'utf8');

test('init creates the design folder, skills, AGENTS.md and config', () => {
  const repo = tmpRepo();
  const r = run(repo, 'init');
  assert.equal(r.code, 0, r.out);
  for (const f of [
    '.d2s.json',
    'design/README.md',
    'design/context.md',
    'design/decisions.md',
    'design/templates/brief.md',
    '.claude/skills/d2s-frame/SKILL.md',
    '.cursor/commands/d2s-spec.md',
    'AGENTS.md',
  ]) {
    assert.ok(fs.existsSync(path.join(repo, f)), `${f} should exist`);
  }
  const config = JSON.parse(read(repo, '.d2s.json'));
  assert.deepEqual(config, { version: 1, lang: 'en', dir: 'design', cli: 'npx github:eranlipi/discovery-to-spec' });
  const skill = read(repo, '.claude/skills/d2s-frame/SKILL.md');
  assert.match(skill, /^---\nname: d2s-frame/);
  assert.doesNotMatch(skill, /\{\{\w+\}\}/, 'placeholders are rendered');
  assert.doesNotMatch(read(repo, '.cursor/commands/d2s-frame.md'), /^---/, 'cursor commands have no front matter');
  assert.ok(!fs.existsSync(path.join(repo, '.github')), 'no CI unless --ci');
});

test('init defaults to "npx d2s" when the package is installed in the project', () => {
  const repo = tmpRepo();
  const installed = path.join(repo, 'node_modules', 'discovery-to-spec');
  fs.mkdirSync(installed, { recursive: true });
  for (const entry of ['bin', 'src', 'templates', 'integrations', 'package.json']) {
    fs.cpSync(path.join(PKG_ROOT, entry), path.join(installed, entry), { recursive: true });
  }
  const r = runBin(path.join(installed, 'bin', 'd2s.js'), repo, 'init', '--ci');
  assert.equal(r.code, 0, r.out);
  assert.equal(JSON.parse(read(repo, '.d2s.json')).cli, 'npx d2s');
  const ci = read(repo, '.github/workflows/d2s-check.yml');
  assert.match(ci, /- run: npm ci\n\s+- run: npx d2s check/, 'CI installs dependencies before running the local CLI');
});

test('the CI workflow runs straight from GitHub when the tool is not installed locally', () => {
  const repo = tmpRepo();
  assert.equal(run(repo, 'init', '--ci').code, 0);
  const ci = read(repo, '.github/workflows/d2s-check.yml');
  assert.doesNotMatch(ci, /npm ci/);
  assert.match(ci, /- run: npx github:eranlipi\/discovery-to-spec check/);
  assert.match(ci, /- "design\/\*\*"/);
});

test('init refuses to run twice; --force refreshes without duplicating the AGENTS.md block', () => {
  const repo = tmpRepo();
  fs.writeFileSync(path.join(repo, 'AGENTS.md'), '# Team rules\n\nUse tabs.\n');
  assert.equal(run(repo, 'init').code, 0);
  assert.equal(run(repo, 'init').code, 1);
  assert.equal(run(repo, 'init', '--force').code, 0);
  const agents = read(repo, 'AGENTS.md');
  assert.match(agents, /Use tabs\./, 'existing content is kept');
  assert.equal(agents.match(/<!-- d2s:start -->/g).length, 1);
});

test('init options are validated', () => {
  const repo = tmpRepo();
  assert.equal(run(repo, 'init', '--lang', 'fr').code, 1);
  assert.equal(run(repo, 'init', '--agents', 'copilot').code, 1);
  assert.equal(run(repo, 'init', '--agents', 'none', '--dir', 'product', '--cli', 'npx d2s').code, 0);
  assert.ok(fs.existsSync(path.join(repo, 'product/README.md')));
  assert.ok(!fs.existsSync(path.join(repo, '.claude')));
  assert.ok(!fs.existsSync(path.join(repo, 'AGENTS.md')));
  assert.equal(JSON.parse(read(repo, '.d2s.json')).cli, 'npx d2s');
});

test('commands outside an initialized repo explain what to do', () => {
  const r = run(tmpRepo(), 'status');
  assert.equal(r.code, 1);
  assert.match(r.out, /d2s init/);
});

test('new numbers explorations and resolves them by id, number or slug', () => {
  const repo = tmpRepo();
  run(repo, 'init');
  run(repo, 'new', 'Checkout drop-off', '--owner', 'Dana');
  const brief = read(exp(repo, '001-checkout-drop-off', 'brief.md'));
  assert.match(brief, /^title: Checkout drop-off$/m);
  assert.match(brief, /^owner: Dana$/m);
  assert.match(brief, /^stage: frame$/m);
  run(repo, 'new', 'Search results');
  assert.ok(fs.existsSync(exp(repo, '002-search-results', 'brief.md')));
  assert.equal(run(repo, 'status', '001-checkout-drop-off').code, 0, 'by id');
  assert.equal(run(repo, 'status', '2').code, 0, 'by number');
  assert.equal(run(repo, 'status', 'search-results').code, 0, 'by slug');
  assert.equal(run(repo, 'status', '9').code, 1);
});

test('full flow: the gate blocks incomplete stages and the handoff collects the approved spec', () => {
  const repo = tmpRepo();
  fs.mkdirSync(path.join(repo, 'openspec'));
  run(repo, 'init');
  run(repo, 'new', 'Mobile checkout drop-off', '--slug', 'checkout');
  const id = '001-checkout';

  let r = run(repo, 'next', id);
  assert.equal(r.code, 1, 'an empty brief cannot pass');
  assert.match(r.out, /section "Problem" is empty/);

  fill(exp(repo, id, 'brief.md'), { Problem: 'Mobile users abandon checkout.', 'Open questions': 'Does it happen on desktop too?' });
  assert.equal(run(repo, 'next', id).code, 0);
  assert.ok(fs.existsSync(exp(repo, id, 'insights.md')));

  fill(exp(repo, id, 'insights.md'));
  assert.equal(run(repo, 'next', id).code, 0);

  // Options without Figma links pass, with a warning.
  fill(exp(repo, id, 'options.md'));
  r = run(repo, 'check', id);
  assert.equal(r.code, 0);
  assert.match(r.out, /no Figma links/);
  fill(exp(repo, id, 'options.md'), {
    'Direction A': 'https://www.figma.com/design/abc/Checkout?node-id=1-2',
    'Direction B': 'Rejected: https://www.figma.com/design/abc/Checkout?node-id=9-9',
  });
  assert.equal(run(repo, 'next', id).code, 0);

  // The decision gate needs "Approved by".
  fill(exp(repo, id, 'decision.md'), {
    'Chosen direction': 'One-page checkout. https://www.figma.com/design/abc/Checkout?node-id=1-2',
    'Approved by': '',
  });
  r = run(repo, 'next', id);
  assert.equal(r.code, 1);
  assert.match(r.out, /section "Approved by" is empty/);
  const decision = exp(repo, id, 'decision.md');
  fs.writeFileSync(decision, read(decision).replace('## Approved by\n', '## Approved by\nDana (product), Yossi (design), Ron (engineering)\n'));
  assert.equal(run(repo, 'next', id).code, 0);
  const log = read(repo, 'design', 'decisions.md');
  assert.match(log, /\| \[Mobile checkout drop-off\]\(explorations\/001-checkout\/decision\.md\) \| One-page checkout\. \| Dana \(product\)/);
  assert.doesNotMatch(log, /figma\.com/, 'links are kept out of the log');

  fill(exp(repo, id, 'spec.md'), { 'Acceptance criteria': 'Given a full cart, When the user taps "Pay", Then one page opens.' });
  r = run(repo, 'next', id);
  assert.equal(r.code, 0, r.out);

  const handoff = read(exp(repo, id, 'handoff.md'));
  assert.match(handoff, /One-page checkout\./);
  assert.match(handoff, /- https:\/\/www\.figma\.com\/design\/abc\/Checkout\?node-id=1-2/);
  assert.doesNotMatch(handoff, /node-id=9-9/, 'rejected directions stay out of the handoff');
  assert.match(handoff, /Given a full cart/);
  assert.match(handoff, /Does it happen on desktop too\?/);
  assert.doesNotMatch(handoff, /\{\{\w+\}\}/);

  const proposal = read(repo, 'openspec', 'changes', 'checkout', 'proposal.md');
  assert.match(proposal, /## Why\n\nMobile users abandon checkout\./);
  assert.match(proposal, /\(\.\.\/\.\.\/\.\.\/design\/explorations\/001-checkout\/spec\.md\)/);

  assert.equal(run(repo, 'check').code, 0);
  assert.equal(run(repo, 'handoff', id).code, 0, 'the handoff can be regenerated');
  assert.match(run(repo, 'status', id).out, /ready for development/);

  assert.equal(run(repo, 'archive', id).code, 0);
  assert.ok(fs.existsSync(path.join(repo, 'design', 'explorations', 'archive', id, 'handoff.md')));
  assert.match(run(repo, 'status', '--all').out, /archived/);
  run(repo, 'new', 'Next one');
  assert.ok(fs.existsSync(exp(repo, '002-next-one', 'brief.md')), 'numbering continues after archive');
});

test('Hebrew locale: right-to-left templates go through the same gate', () => {
  const repo = tmpRepo();
  assert.equal(run(repo, 'init', '--lang', 'he').code, 0);
  assert.match(read(repo, 'design', 'templates', 'brief.md'), /^## הבעיה$/m);

  const r = run(repo, 'new', 'נטישה בתשלום');
  assert.equal(r.code, 0);
  assert.match(r.out, /--slug/, 'a title without latin letters suggests --slug');
  const id = '001-exploration';
  assert.equal(run(repo, 'next', id).code, 1);

  for (const file of ['brief.md', 'insights.md', 'options.md']) {
    fill(exp(repo, id, file));
    assert.equal(run(repo, 'next', id).code, 0, file);
  }
  fill(exp(repo, id, 'decision.md'), { 'הכיוון שנבחר': 'תשלום בעמוד אחד.', 'מי אישר': '' });
  const blocked = run(repo, 'next', id);
  assert.equal(blocked.code, 1);
  assert.match(blocked.out, /מי אישר/);
  fill(exp(repo, id, 'decision.md'), { 'הכיוון שנבחר': 'תשלום בעמוד אחד.', 'מי אישר': 'דנה (מוצר)' });
  assert.equal(run(repo, 'next', id).code, 0);
  assert.match(read(repo, 'design', 'decisions.md'), /תשלום בעמוד אחד\. \| דנה \(מוצר\)/);
});

test('check fails when a stage that was already passed is emptied (for CI)', () => {
  const repo = tmpRepo();
  run(repo, 'init');
  run(repo, 'new', 'Search results');
  const id = '001-search-results';
  const brief = exp(repo, id, 'brief.md');
  fill(brief);
  assert.equal(run(repo, 'next', id).code, 0);
  fs.writeFileSync(brief, read(brief).replace(/## Problem\nFilled in by the test\./, '## Problem\n'));
  const r = run(repo, 'check');
  assert.equal(r.code, 1);
  assert.match(r.out, /section "Problem" is empty/);
  assert.equal(run(repo, 'check', '--strict').code, 1);
});

test('archive refuses unfinished work unless forced', () => {
  const repo = tmpRepo();
  run(repo, 'init');
  run(repo, 'new', 'Onboarding');
  assert.equal(run(repo, 'archive', '1').code, 1);
  assert.equal(run(repo, 'archive', '1', '--force').code, 0);
});

test("a team's own templates override the packaged ones", () => {
  const repo = tmpRepo();
  run(repo, 'init');
  fs.writeFileSync(
    path.join(repo, 'design', 'templates', 'brief.md'),
    '---\ntitle: {{title}}\nstage: frame\n---\n\n# {{title}}\n\n## Job story\n',
  );
  run(repo, 'new', 'Custom');
  const r = run(repo, 'next', '1');
  assert.equal(r.code, 1);
  assert.match(r.out, /section "Job story" is empty/);
});

test('lib: sections ignore comments and code fences; front matter updates in place', () => {
  const body = '## A\n<!-- guidance -->\n\n## B (optional)\n```\n## not a heading\n```\n## C\ntext\n';
  const sections = lib.parseSections(body);
  assert.deepEqual(sections.map((s) => s.heading), ['A', 'B (optional)', 'C']);
  assert.equal(sections[0].content, '');
  assert.equal(sections[1].optional, true);
  assert.equal(sections[2].content, 'text');

  const text = '---\ntitle: X\nstage: frame\n---\n\nBody $1\n';
  const updated = lib.setFrontMatterField(text, 'stage', 'spec');
  assert.equal(lib.parseFrontMatter(updated).data.stage, 'spec');
  assert.match(updated, /Body \$1/);
  assert.equal(lib.parseFrontMatter(lib.setFrontMatterField(text, 'owner', 'a:b')).data.owner, 'a:b');

  assert.equal(lib.slugify('Checkout — Mobile Drop-off!'), 'checkout-mobile-drop-off');
  assert.equal(lib.slugify('נטישה'), '');
  assert.deepEqual(lib.figmaLinks('see https://figma.com/file/x) and <!-- https://figma.com/hidden -->'), ['https://figma.com/file/x']);
});
