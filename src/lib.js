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

// Roles that approve at the decision gate. The key is what .d2s.json uses; the
// aliases are what people write in decision.md, in either language.
const ROLES = {
  product: { en: 'product', he: 'מוצר', aliases: ['product', 'pm', 'product management', 'מוצר', 'ניהול מוצר'] },
  design: { en: 'design', he: 'עיצוב', aliases: ['design', 'ux', 'designer', 'עיצוב', 'מעצב', 'מעצבת'] },
  engineering: {
    en: 'engineering',
    he: 'פיתוח',
    aliases: ['engineering', 'eng', 'dev', 'development', 'engineer', 'פיתוח', 'הנדסה', 'מפתח', 'מפתחת'],
  },
};
const DEFAULT_APPROVALS = { roles: ['product', 'design', 'engineering'], allowSamePerson: false, verify: 'none' };

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
  const approvals = { ...DEFAULT_APPROVALS, ...(config.approvals || {}) };
  if (!Array.isArray(approvals.roles)) approvals.roles = DEFAULT_APPROVALS.roles;
  return {
    root,
    config: { ...config, lang, dir, cli: config.cli || 'npx d2s', approvals },
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
    decided: fm.decided || '',
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

// ---------- approvals ----------
//
// "Approved by" holds one line per person: name, role, date, and an optional
// GitHub handle. A name typed into a field is not an approval, so the gate
// rejects placeholders, AI tools and missing roles.

const PLACEHOLDER_WORDS = new Set([
  'tbd', 'tbc', 'todo', 'n/a', 'pending', 'unknown', '?', '??', '???',
  'טרם', 'ממתין', 'ממתינה', 'ממתינים', 'יעודכן', 'בהמשך', 'להשלים',
]);
const PLACEHOLDER_PHRASES = ['to be decided', 'to be confirmed', 'טרם נקבע', 'לא ידוע', 'לא רלוונטי', 'יוחלט בהמשך'];
const AGENT_RE = /\b(claude code|chatgpt|gpt(?:-?\d[\w.]*)?|copilot|gemini|cursor|codex|openai|anthropic|llm|agent|bot)\b|\((?:ai|bot)\)|(^|\s)(סוכן|בוט)(\s|$)/i;
const AGENT_NAMES = new Set(['claude', 'ai', 'בינה מלאכותית']);
const AGENT_HANDLE_RE = /\[bot\]$|^@(claude|copilot|cursor|chatgpt|gemini|codex|openai)\b/i;
const HANDLE_RE = /^@[A-Za-z0-9][A-Za-z0-9-]{0,38}(\[bot\])?$/;

const APPROVAL_TEXT = {
  en: {
    format: (h, line) => `"${h}" needs one line per person: name, role, date (check "${line}")`,
    placeholder: (word) => `"${word}" is not an approval. Add the people who approved`,
    missing: (roles) => `Missing approval from: ${roles}`,
    agent: (name) => `Only people approve. Remove "${name}"`,
    twice: (name) => `${name} is listed for two roles`,
    handle: (name) => `${name} needs a GitHub handle (like @name), so the approval can be verified`,
    notApproved: (handle) => `${handle} has not approved this pull request on GitHub`,
    legacy: ' (approved before d2s 0.2.0: use the new format next time you edit it)',
  },
  he: {
    format: (h, line) => `ב"${h}" צריך שורה לכל אדם: שם, תפקיד, תאריך (בדקו את "${line}")`,
    placeholder: (word) => `"${word}" הוא לא אישור. כתבו מי אישר`,
    missing: (roles) => `חסר אישור של: ${roles}`,
    agent: (name) => `רק אנשים מאשרים. הסירו את "${name}"`,
    twice: (name) => `השם ${name} מופיע בשני תפקידים`,
    handle: (name) => `חסר שם משתמש ב-GitHub ל-${name} (כמו @name), ולכן אי אפשר לאמת את האישור`,
    notApproved: (handle) => `אין עדיין אישור של ${handle} ל-pull request הזה ב-GitHub`,
    legacy: ' (אושר לפני d2s 0.2.0: עדכנו לפורמט החדש בעריכה הבאה)',
  },
};

function approvalText(lang) {
  return APPROVAL_TEXT[lang] || APPROVAL_TEXT.en;
}

/** "Design lead", "עיצוב" and "UX" all mean the design role. Unknown roles come back as written. */
function roleKey(text) {
  const r = String(text)
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s+(lead|manager|owner|director|head)$/, '')
    .replace(/^(head of|ראש צוות|ראש|מנהל|מנהלת)\s+/, '');
  for (const [key, role] of Object.entries(ROLES)) if (role.aliases.includes(r)) return key;
  return r;
}

