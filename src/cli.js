'use strict';

const fs = require('node:fs');
const path = require('node:path');
const lib = require('./lib.js');

const { STAGES, KEY_SECTIONS, UserError } = lib;
const VERSION = require('../package.json').version;
const TEMPLATE_NAMES = ['brief', 'insights', 'options', 'decision', 'spec', 'handoff'];
const AGENTS = ['claude', 'cursor', 'agents-md'];
const REMOTE_CLI = 'npx github:eranlipi/discovery-to-spec';

/** "npx d2s" when installed in the project's node_modules, otherwise run straight from GitHub. */
function defaultCli(root) {
  const real = (p) => {
    try {
      return fs.realpathSync(p);
    } catch {
      return path.resolve(p);
    }
  };
  const modules = real(path.join(root, 'node_modules')) + path.sep;
  return real(lib.PKG_ROOT).startsWith(modules) ? 'npx d2s' : REMOTE_CLI;
}

// ---------- output ----------

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code) => (s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : String(s));
const c = { green: paint(32), red: paint(31), yellow: paint(33), dim: paint(2), bold: paint(1) };
const log = (...a) => console.log(...a);
const ok = (s) => log(`${c.green('✔')} ${s}`);
const bad = (s) => log(`${c.red('✖')} ${s}`);
const warn = (s) => log(`${c.yellow('!')} ${s}`);

function table(rows) {
  const widths = rows[0].map((_, i) => Math.max(...rows.map((r) => String(r[i]).length)));
  rows.forEach((r, ri) => {
    log(r.map((cell, i) => String(cell).padEnd(widths[i])).join('  ').trimEnd());
    if (ri === 0) log(widths.map((w) => '-'.repeat(w)).join('  '));
  });
}

// ---------- args ----------

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--') {
      positional.push(...argv.slice(i + 1));
      break;
    }
    if (a.startsWith('--')) {
      const [key, inline] = a.slice(2).split(/=(.*)/s);
      if (inline !== undefined) flags[key] = inline;
      else if (argv[i + 1] !== undefined && !argv[i + 1].startsWith('--')) flags[key] = argv[++i];
      else flags[key] = true;
    } else if (a === '-h') flags.help = true;
    else if (a === '-v') flags.version = true;
    else positional.push(a);
  }
  return { positional, flags };
}

// ---------- init ----------

