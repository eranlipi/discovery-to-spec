'use strict';

const fs = require('node:fs');
const path = require('node:path');

const PKG_ROOT = path.resolve(__dirname, '..');
const CONFIG_FILE = '.d2s.json';
const LANGS = ['he', 'en'];

// The six stages of an exploration. `file` is the document each stage produces.
const STAGES = [
  { id: 'frame', file: 'brief.md', template: 'brief', skill: 'd2s-frame' },
  { id: 'research', file: 'insights.md', template: 'insights', skill: 'd2s-research' },
  { id: 'options', file: 'options.md', template: 'options', skill: 'd2s-options' },
  { id: 'decide', file: 'decision.md', template: 'decision', skill: 'd2s-decide' },
  { id: 'spec', file: 'spec.md', template: 'spec', skill: 'd2s-spec' },
  { id: 'handoff', file: 'handoff.md', template: 'handoff', skill: 'd2s-handoff' },
];
const ARCHIVED = 'archived';

// Headings the CLI reads to build the handoff. Must match the templates.
const KEY_SECTIONS = {
  he: {
    problem: 'הבעיה',
    openQuestions: 'שאלות פתוחות',
    chosen: 'הכיוון שנבחר',
    approvedBy: 'מי אישר',
    criteria: 'קריטריוני קבלה',
  },
  en: {
    problem: 'Problem',
    openQuestions: 'Open questions',
    chosen: 'Chosen direction',
    approvedBy: 'Approved by',
    criteria: 'Acceptance criteria',
  },
};

class UserError extends Error {}

// ---------- files ----------

function exists(p) {
  return fs.existsSync(p);
}

function readText(p) {
  return fs.readFileSync(p, 'utf8');
}

function writeText(p, text) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, text);
}

/** Write a file unless it exists. Returns 'created' | 'updated' | 'kept'. */
function writeFileSafe(p, text, force = false) {
  if (exists(p)) {
    if (!force) return 'kept';
    writeText(p, text);
    return 'updated';
  }
  writeText(p, text);
  return 'created';
}

function render(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : match,
  );
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function slugify(text) {
  return String(text)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/g, '');
}

// ---------- front matter ----------

const FM_RE = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(\r?\n|$)/;

function parseFrontMatter(text) {
  const m = text.match(FM_RE);
  if (!m) return { data: {}, body: text };
  const data = {};
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i > 0) data[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return { data, body: text.slice(m[0].length) };
}

function setFrontMatterField(text, key, value) {
  const m = text.match(FM_RE);
  if (!m) return `---\n${key}: ${value}\n---\n\n${text}`;
  const re = new RegExp(`^${key}:.*$`, 'm');
  const block = re.test(m[1])
    ? m[1].replace(re, () => `${key}: ${value}`)
    : `${m[1]}\n${key}: ${value}`;
  return `---\n${block}\n---\n` + text.slice(m[0].length);
}

// ---------- sections ----------

const OPTIONAL_RE = /\((optional|אופציונלי)\)/i;

function stripComments(text) {
  return text.replace(/<!--[\s\S]*?-->/g, '');
}