function roleLabel(key, lang) {
  return ROLES[key] ? ROLES[key][lang] || ROLES[key].en : key;
}

function isDate(text) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const d = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === text;
}

/** Each non-empty line of "Approved by" as { name, role, roleKey, date, handle, ok }. */
function parseApprovalLines(content) {
  return stripComments(content)
    .split(/\r?\n/)
    .map((l) => l.trim().replace(/^([-*+]|\d+[.)])\s+/, '').trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/\s*,\s*/);
      const [name = '', role = '', date = '', handle = ''] = parts;
      const ok =
        (parts.length === 3 || parts.length === 4) &&
        !!name &&
        !!role &&
        isDate(date) &&
        (parts.length === 3 || HANDLE_RE.test(handle));
      return { line, name, role, roleKey: roleKey(role), date, handle: parts.length === 4 ? handle : '', ok };
    });
}

function formatApprovalLine({ name, role, date, handle }) {
  return `- ${[name, role, date, handle].map((s) => String(s || '').replace(/[,\n]/g, ' ').trim()).filter(Boolean).join(', ')}`;
}

function placeholderIn(text) {
  const lower = text.toLowerCase();
  for (const p of PLACEHOLDER_PHRASES) {
    const i = lower.indexOf(p);
    if (i >= 0) return text.slice(i, i + p.length);
  }
  return text.split(/[\s,;:()[\]"'.]+/).find((w) => PLACEHOLDER_WORDS.has(w.toLowerCase())) || '';
}

function agentIn(entry) {
  const name = entry.name.replace(/\s+/g, ' ').trim();
  if (AGENT_NAMES.has(name.toLowerCase()) || AGENT_RE.test(name)) return name;
  if (entry.handle && AGENT_HANDLE_RE.test(entry.handle)) return entry.handle;
  if (!entry.ok) {
    // A free-text line: name the tool it mentions, if any.
    const m = entry.line.match(/\bclaude\b/i) || entry.line.match(AGENT_RE);
    if (m) return m[0].trim();
  }
  return '';
}

/**
 * Validate the content of "Approved by". Returns plain-language problems.
 * `settings` is .d2s.json's `approvals` plus `lang` and the section `heading`.
 */
function checkApprovals(content, settings) {
  const s = { ...DEFAULT_APPROVALS, ...settings };
  const t = approvalText(s.lang);
  const problems = [];
  const valid = [];
  for (const e of parseApprovalLines(content)) {
    const word = placeholderIn(e.line);
    const agent = word ? '' : agentIn(e);
    if (word) problems.push(t.placeholder(word));
    else if (agent) problems.push(t.agent(agent));
    else if (!e.ok) problems.push(t.format(s.heading || KEY_SECTIONS[s.lang === 'he' ? 'he' : 'en'].approvedBy, e.line));
    else {
      if (s.verify === 'github-pr' && !e.handle) problems.push(t.handle(e.name));
      valid.push(e);
    }
  }
  if (problems.length) return problems;

  const have = new Set(valid.map((e) => e.roleKey));
  const missing = s.roles.map(roleKey).filter((r) => !have.has(r));
  if (missing.length) problems.push(t.missing(missing.map((r) => roleLabel(r, s.lang)).join(', ')));

  if (!s.allowSamePerson) {
    const roles = new Map();
    for (const e of valid) {
      const key = e.name.toLowerCase().replace(/\s+/g, ' ');
      if (!roles.has(key)) roles.set(key, { name: e.name, roles: new Set() });
      roles.get(key).roles.add(e.roleKey);
    }
    for (const p of roles.values()) if (p.roles.size > 1) problems.push(t.twice(p.name));
  }
  return problems;
}

// ---------- validation ----------

/**
 * Check one stage document against its template.
 * Every `## ` section in the template is required unless marked (optional).
 * Returns `errors` and `warnings` as printable lines, and `issues` with the
 * section each problem belongs to, for interfaces that show it next to a field.
 * `legacyApprovals` turns approval-format problems into warnings, for decisions
 * that passed the gate before d2s 0.2.0.
 */
function checkStageDoc(ctx, exp, stage, { legacyApprovals = false } = {}) {
  const issues = [];
  const add = (level, section, code, message) => issues.push({ level, section, code, message });
  const file = path.join(exp.dir, stage.file);
  const rel = path.relative(ctx.root, file);
  const result = () => ({
    errors: issues.filter((i) => i.level === 'error').map((i) => `${rel}: ${i.message}`),
    warnings: issues.filter((i) => i.level === 'warning').map((i) => `${rel}: ${i.message}`),
    issues,
  });
  if (!exists(file)) {
    add('error', null, 'file', 'file is missing');
    return result();
  }
  if (stage.id === 'handoff') return result(); // generated

  const text = readText(file);
  const body = parseFrontMatter(text).body;
  const leftover = stripComments(body).match(/\{\{\w+\}\}/g);
  if (leftover) add('error', null, 'placeholder', `unfilled placeholder ${[...new Set(leftover)].join(', ')}`);

  const docSections = parseSections(body);
  const templateSections = parseSections(parseFrontMatter(getTemplate(ctx, stage.template)).body);
  for (const t of templateSections) {
    if (t.optional) continue;
    const s = findSection(docSections, t.heading);
    if (!s) add('error', t.heading, 'missing', `missing section "${t.heading}"`);
    else if (!s.content) add('error', t.heading, 'empty', `section "${t.heading}" is empty`);
  }

  if (stage.id === 'options' && figmaLinks(body).length === 0) {
    add('warning', null, 'figma', 'no Figma links yet — link each direction to its frames');
  }
  if (stage.id === 'decide') {
    const heading = KEY_SECTIONS[ctx.lang].approvedBy;
    const s = findSection(docSections, heading);
    if (s && s.content) {
      const settings = { ...(ctx.config.approvals || {}), lang: ctx.lang, heading };
      for (const message of checkApprovals(s.content, settings)) {
        if (legacyApprovals) add('warning', heading, 'approval', message + approvalText(ctx.lang).legacy);
        else add('error', heading, 'approval', message);
      }
    }
  }
  if (stage.id === 'spec') {
    const criteria = findSection(docSections, KEY_SECTIONS[ctx.lang].criteria);
    if (criteria && criteria.content && !/(given|בהינתן)/i.test(criteria.content)) {
      add('warning', criteria.heading, 'criteria', 'acceptance criteria are easier to test as Given / When / Then');
    }
  }
  return result();
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
    // Decisions that passed the gate before 0.2.0 carry no "decided" date; their approvals only warn.
    const legacyApprovals = stage.id === 'decide' && i < current && !exp.decided;
    const r = checkStageDoc(ctx, exp, stage, { legacyApprovals });
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
  ROLES,
  DEFAULT_APPROVALS,
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
  roleKey,
  roleLabel,
  approvalText,
  parseApprovalLines,
  formatApprovalLine,
  checkApprovals,
  checkStageDoc,
  checkExploration,
};