function init(flags) {
  const root = process.cwd();
  const cfgPath = path.join(root, lib.CONFIG_FILE);
  if (lib.exists(cfgPath) && !flags.force) {
    throw new UserError(`Already initialized (${lib.CONFIG_FILE} exists). Use --force to refresh the agent files.`);
  }
  const lang = flags.lang || 'en';
  if (!lib.LANGS.includes(lang)) throw new UserError(`--lang must be one of: ${lib.LANGS.join(', ')}`);
  const dir = typeof flags.dir === 'string' ? flags.dir.replace(/\/+$/, '') : 'design';
  const cli = typeof flags.cli === 'string' ? flags.cli : defaultCli(root);
  let agents = AGENTS;
  if (typeof flags.agents === 'string') {
    agents = flags.agents === 'none' ? [] : flags.agents.split(',').map((s) => s.trim()).filter(Boolean);
    const unknown = agents.filter((a) => !AGENTS.includes(a));
    if (unknown.length) throw new UserError(`Unknown agent "${unknown[0]}". Use: ${AGENTS.join(', ')}, or none.`);
  }

  // A project-local install needs its dependencies in CI before "npx d2s" can run.
  const ciInstall = cli === 'npx d2s' ? '      - run: npm ci\n' : '';
  const vars = { dir, cli, date: lib.today(), ciInstall };
  const results = [];
  const put = (rel, text, force = false) => results.push([lib.writeFileSafe(path.join(root, rel), text, force), rel]);
  const pkg = (rel) => lib.readText(path.join(lib.PKG_ROOT, rel));

  // Design folder
  put(`${dir}/README.md`, lib.render(lib.packagedTemplate(lang, 'readme'), vars));
  put(`${dir}/context.md`, lib.render(lib.packagedTemplate(lang, 'context'), vars));
  put(`${dir}/decisions.md`, lib.render(lib.packagedTemplate(lang, 'decisions'), vars));
  put(`${dir}/explorations/.gitkeep`, '');
  for (const name of TEMPLATE_NAMES) put(`${dir}/templates/${name}.md`, lib.packagedTemplate(lang, name));

  // Agent integrations (ours to manage: refreshed with --force)
  const skillsDir = path.join(lib.PKG_ROOT, 'integrations', 'skills');
  const skills = fs.readdirSync(skillsDir).filter((n) => n.startsWith('d2s-')).sort();
  for (const name of skills) {
    const text = lib.render(lib.readText(path.join(skillsDir, name, 'SKILL.md')), vars);
    if (agents.includes('claude')) put(`.claude/skills/${name}/SKILL.md`, text, !!flags.force);
    if (agents.includes('cursor')) {
      const body = lib.parseFrontMatter(text).body.trimStart();
      put(`.cursor/commands/${name}.md`, body, !!flags.force);
    }
  }
  if (agents.includes('agents-md')) results.push([upsertAgentsMd(root, lib.render(pkg('integrations/agents-md.md'), vars)), 'AGENTS.md']);
  if (flags.ci) put('.github/workflows/d2s-check.yml', lib.render(pkg('integrations/ci/d2s-check.yml'), vars), !!flags.force);

  // Config last, so a failed init can simply be re-run
  const config = { version: 1, lang, dir, cli };
  lib.writeText(cfgPath, JSON.stringify(config, null, 2) + '\n');
  results.push([flags.force ? 'updated' : 'created', lib.CONFIG_FILE]);

  log(c.bold(`discovery-to-spec initialized (${lang === 'he' ? 'Hebrew' : 'English'} templates)\n`));
  for (const [state, rel] of results) {
    const label = state === 'kept' ? c.dim('kept   ') : state === 'updated' ? c.yellow('updated') : c.green('created');
    log(`  ${label} ${rel}`);
  }
  log(`\nNext:\n  ${cli} new "Short name of the problem"\n  Then fill ${dir}/explorations/<id>/brief.md (or run /d2s-frame in Claude Code or Cursor).`);
  return 0;
}

function upsertAgentsMd(root, block) {
  const file = path.join(root, 'AGENTS.md');
  const start = '<!-- d2s:start -->';
  const end = '<!-- d2s:end -->';
  const wrapped = `${start}\n${block.trim()}\n${end}`;
  if (!lib.exists(file)) {
    lib.writeText(file, `# AGENTS.md\n\n${wrapped}\n`);
    return 'created';
  }
  const text = lib.readText(file);
  const re = new RegExp(`${start}[\\s\\S]*?${end}`);
  if (re.test(text)) {
    lib.writeText(file, text.replace(re, () => wrapped));
  } else {
    lib.writeText(file, `${text.replace(/\s*$/, '')}\n\n${wrapped}\n`);
  }
  return 'updated';
}

// ---------- new ----------

function cmdNew(positional, flags) {
  const ctx = lib.loadContext();
  const title = positional.join(' ').trim();
  if (!title) throw new UserError('Give the exploration a title: d2s new "Checkout drop-off on mobile"');
  const slug = lib.slugify(typeof flags.slug === 'string' ? flags.slug : title) || 'exploration';
  const id = `${lib.nextNumber(ctx)}-${slug}`;
  const dir = path.join(ctx.explorationsDir, id);
  const brief = lib.render(lib.getTemplate(ctx, 'brief'), {
    id,
    title: title.replace(/\r?\n/g, ' '),
    date: lib.today(),
    owner: typeof flags.owner === 'string' ? flags.owner : '',
  });
  lib.writeText(path.join(dir, 'brief.md'), brief);
  ok(`Created ${path.relative(ctx.root, path.join(dir, 'brief.md'))}`);
  if (!lib.slugify(title) && typeof flags.slug !== 'string') {
    warn('The title has no latin letters, so the folder is named "exploration". Use --slug to choose a name.');
  }
  log(`\nNext: fill the brief (or run /d2s-frame ${id}), then: ${ctx.config.cli} next ${id}`);
  return 0;
}

// ---------- status ----------

function stageLabel(exp) {
  if (exp.archived) return 'archived';
  const i = lib.stageIndex(exp.stage);
  return i < 0 ? `? ${exp.stage}` : `${i + 1}/6 ${exp.stage}`;
}