function normalizeHeading(heading) {
  return heading.replace(OPTIONAL_RE, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

/** Split a markdown body into `## ` sections. Ignores headings inside code fences. */
function parseSections(body) {
  const sections = [];
  let current = null;
  let inFence = false;
  for (const line of body.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
    const m = inFence ? null : line.match(/^##\s+(.+?)\s*$/);
    if (m) {
      current = { heading: m[1], lines: [] };
      sections.push(current);
    } else if (current) {
      current.lines.push(line);
    }
  }
  return sections.map((s) => {
    const raw = s.lines.join('\n');
    return {
      heading: s.heading,
      key: normalizeHeading(s.heading),
      optional: OPTIONAL_RE.test(s.heading),
      raw,
      content: stripComments(raw).trim(),
    };
  });
}

function findSection(sections, heading) {
  const key = normalizeHeading(heading);
  return sections.find((s) => s.key === key) || null;
}

function sectionContent(filePath, heading) {
  if (!exists(filePath)) return '';
  const s = findSection(parseSections(parseFrontMatter(readText(filePath)).body), heading);
  return s ? s.content : '';
}

function firstParagraph(text, max = 160) {
  const para = (text.split(/\n\s*\n/)[0] || '').replace(/\s+/g, ' ').trim();
  return para.length > max ? para.slice(0, max - 1).trimEnd() + '…' : para;
}

const FIGMA_RE = /https?:\/\/(?:www\.)?figma\.com\/[^\s)\]>"'`]+/g;

function figmaLinks(text) {
  return [...new Set(stripComments(text).match(FIGMA_RE) || [])];
}

// ---------- config & context ----------

function findRoot(start = process.cwd()) {
  let dir = path.resolve(start);
  for (;;) {
    if (exists(path.join(dir, CONFIG_FILE))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function loadContext(cwd = process.cwd()) {
  const root = findRoot(cwd);
  if (!root) {
    throw new UserError(`No ${CONFIG_FILE} found. Run "d2s init" in your repository first.`);
  }
  let config;
  try {
    config = JSON.parse(readText(path.join(root, CONFIG_FILE)));
  } catch (err) {
    throw new UserError(`Could not read ${CONFIG_FILE}: ${err.message}`);
  }
  const lang = LANGS.includes(config.lang) ? config.lang : 'en';
  const dir = config.dir || 'design';
  const designDir = path.join(root, dir);
  return {
    root,
    config: { ...config, lang, dir, cli: config.cli || 'npx d2s' },
    lang,
    designDir,
    explorationsDir: path.join(designDir, 'explorations'),
    archiveDir: path.join(designDir, 'explorations', 'archive'),
  };
}

/** Template text: the team's copy in <dir>/templates wins over the packaged one. */
function getTemplate(ctx, name) {
  const local = path.join(ctx.designDir, 'templates', `${name}.md`);
  if (exists(local)) return readText(local);
  return packagedTemplate(ctx.lang, name);
}

function packagedTemplate(lang, name) {
  return readText(path.join(PKG_ROOT, 'templates', lang, `${name}.md`));
}

// ---------- explorations ----------

function listDirs(dir) {
  if (!exists(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^\d{3,}-/.test(d.name))
    .map((d) => d.name)
    .sort();
}

function readExploration(ctx, id, archived = false) {
  const dir = path.join(archived ? ctx.archiveDir : ctx.explorationsDir, id);
  const briefPath = path.join(dir, 'brief.md');
  const fm = exists(briefPath) ? parseFrontMatter(readText(briefPath)).data : {};
  return {
    id,
    dir,
    briefPath,
    archived,
    title: fm.title || id,
    stage: archived ? ARCHIVED : fm.stage || 'frame',
    owner: fm.owner || '',
  };
}

function listExplorations(ctx, { includeArchived = false } = {}) {
  const active = listDirs(ctx.explorationsDir).map((id) => readExploration(ctx, id));
  if (!includeArchived) return active;
  return active.concat(listDirs(ctx.archiveDir).map((id) => readExploration(ctx, id, true)));
}

function nextNumber(ctx) {
  const all = listDirs(ctx.explorationsDir).concat(listDirs(ctx.archiveDir));
  const max = all.reduce((acc, id) => Math.max(acc, parseInt(id, 10) || 0), 0);
  return String(max + 1).padStart(3, '0');
}

/** Accepts "003-checkout", "3", "003" or "checkout". */
function resolveExploration(ctx, ref, { includeArchived = false } = {}) {
  if (!ref) throw new UserError('Which exploration? Pass its id, e.g. "d2s status 001".');
  const all = listExplorations(ctx, { includeArchived });
  const r = String(ref).trim();
  let matches = all.filter((e) => e.id === r);
  if (!matches.length && /^\d+$/.test(r)) matches = all.filter((e) => parseInt(e.id, 10) === parseInt(r, 10));
  if (!matches.length) matches = all.filter((e) => e.id.replace(/^\d+-/, '') === r);
  if (!matches.length) {
    throw new UserError(`No exploration matches "${r}". Run "d2s status" to see them.`);
  }
  if (matches.length > 1) {
    throw new UserError(`"${r}" matches more than one exploration: ${matches.map((e) => e.id).join(', ')}`);
  }
  return matches[0];
}

function stageIndex(stageId) {
  return STAGES.findIndex((s) => s.id === stageId);
}

// ---------- validation ----------

/**
 * Check one stage document against its template.
 * Every `## ` section in the template is required unless marked (optional).
 */
function checkStageDoc(ctx, exp, stage) {
  const errors = [];
  const warnings = [];
  const file = path.join(exp.dir, stage.file);
  const rel = path.relative(ctx.root, file);
  if (!exists(file)) {
    errors.push(`${rel}: file is missing`);
    return { errors, warnings };
  }
  if (stage.id === 'handoff') return { errors, warnings }; // generated

  const text = readText(file);
  const body = parseFrontMatter(text).body;
  const leftover = stripComments(body).match(/\{\{\w+\}\}/g);
  if (leftover) errors.push(`${rel}: unfilled placeholder ${[...new Set(leftover)].join(', ')}`);

  const docSections = parseSections(body);
  const templateSections = parseSections(parseFrontMatter(getTemplate(ctx, stage.template)).body);
  for (const t of templateSections) {
    if (t.optional) continue;
    const s = findSection(docSections, t.heading);
    if (!s) errors.push(`${rel}: missing section "${t.heading}"`);
    else if (!s.content) errors.push(`${rel}: section "${t.heading}" is empty`);
  }

  if (stage.id === 'options' && figmaLinks(body).length === 0) {
    warnings.push(`${rel}: no Figma links yet — link each direction to its frames`);
  }
  if (stage.id === 'spec') {
    const criteria = findSection(docSections, KEY_SECTIONS[ctx.lang].criteria);
    if (criteria && criteria.content && !/(given|בהינתן)/i.test(criteria.content)) {
      warnings.push(`${rel}: acceptance criteria are easier to test as Given / When / Then`);
    }
  }
  return { errors, warnings };
}

/**
 * Check an exploration. Stages already passed must be complete (errors).
 * The current stage is work in progress: its gaps are warnings unless `strict`.
 */
function checkExploration(ctx, exp, { strict = false } = {}) {
  const errors = [];
  const warnings = [];
  if (exp.archived) return { errors, warnings };
  const current = stageIndex(exp.stage);
  if (current < 0) {
    errors.push(`${exp.id}: unknown stage "${exp.stage}" in brief.md`);
    return { errors, warnings };
  }
  STAGES.forEach((stage, i) => {
    if (i > current) return;
    const r = checkStageDoc(ctx, exp, stage);
    if (i < current || strict) errors.push(...r.errors);
    else warnings.push(...r.errors.map((e) => `${e} (in progress)`));
    warnings.push(...r.warnings);
  });
  return { errors, warnings };
}

module.exports = {
  PKG_ROOT,
  CONFIG_FILE,
  LANGS,
  STAGES,
  ARCHIVED,
  KEY_SECTIONS,
  UserError,
  exists,
  readText,
  writeText,
  writeFileSafe,
  render,
  today,
  slugify,
  parseFrontMatter,
  setFrontMatterField,
  stripComments,
  parseSections,
  findSection,
  sectionContent,
  firstParagraph,
  figmaLinks,
  findRoot,
  loadContext,
  getTemplate,
  packagedTemplate,
  listExplorations,
  readExploration,
  nextNumber,
  resolveExploration,
  stageIndex,
  checkStageDoc,
  checkExploration,
};
