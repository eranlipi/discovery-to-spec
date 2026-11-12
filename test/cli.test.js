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

/** Replace the text under one `## ` heading; the rest of the document stays. */
function setSection(file, heading, text) {
  const doc = fs.readFileSync(file, 'utf8');
  const re = new RegExp(`(^## ${heading}\\n)[\\s\\S]*?(?=^## |(?![\\s\\S]))`, 'm');
  assert.match(doc, re, `${heading} is in ${file}`);
  fs.writeFileSync(file, doc.replace(re, (_, h) => `${h}${text}\n\n`));
}

const exp = (repo, id, file) => path.join(repo, 'design', 'explorations', id, file);
const read = (...p) => fs.readFileSync(path.join(...p), 'utf8');

/**
 * A template as d2s 0.5.0 shipped it, rebuilt from today's: the brief without "Where it lives
 * today", the spec with "Existing components (optional)". Checked against the shipped fingerprints.
 */
function template05(lang, name) {
  const now = lib.packagedTemplate(lang, name);
  const old = {
    brief: () => now.replace(/^## (Where it lives today|איפה זה חי היום)\n<!--[^\n]*-->\n\n/m, ''),
    spec: () =>
      now
        .replace(/^## Existing components\n<!--[^\n]*-->/m, '## Existing components (optional)\n<!-- Which design system components are used, and what is new. -->')
        .replace(/^## רכיבים קיימים\n<!--[^\n]*-->/m, '## רכיבים קיימים (אופציונלי)\n<!-- אילו רכיבים מספריית העיצוב משתמשים בהם, ומה חדש. -->'),
    readme: () =>
      now
        .replace('who it matters to, where it lives in the product today, desired outcome', 'who it matters to, desired outcome')
        .replace('pros and cons, and what each changes in the product |', 'pros and cons |')
        .replace('edge cases, acceptance criteria and the components used |', 'edge cases and acceptance criteria |')
        .replace('design principles and design system. The AI assistant and agents read it for every feature.', 'design principles.'),
  }[name]();
  assert.notEqual(old, now);
  assert.ok(lib.isShipped(lang, name, old), `the rebuilt ${lang}/${name} is the one 0.5.0 shipped`);
  return old;
}

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
  assert.deepEqual(config, {
    version: 1,
    lang: 'en',
    dir: 'design',
    cli: 'npx discovery-to-spec',
    approvals: { roles: ['product', 'design', 'engineering'], allowSamePerson: false, verify: 'none' },
  });
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

test('CI installs with pnpm or yarn when the project has their lockfile', () => {
  for (const [lockfile, install] of [['pnpm-lock.yaml', 'pnpm install --frozen-lockfile'], ['yarn.lock', 'yarn install']]) {
    const repo = tmpRepo();
    fs.writeFileSync(path.join(repo, lockfile), '');
    const installed = path.join(repo, 'node_modules', 'discovery-to-spec');
    fs.mkdirSync(installed, { recursive: true });
    for (const entry of ['bin', 'src', 'templates', 'integrations', 'package.json']) {
      fs.cpSync(path.join(PKG_ROOT, entry), path.join(installed, entry), { recursive: true });
    }
    const r = runBin(path.join(installed, 'bin', 'd2s.js'), repo, 'init', '--ci');
    assert.equal(r.code, 0, r.out);
    const ci = read(repo, '.github/workflows/d2s-check.yml');
    assert.match(ci, new RegExp(`- run: corepack enable\\n\\s+- run: ${install}\\n\\s+- run: npx d2s check`), lockfile);
    assert.doesNotMatch(ci, /npm ci/, lockfile);
  }
});

test('the CI workflow runs straight from npm when the tool is not installed locally', () => {
  const repo = tmpRepo();
  assert.equal(run(repo, 'init', '--ci').code, 0);
  const ci = read(repo, '.github/workflows/d2s-check.yml');
  assert.doesNotMatch(ci, /npm ci/);
  assert.match(ci, /- run: npx discovery-to-spec check/);
  assert.match(ci, /- "design\/\*\*"/);
});

test('init refuses to run twice; --force refreshes without duplicating the AGENTS.md block', () => {
  const repo = tmpRepo();
  fs.writeFileSync(path.join(repo, 'AGENTS.md'), '# Team rules\n\nUse tabs.\n');
  assert.equal(run(repo, 'init').code, 0);
  assert.equal(run(repo, 'init').code, 1);
  const cfg = path.join(repo, '.d2s.json');
  const custom = { roles: ['product', 'engineering'], allowSamePerson: true, verify: 'github-pr' };
  fs.writeFileSync(cfg, JSON.stringify({ ...JSON.parse(read(cfg)), approvals: custom }));
  assert.equal(run(repo, 'init', '--force').code, 0);
  const agents = read(repo, 'AGENTS.md');
  assert.match(agents, /Use tabs\./, 'existing content is kept');
  assert.equal(agents.match(/<!-- d2s:start -->/g).length, 1);
  assert.deepEqual(JSON.parse(read(cfg)).approvals, custom, '--force keeps the approval rules');

  const he = tmpRepo();
  assert.equal(run(he, 'init', '--lang', 'he', '--dir', 'product', '--cli', 'npx d2s').code, 0);
  assert.equal(run(he, 'init', '--force').code, 0);
  const kept = JSON.parse(read(he, '.d2s.json'));
  assert.deepEqual([kept.lang, kept.dir, kept.cli], ['he', 'product', 'npx d2s'], '--force keeps the language, folder and command');
  assert.ok(kept.approvals, 'an upgraded config gets the approval rules');
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

  fill(exp(repo, id, 'brief.md'), {
    Problem: 'Mobile users abandon checkout.',
    'Where it lives today': 'Two checkout screens: https://www.figma.com/design/abc/Checkout?node-id=2-1',
    'Open questions': 'Does it happen on desktop too?',
  });
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

  // The decision gate needs real approvals: one line per person, every role, no placeholders.
  fill(exp(repo, id, 'decision.md'), {
    'Chosen direction': 'One-page checkout. https://www.figma.com/design/abc/Checkout?node-id=1-2',
    'Approved by': '',
  });
  r = run(repo, 'next', id);
  assert.equal(r.code, 1);
  assert.match(r.out, /section "Approved by" is empty/);
  const decision = exp(repo, id, 'decision.md');
  const approve = (text) => {
    setSection(decision, 'Approved by', text);
    return run(repo, 'next', id);
  };
  r = approve('TBD');
  assert.equal(r.code, 1, 'a placeholder is not an approval');
  assert.match(r.out, /"TBD" is not an approval/);
  r = approve('Dana (product), Yossi (design), Ron (engineering)');
  assert.equal(r.code, 1, 'free text is not one line per person');
  assert.match(r.out, /"Approved by" needs one line per person: name, role, date/);
  r = approve('- Dana Levi, product, 2026-11-20\n- Claude, design, 2026-11-20');
  assert.equal(r.code, 1);
  assert.match(r.out, /Only people approve\. Remove "Claude"/);
  r = approve('- Dana Levi, product, 2026-11-20\n- Yossi Bar, design, 2026-11-20');
  assert.equal(r.code, 1);
  assert.match(r.out, /Missing approval from: engineering/);
  r = approve('- Dana Levi, product, 2026-11-20\n- Dana Levi, design, 2026-11-20\n- Ron Tal, engineering, 2026-11-21');
  assert.equal(r.code, 1);
  assert.match(r.out, /Dana Levi is listed for two roles/);
  r = approve('- Dana Levi, product, 2026-11-20, @danalevi\n- Yossi Bar, design lead, 2026-11-20\n- Ron Tal, engineering, 2026-11-21');
  assert.equal(r.code, 0, r.out);
  assert.match(read(exp(repo, id, 'brief.md')), /^decided: \d{4}-\d{2}-\d{2}$/m, 'the decision date is recorded');
  const log = read(repo, 'design', 'decisions.md');
  assert.match(
    log,
    /\| \[Mobile checkout drop-off\]\(explorations\/001-checkout\/decision\.md\) \| One-page checkout\. \| Dana Levi \(product\), Yossi Bar \(design lead\), Ron Tal \(engineering\) \|/,
  );
  assert.doesNotMatch(log, /figma\.com/, 'links are kept out of the log');

  fill(exp(repo, id, 'spec.md'), { 'Acceptance criteria': 'Given a full cart, When the user taps "Pay", Then one page opens.', 'Existing components': '' });
  r = run(repo, 'next', id);
  assert.equal(r.code, 1, 'the spec names the components it uses');
  assert.match(r.out, /section "Existing components" is empty/);
  setSection(exp(repo, id, 'spec.md'), 'Existing components', 'Form fields and the primary button from the design system. No new components.');
  r = run(repo, 'next', id);
  assert.equal(r.code, 0, r.out);

  const handoff = read(exp(repo, id, 'handoff.md'));
  assert.match(handoff, /One-page checkout\./);
  assert.match(handoff, /- https:\/\/www\.figma\.com\/design\/abc\/Checkout\?node-id=1-2/);
  assert.doesNotMatch(handoff, /node-id=9-9/, 'rejected directions stay out of the handoff');
  assert.match(handoff, /Given a full cart/);
  assert.match(handoff, /Does it happen on desktop too\?/);
  assert.doesNotMatch(handoff, /\{\{\w+\}\}/);

  const summary = read(exp(repo, id, 'summary.md'));
  assert.match(summary, /^# Mobile checkout drop-off: summary$/m, 'a summary for design and product comes with the handoff');
  assert.match(summary, /## The problem\nMobile users abandon checkout\./);
  assert.match(summary, /## Where it lives today\nTwo checkout screens: https:\/\/www\.figma\.com\/design\/abc\/Checkout\?node-id=2-1/);
  assert.doesNotMatch(handoff, /node-id=2-1/, "the handoff's links come from the decision and the spec only");
  assert.match(summary, /## What we decided\nOne-page checkout\./);
  assert.match(summary, /## Approved by\n- Dana Levi, product, 2026-11-20, @danalevi\n- Yossi Bar, design lead/);
  assert.match(summary, /## Open questions\nDoes it happen on desktop too\?/);
  assert.doesNotMatch(summary, /\{\{\w+\}\}/);
  assert.doesNotMatch(summary, /\n{3,}/, 'no empty gaps where optional sections were blank');

  const proposal = read(repo, 'openspec', 'changes', 'checkout', 'proposal.md');
  assert.match(proposal, /## Why\n\nMobile users abandon checkout\./);
  assert.match(proposal, /\(\.\.\/\.\.\/\.\.\/design\/explorations\/001-checkout\/spec\.md\)/);

  assert.equal(run(repo, 'check').code, 0);
  const dec = exp(repo, id, 'decision.md');
  fs.writeFileSync(dec, read(dec).replace(/(## Risks and what to watch after launch \(optional\)\n)Filled in by the test\.\n/, '$1'));
  assert.equal(run(repo, 'handoff', id).code, 0, 'the handoff can be regenerated');
  const regenerated = read(exp(repo, id, 'summary.md'));
  assert.doesNotMatch(regenerated, /## Risks to watch/, 'an optional section left empty is left out of the summary');
  assert.match(regenerated, /## Approved by/);
  assert.doesNotMatch(regenerated, /d2s handoff|npx/, 'the summary for design and product has no commands in it');
  assert.match(run(repo, 'status', id).out, /ready for development/);

  assert.equal(run(repo, 'archive', id).code, 0);
  assert.ok(fs.existsSync(path.join(repo, 'design', 'explorations', 'archive', id, 'handoff.md')));
  assert.match(run(repo, 'status', '--all').out, /archived/);
  run(repo, 'new', 'Next one');
  assert.ok(fs.existsSync(exp(repo, '002-next-one', 'brief.md')), 'numbering continues after archive');
});

test('a new brief needs "Where it lives today" to pass the gate; a brand-new area says so', () => {
  const repo = tmpRepo();
  run(repo, 'init');
  run(repo, 'new', 'Saved cards', '--slug', 'cards');
  fill(exp(repo, '001-cards', 'brief.md'), { 'Where it lives today': '' });
  let r = run(repo, 'next', '1');
  assert.equal(r.code, 1);
  assert.match(r.out, /section "Where it lives today" is empty/, 'the gate names the section');
  setSection(exp(repo, '001-cards', 'brief.md'), 'Where it lives today', 'New area, nothing exists yet.');
  r = run(repo, 'next', '1');
  assert.equal(r.code, 0, r.out);

  const he = tmpRepo();
  run(he, 'init', '--lang', 'he');
  run(he, 'new', 'שמירת כרטיס', '--slug', 'cards');
  fill(exp(he, '001-cards', 'brief.md'), { 'איפה זה חי היום': '' });
  r = run(he, 'next', '1');
  assert.equal(r.code, 1);
  assert.match(r.out, /section "איפה זה חי היום" is empty/);
  setSection(exp(he, '001-cards', 'brief.md'), 'איפה זה חי היום', 'אזור חדש, עדיין אין כלום.');
  assert.equal(run(he, 'next', '1').code, 0);
});

test('after init --force, stages that passed before 0.6.0 only warn about the new sections', () => {
  const repo = tmpRepo();
  run(repo, 'init');
  // A repository set up with 0.5.0: its copies of the brief and spec templates predate the new sections.
  const tpl = (name) => path.join(repo, 'design', 'templates', `${name}.md`);
  fs.writeFileSync(tpl('brief'), template05('en', 'brief'));
  fs.writeFileSync(tpl('spec'), template05('en', 'spec'));

  // One exploration went all the way through with them; another is still being framed.
  run(repo, 'new', 'Old checkout', '--slug', 'old');
  const approvals = '- Dana Levi, product, 2026-11-20\n- Yossi Bar, design, 2026-11-20\n- Ron Tal, engineering, 2026-11-21';
  for (const f of ['brief.md', 'insights.md', 'options.md', 'decision.md', 'spec.md']) {
    fill(exp(repo, '001-old', f), { 'Approved by': approvals, 'Existing components': '', 'Acceptance criteria': 'Given a cart, When paying, Then one page opens.' });
    assert.equal(run(repo, 'next', 'old').code, 0, f);
  }
  run(repo, 'new', 'Old search', '--slug', 'search');
  assert.doesNotMatch(read(exp(repo, '002-search', 'brief.md')), /Where it lives today/);

  // The upgrade: init --force refreshes the templates nobody changed.
  const upgrade = run(repo, 'init', '--force');
  assert.equal(upgrade.code, 0, upgrade.out);
  assert.match(upgrade.out, /updated design\/templates\/brief\.md/);
  assert.match(upgrade.out, /updated design\/templates\/spec\.md/);
  assert.match(read(tpl('brief')), /^## Where it lives today$/m);

  // Given a brief that passed Frame before the upgrade, the missing section is a warning, not an error.
  let r = run(repo, 'check');
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /warn .*001-old\/brief\.md: missing section "Where it lives today" \(required since d2s 0\.6\.0, after this stage passed/);
  assert.match(r.out, /warn .*001-old\/spec\.md: section "Existing components" is empty \(required since d2s 0\.6\.0/);
  assert.doesNotMatch(r.out, /error/);
  assert.equal(run(repo, 'check', 'old', '--strict').code, 0, '--strict is about the current stage, not the ones that passed');

  // The stage an exploration is at is held to the new template.
  fill(exp(repo, '002-search', 'brief.md'));
  r = run(repo, 'next', 'search');
  assert.equal(r.code, 1);
  assert.match(r.out, /missing section "Where it lives today"/);
  fs.appendFileSync(exp(repo, '002-search', 'brief.md'), '\n## Where it lives today\nSearch results page.\n');
  assert.equal(run(repo, 'next', 'search').code, 0);

  // A brief made from the new template stays held to it once it has passed.
  run(repo, 'new', 'New one', '--slug', 'new');
  fill(exp(repo, '003-new', 'brief.md'));
  assert.equal(run(repo, 'next', 'new').code, 0);
  setSection(exp(repo, '003-new', 'brief.md'), 'Where it lives today', '');
  r = run(repo, 'check');
  assert.equal(r.code, 1);
  assert.match(r.out, /error .*003-new\/brief\.md: section "Where it lives today" is empty$/m);
});

test("init --force refreshes the design files a team never changed and keeps the ones they made their own", () => {
  const repo = tmpRepo();
  run(repo, 'init', '--cli', 'npx d2s');
  const tpl = (name) => path.join(repo, 'design', 'templates', `${name}.md`);
  // As 0.5.0 left them: the README rendered with the command, the spec template untouched,
  // and a brief template the team extended with a section of its own.
  fs.writeFileSync(path.join(repo, 'design', 'README.md'), lib.render(template05('en', 'readme'), { cli: 'npx d2s' }));
  fs.writeFileSync(tpl('spec'), template05('en', 'spec'));
  fs.writeFileSync(tpl('brief'), template05('en', 'brief') + '\n## Metrics\n<!-- How we will measure it. -->\n');
  fs.writeFileSync(path.join(repo, 'design', 'context.md'), '# Product context\n\n## The product\nA shop for busy parents.\n');

  const r = run(repo, 'init', '--force');
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /updated design\/README\.md/, 'a README rendered with the command is recognized');
  assert.match(read(repo, 'design', 'README.md'), /where it lives in the product today/);
  assert.match(read(repo, 'design', 'README.md'), /npx d2s new/);
  assert.match(r.out, /updated design\/templates\/spec\.md/);
  assert.match(read(tpl('spec')), /^## Existing components$/m);
  assert.match(r.out, /kept {4}design\/templates\/brief\.md {2}\(your own version; the new template adds "Where it lives today"\)/);
  assert.match(read(tpl('brief')), /^## Metrics$/m, 'their own template is kept');
  assert.match(r.out, /Your own templates were kept\. Add the new sections to them by hand/);
  assert.match(r.out, /kept {4}design\/context\.md\n/, 'a filled-in context is theirs');
  assert.equal(read(repo, 'design', 'context.md'), '# Product context\n\n## The product\nA shop for busy parents.\n');
  assert.doesNotMatch(run(repo, 'init', '--force').out, /updated design\//, 'running it again changes nothing');

  // Without --force, an existing copy is never touched.
  const fresh = tmpRepo();
  fs.mkdirSync(path.join(fresh, 'design', 'templates'), { recursive: true });
  fs.writeFileSync(path.join(fresh, 'design', 'templates', 'spec.md'), template05('en', 'spec'));
  assert.equal(run(fresh, 'init').code, 0);
  assert.equal(read(fresh, 'design', 'templates', 'spec.md'), template05('en', 'spec'));

  const he = tmpRepo();
  run(he, 'init', '--lang', 'he');
  fs.writeFileSync(path.join(he, 'design', 'templates', 'brief.md'), template05('he', 'brief'));
  assert.match(run(he, 'init', '--force').out, /updated design\/templates\/brief\.md/);
  assert.match(read(he, 'design', 'templates', 'brief.md'), /^## איפה זה חי היום$/m);
});

test('every version of the design files that d2s ships is fingerprinted, so init --force can refresh it later', () => {
  for (const lang of lib.LANGS) {
    for (const name of ['brief', 'insights', 'options', 'decision', 'spec', 'handoff', 'summary', 'readme', 'context']) {
      const text = lib.packagedTemplate(lang, name);
      assert.ok(lib.isShipped(lang, name, text), `add '${lib.fingerprint(text)}' to SHIPPED.${lang}.${name} in src/lib.js`);
    }
  }
  assert.equal(lib.fingerprint('a\r\nb\n\n'), lib.fingerprint('a\nb'), 'line endings and trailing space do not count');
  assert.notEqual(lib.fingerprint('a\nb'), lib.fingerprint('a\nc'));
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
  const decision = exp(repo, id, 'decision.md');
  setSection(decision, 'מי אישר', 'טרם נקבע');
  assert.match(run(repo, 'next', id).out, /"טרם נקבע" הוא לא אישור/, 'Hebrew placeholders, Hebrew messages');
  setSection(decision, 'מי אישר', '- דנה לוי, מוצר, 2026-11-20\n- יוסי בר, עיצוב, 2026-11-20');
  assert.match(run(repo, 'next', id).out, /חסר אישור של: פיתוח/);
  setSection(decision, 'מי אישר', '- דנה לוי, מוצר, 2026-11-20\n- יוסי בר, עיצוב, 2026-11-20\n- רון טל, פיתוח, 2026-11-21');
  assert.equal(run(repo, 'next', id).code, 0);
  assert.match(read(repo, 'design', 'decisions.md'), /תשלום בעמוד אחד\. \| דנה לוי \(מוצר\), יוסי בר \(עיצוב\), רון טל \(פיתוח\) \|/);

  fill(exp(repo, id, 'spec.md'), { 'מסכים וזרימה': 'עמוד תשלום אחד.', 'קריטריוני קבלה': 'בהינתן עגלה מלאה, כאשר לוחצים על "לתשלום", אז נפתח עמוד אחד.' });
  assert.equal(run(repo, 'next', id).code, 0);
  const summary = read(exp(repo, id, 'summary.md'));
  assert.match(summary, /: סיכום$/m);
  assert.match(summary, /## מה החלטנו\nתשלום בעמוד אחד\./);
  assert.match(summary, /## מה בונים\nעמוד תשלום אחד\./);
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

test('lib: approval rules', () => {
  const check = (content, settings = {}) => lib.checkApprovals(content, { lang: 'en', heading: 'Approved by', ...settings });
  const ok3 = '- Dana Levi, product, 2026-11-20\n- Yossi Bar, design, 2026-11-20\n- Ron Tal, engineering, 2026-11-21';
  assert.deepEqual(check(ok3), []);
  assert.deepEqual(check('1. Dana Levi, PM, 2026-11-20\n2. Yossi Bar, UX, 2026-11-20\n3. Ron Tal, Engineering lead, 2026-11-21'), [], 'aliases and numbered lists');
  assert.deepEqual(check('- Claude Dupont, product, 2026-11-20\n- Yossi Bar, design, 2026-11-20\n- Ron Tal, engineering, 2026-11-21'), [], 'a person named Claude is a person');

  for (const placeholder of ['TBD', 'N/A', '?', 'pending', '- Dana Levi, product, TODO']) {
    assert.match(check(placeholder)[0], /is not an approval/, placeholder);
  }
  assert.match(check('- Dana Levi, product, 2026-02-30')[0], /needs one line per person/, 'a date that does not exist');
  assert.match(check('- Dana Levi, product')[0], /needs one line per person/);
  assert.match(check('- Dana Levi, product, 2026-11-20, danalevi')[0], /needs one line per person/, 'a handle starts with @');
  assert.match(check('- Copilot, engineering, 2026-11-20')[0], /Only people approve\. Remove "Copilot"/);
  assert.match(check('- Ron Tal, engineering, 2026-11-20, @claude[bot]')[0], /Remove "@claude\[bot\]"/);
  assert.match(check('Approved by Claude')[0], /Remove "Claude"/);

  const same = '- Dana Levi, product, 2026-11-20\n- dana levi, design, 2026-11-20\n- Ron Tal, engineering, 2026-11-21';
  assert.deepEqual(check(same), ['Dana Levi is listed for two roles']);
  assert.deepEqual(check(same, { allowSamePerson: true }), [], 'small teams can allow it');
  assert.deepEqual(check('- Dana Levi, product, 2026-11-20', { roles: ['product'] }), [], 'roles come from the config');
  assert.deepEqual(check('- Dana Levi, product, 2026-11-20', { roles: ['product', 'legal'] }), ['Missing approval from: legal']);
  assert.match(check(ok3, { verify: 'github-pr' })[0], /Dana Levi needs a GitHub handle/);

  const he = (content) => lib.checkApprovals(content, { lang: 'he', heading: 'מי אישר' });
  assert.deepEqual(he('- דנה לוי, מוצר, 2026-11-20\n- יוסי בר, עיצוב, 2026-11-20\n- רון טל, פיתוח, 2026-11-21'), []);
  assert.deepEqual(he('- דנה לוי, מוצר, 2026-11-20'), ['חסר אישור של: עיצוב, פיתוח']);
  assert.match(he('ממתין')[0], /"ממתין" הוא לא אישור/);
  assert.match(he('- סוכן AI, פיתוח, 2026-11-20')[0], /רק אנשים מאשרים/);

  assert.equal(lib.formatApprovalLine({ name: 'Dana, Levi', role: 'design', date: '2026-11-20', handle: '' }), '- Dana  Levi, design, 2026-11-20');
});

test('decisions approved before 0.2.0 only warn, so CI does not break on upgrade', () => {
  const repo = tmpRepo();
  run(repo, 'init');
  run(repo, 'new', 'Old decision');
  const id = '001-old-decision';
  for (const f of ['brief.md', 'insights.md', 'options.md', 'decision.md', 'spec.md']) {
    const vars = { id, title: 'Old decision', date: '2026-01-01', owner: '' };
    if (f !== 'brief.md') fs.writeFileSync(exp(repo, id, f), lib.render(lib.packagedTemplate('en', f.replace('.md', '')), vars));
    fill(exp(repo, id, f), { 'Approved by': 'Dana (product), Yossi (design), Ron (engineering)' });
  }
  const brief = exp(repo, id, 'brief.md');
  fs.writeFileSync(brief, lib.setFrontMatterField(read(brief), 'stage', 'spec'));
  let r = run(repo, 'check');
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /warn .*needs one line per person.*approved before d2s 0\.2\.0/);

  fs.writeFileSync(brief, lib.setFrontMatterField(read(brief), 'decided', '2026-11-20'));
  r = run(repo, 'check');
  assert.equal(r.code, 1, 'a decision that passed the new gate is held to it');
  assert.match(r.out, /error .*needs one line per person/);
});

test('check --verify-approvals asks GitHub whether each approver approved the pull request', async () => {
  const http = require('node:http');
  const { execFile } = require('node:child_process');
  const repo = tmpRepo();
  run(repo, 'init');
  const cfg = path.join(repo, '.d2s.json');
  fs.writeFileSync(cfg, JSON.stringify({ ...JSON.parse(read(cfg)), approvals: { roles: ['product', 'design', 'engineering'], verify: 'github-pr' } }));
  run(repo, 'new', 'Verified');
  const id = '001-verified';
  for (const f of ['brief.md', 'insights.md', 'options.md']) {
    fill(exp(repo, id, f));
    assert.equal(run(repo, 'next', id).code, 0);
  }
  fill(exp(repo, id, 'decision.md'), { 'Approved by': '- Dana Levi, product, 2026-11-20\n- Yossi Bar, design, 2026-11-20\n- Ron Tal, engineering, 2026-11-21' });
  let r = run(repo, 'next', id);
  assert.equal(r.code, 1, 'with github-pr, every line needs a handle');
  assert.match(r.out, /Dana Levi needs a GitHub handle/);
  setSection(exp(repo, id, 'decision.md'), 'Approved by', '- Dana Levi, product, 2026-11-20, @danalevi\n- Yossi Bar, design, 2026-11-20, @YossiBar\n- Ron Tal, engineering, 2026-11-21, @rontal');
  assert.equal(run(repo, 'next', id).code, 0);

  const state = { files: [`design/explorations/${id}/decision.md`], reviews: [], requests: [] };
  const server = http.createServer((req, res) => {
    state.requests.push(req.url);
    assert.equal(req.headers.authorization, 'Bearer test-token');
    const route = /\/repos\/acme\/app\/pulls\/7\/(files|reviews)\?/.exec(req.url);
    res.setHeader('content-type', 'application/json');
    if (!route) {
      res.statusCode = 404;
      return res.end('{}');
    }
    res.end(JSON.stringify(route[1] === 'files' ? state.files.map((filename) => ({ filename })) : state.reviews));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const env = {
    ...process.env,
    NO_COLOR: '1',
    GITHUB_TOKEN: 'test-token',
    GITHUB_REPOSITORY: 'acme/app',
    GITHUB_API_URL: `http://127.0.0.1:${server.address().port}`,
  };
  const verify = (extraEnv = {}, ...args) =>
    new Promise((resolve) => {
      execFile(process.execPath, [BIN, 'check', '--verify-approvals', ...args], { cwd: repo, env: { ...env, ...extraEnv } }, (err, stdout, stderr) => {
        resolve({ code: err ? err.code : 0, out: stdout + stderr });
      });
    });
  const review = (login, s) => ({ user: { login }, state: s });

  try {
    state.reviews = [review('danalevi', 'APPROVED'), review('yossibar', 'APPROVED'), review('yossibar', 'CHANGES_REQUESTED'), review('rontal', 'COMMENTED')];
    r = await verify({}, '--pr', '7');
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /@YossiBar has not approved this pull request/);
    assert.match(r.out, /@rontal has not approved this pull request/);
    assert.doesNotMatch(r.out, /@danalevi has not/);

    state.reviews.push(review('YossiBar', 'APPROVED'), review('rontal', 'APPROVED'), review('rontal', 'COMMENTED'));
    const event = path.join(repo, 'event.json');
    fs.writeFileSync(event, JSON.stringify({ pull_request: { number: 7 } }));
    r = await verify({ GITHUB_EVENT_PATH: event });
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /3 approval\(s\) verified on pull request #7/);

    state.files = ['README.md'];
    state.requests = [];
    r = await verify({}, '--pr', '7');
    assert.equal(r.code, 0, r.out);
    assert.ok(state.requests.every((u) => u.includes('/files?')), 'decisions this pull request does not touch are not verified');

    r = await verify({ GITHUB_TOKEN: '', GH_TOKEN: '' }, '--pr', '7');
    assert.equal(r.code, 1);
    assert.match(r.out, /needs a GITHUB_TOKEN/);

    fs.writeFileSync(cfg, JSON.stringify({ ...JSON.parse(read(cfg)), approvals: { verify: 'none' } }));
    state.requests = [];
    r = await verify({}, '--pr', '7');
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /verification is off/);
    assert.equal(state.requests.length, 0, 'no network unless the team turns it on');
  } finally {
    server.close();
  }

  const ci = path.join(repo, 'ci');
  fs.mkdirSync(ci);
  assert.equal(run(ci, 'init', '--ci').code, 0);
  const workflow = read(ci, '.github/workflows/d2s-check.yml');
  assert.match(workflow, /check --verify-approvals\n\s+env:\n\s+GITHUB_TOKEN: \$\{\{ github\.token \}\}/);
  assert.match(workflow, /pull_request_review:/);
});