function nextStep(ctx, exp) {
  if (exp.archived) return '—';
  const i = lib.stageIndex(exp.stage);
  if (i < 0) return 'fix stage in brief.md';
  const stage = STAGES[i];
  if (stage.id === 'handoff') return `build it, then: d2s archive ${exp.id}`;
  const r = lib.checkStageDoc(ctx, exp, stage);
  return r.errors.length ? `fill ${stage.file} (/${stage.skill})` : `ready: d2s next ${exp.id}`;
}

function status(positional, flags) {
  const ctx = lib.loadContext();
  if (positional[0]) return statusOne(ctx, lib.resolveExploration(ctx, positional[0], { includeArchived: true }));
  const list = lib.listExplorations(ctx, { includeArchived: !!flags.all });
  if (!list.length) {
    log(`No explorations yet. Start one with: ${ctx.config.cli} new "Short name of the problem"`);
    return 0;
  }
  table([['ID', 'STAGE', 'TITLE', 'NEXT'], ...list.map((e) => [e.id, stageLabel(e), e.title, nextStep(ctx, e)])]);
  return 0;
}

function statusOne(ctx, exp) {
  log(`${c.bold(exp.title)}  ${c.dim(exp.id)}${exp.owner ? c.dim(`  owner: ${exp.owner}`) : ''}\n`);
  const current = exp.archived ? STAGES.length : lib.stageIndex(exp.stage);
  STAGES.forEach((stage, i) => {
    const name = `${i + 1}. ${stage.id.padEnd(9)} ${stage.file}`;
    if (i < current) ok(name);
    else if (i === current) {
      if (stage.id === 'handoff') {
        log(`${c.yellow('●')} ${name}  ${c.green('ready for development')}${c.dim(` — then d2s archive ${exp.id}`)}`);
        return;
      }
      const r = lib.checkStageDoc(ctx, exp, stage);
      log(`${c.yellow('●')} ${name}  ${r.errors.length ? c.dim(`${r.errors.length} gap(s) — /${stage.skill}`) : c.green('ready for d2s next')}`);
      r.errors.forEach((e) => log(c.dim(`      ${e}`)));
    } else log(c.dim(`· ${name}`));
  });
  if (exp.archived) log(c.dim('\n(archived)'));
  return 0;
}

// ---------- check ----------

function check(positional, flags) {
  const ctx = lib.loadContext();
  const targets = positional[0] ? [lib.resolveExploration(ctx, positional[0])] : lib.listExplorations(ctx);
  if (!targets.length) {
    log('No explorations to check.');
    return 0;
  }
  let errorCount = 0;
  for (const exp of targets) {
    const r = lib.checkExploration(ctx, exp, { strict: !!flags.strict });
    errorCount += r.errors.length;
    if (!r.errors.length && !r.warnings.length) ok(`${exp.id} (${exp.stage})`);
    else {
      (r.errors.length ? bad : warn)(`${exp.id} (${exp.stage})`);
      r.errors.forEach((e) => log(`    ${c.red('error')} ${e}`));
      r.warnings.forEach((w) => log(`    ${c.yellow('warn ')} ${w}`));
    }
  }
  return errorCount ? 1 : 0;
}

// ---------- next ----------

function next(positional, flags) {
  const ctx = lib.loadContext();
  const exp = lib.resolveExploration(ctx, positional[0]);
  const i = lib.stageIndex(exp.stage);
  if (i < 0) throw new UserError(`Unknown stage "${exp.stage}" in ${path.relative(ctx.root, exp.briefPath)}.`);
  if (STAGES[i].id === 'handoff') {
    log(`${exp.id} is already at handoff. When it is built: ${ctx.config.cli} archive ${exp.id}`);
    return 0;
  }

  const r = lib.checkExploration(ctx, exp, { strict: true });
  if (r.errors.length) {
    bad(`${exp.id} can't move past "${exp.stage}" yet:`);
    r.errors.forEach((e) => log(`    ${e}`));
    log(`\nFill the gaps (or run /${STAGES[i].skill} ${exp.id}) and try again.`);
    return 1;
  }

  if (STAGES[i].id === 'decide') appendDecision(ctx, exp);

  const target = STAGES[i + 1];
  const file = path.join(exp.dir, target.file);
  const vars = { id: exp.id, title: exp.title, date: lib.today() };
  if (target.id === 'handoff') writeHandoff(ctx, exp, flags);
  else if (!lib.exists(file)) lib.writeText(file, lib.render(lib.getTemplate(ctx, target.template), vars));

  lib.writeText(exp.briefPath, lib.setFrontMatterField(lib.readText(exp.briefPath), 'stage', target.id));
  ok(`${exp.id}: ${STAGES[i].id} → ${target.id}`);
  log(`  ${path.relative(ctx.root, file)}`);
  if (target.id === 'handoff') log(`\nReady for development. A coding agent can start with /d2s-handoff ${exp.id}.`);
  else log(`\nNext: fill ${target.file} (or run /${target.skill} ${exp.id}), then: ${ctx.config.cli} next ${exp.id}`);
  return 0;
}

function escapeCell(s) {
  return String(s).replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();
}

function appendDecision(ctx, exp) {
  const keys = KEY_SECTIONS[ctx.lang];
  const decision = path.join(exp.dir, 'decision.md');
  const chosen = lib.firstParagraph(lib.sectionContent(decision, keys.chosen).replace(/https?:\/\/\S+/g, ''), 120);
  const approvedBy = lib.firstParagraph(lib.sectionContent(decision, keys.approvedBy), 80);
  const logFile = path.join(ctx.designDir, 'decisions.md');
  const link = path.relative(path.dirname(logFile), decision).split(path.sep).join('/');
  const row = `| ${lib.today()} | [${escapeCell(exp.title)}](${link}) | ${escapeCell(chosen)} | ${escapeCell(approvedBy)} |`;
  const existing = lib.exists(logFile) ? lib.readText(logFile) : lib.render(lib.packagedTemplate(ctx.lang, 'decisions'), {});
  lib.writeText(logFile, `${existing.replace(/\s*$/, '')}\n${row}\n`);
  ok(`Decision recorded in ${path.relative(ctx.root, logFile)}`);
}

// ---------- handoff ----------

function writeHandoff(ctx, exp, flags = {}) {
  const keys = KEY_SECTIONS[ctx.lang];
  const docs = STAGES.slice(0, 5).map((s) => path.join(exp.dir, s.file));
  // Only the approved direction matters to development: links from the decision and the spec.
  const approvedText = [docs[3], docs[4]].filter(lib.exists).map(lib.readText).join('\n');
  const links = lib.figmaLinks(approvedText);
  const none = '—';
  const chosen = lib.sectionContent(docs[3], keys.chosen);
  const vars = {
    id: exp.id,
    title: exp.title,
    date: lib.today(),
    cli: ctx.config.cli,
    chosen: chosen ? lib.firstParagraph(chosen, 400) : none,
    figma: links.length ? links.map((l) => `- ${l}`).join('\n') : none,
    criteria: lib.sectionContent(docs[4], keys.criteria) || none,
    openQuestions: lib.sectionContent(docs[0], keys.openQuestions) || none,
  };
  const file = path.join(exp.dir, 'handoff.md');
  lib.writeText(file, lib.render(lib.getTemplate(ctx, 'handoff'), vars));

  const openspecDir = path.join(ctx.root, 'openspec');
  if (flags.openspec || lib.exists(openspecDir)) writeOpenSpecProposal(ctx, exp, { chosen, links, force: !!flags.force });
  return file;
}

function writeOpenSpecProposal(ctx, exp, { chosen, links, force }) {
  const keys = KEY_SECTIONS[ctx.lang];
  const changeDir = path.join(ctx.root, 'openspec', 'changes', exp.id.replace(/^\d+-/, ''));
  const file = path.join(changeDir, 'proposal.md');
  const rel = (p) => path.relative(changeDir, p).split(path.sep).join('/');
  const problem = lib.sectionContent(exp.briefPath, keys.problem);
  const text = [
    `## Why`,
    '',
    problem || '(see the design brief)',
    '',
    `## What Changes`,
    '',
    chosen || '(see the design decision)',
    '',
    `- Design spec: [spec.md](${rel(path.join(exp.dir, 'spec.md'))})`,
    `- Handoff: [handoff.md](${rel(path.join(exp.dir, 'handoff.md'))})`,
    '',
    `## Impact`,
    '',
    `- Design source: ${links.length ? links.join(', ') : 'see spec.md'}`,
    `- Generated by discovery-to-spec from exploration ${exp.id}. Add spec deltas and tasks with your OpenSpec workflow.`,
    '',
  ].join('\n');
  const state = lib.writeFileSafe(file, text, force);
  if (state === 'kept') warn(`${path.relative(ctx.root, file)} exists — left as is (use --force to overwrite)`);
  else ok(`OpenSpec draft proposal: ${path.relative(ctx.root, file)}`);
}

function handoff(positional, flags) {
  const ctx = lib.loadContext();
  const exp = lib.resolveExploration(ctx, positional[0]);
  if (exp.stage !== 'handoff') {
    throw new UserError(`${exp.id} is at "${exp.stage}". Reach handoff with: ${ctx.config.cli} next ${exp.id}`);
  }
  const file = writeHandoff(ctx, exp, flags);
  ok(`Regenerated ${path.relative(ctx.root, file)}`);
  return 0;
}

// ---------- archive ----------

function archive(positional, flags) {
  const ctx = lib.loadContext();
  const exp = lib.resolveExploration(ctx, positional[0]);
  if (exp.stage !== 'handoff' && !flags.force) {
    throw new UserError(`${exp.id} is at "${exp.stage}", not handoff. Use --force to archive it anyway.`);
  }
  const target = path.join(ctx.archiveDir, exp.id);
  if (lib.exists(target)) throw new UserError(`${path.relative(ctx.root, target)} already exists.`);
  lib.writeText(exp.briefPath, lib.setFrontMatterField(lib.readText(exp.briefPath), 'archived', lib.today()));
  fs.mkdirSync(ctx.archiveDir, { recursive: true });
  fs.renameSync(exp.dir, target);
  ok(`Archived to ${path.relative(ctx.root, target)}`);
  return 0;
}

// ---------- help ----------

const HELP = `discovery-to-spec ${VERSION} — a repo-native workflow for design and product teams

Usage: d2s <command> [options]

  init                  Set up the design folder, templates and agent skills
      --lang he|en        Template language (default: en)
      --dir <path>        Design folder (default: design)
      --agents <list>     claude,cursor,agents-md or none (default: all three)
      --cli "<command>"   How docs and skills call this tool (default: "npx d2s" when
                          installed in the project, otherwise ${REMOTE_CLI})
      --ci                Add a GitHub Actions check for pull requests
      --force             Refresh agent files and config in an initialized repo
  new "<title>"         Start an exploration (stage 1: frame)
      --slug <name>       Folder name (latin letters)
      --owner <name>      Who leads it
  status [id]           List explorations, or show one stage by stage
      --all               Include archived explorations
  check [id]            Validate documents (exit code 1 on errors, for CI)
      --strict            Treat the current stage's gaps as errors too
  next <id>             Pass the gate: validate the current stage and open the next
  handoff <id>          Regenerate handoff.md (and the OpenSpec draft, if openspec/ exists)
      --openspec          Write the OpenSpec draft even without an openspec/ folder
  archive <id>          Move a built exploration to explorations/archive

Stages: frame → research → options → decide → spec → handoff
An id can be "003-checkout", "3" or "checkout".`;

// ---------- main ----------

function main(argv) {
  const { positional, flags } = parseArgs(argv);
  const command = positional.shift();
  try {
    if (flags.version || command === 'version') {
      log(VERSION);
      return 0;
    }
    if (!command || command === 'help' || flags.help) {
      log(HELP);
      return 0;
    }
    switch (command) {
      case 'init':
        return init(flags);
      case 'new':
        return cmdNew(positional, flags);
      case 'status':
        return status(positional, flags);
      case 'check':
        return check(positional, flags);
      case 'next':
        return next(positional, flags);
      case 'handoff':
        return handoff(positional, flags);
      case 'archive':
        return archive(positional, flags);
      default:
        throw new UserError(`Unknown command "${command}". Run "d2s help".`);
    }
  } catch (err) {
    if (err instanceof UserError) {
      bad(err.message);
      return 1;
    }
    throw err;
  }
}

module.exports = { main, parseArgs };
