// Packages the d2s-discovery skill for the Claude apps (claude.ai and Claude desktop):
//   dist/d2s-discovery/SKILL.md
//   dist/d2s-discovery/assets/{en,he}/<stage>.md   the stage templates, without front matter or title
//   dist/assistant-instructions.md                   the same method as plain instructions, for a Claude Project,
//                                                    a ChatGPT Project or a Gemini skill
// The release workflow zips dist/d2s-discovery. Zero dependencies: npm run claude-skill

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assistantInstructions } from './instructions.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const OUT = path.resolve(process.argv[2] || path.join(HERE, 'dist'));
const STAGES = ['brief', 'insights', 'options', 'decision', 'spec'];
const NAME = 'd2s-discovery';

const skill = fs.readFileSync(path.join(HERE, NAME, 'SKILL.md'), 'utf8');
const fm = /^---\n([\s\S]*?)\n---\n/.exec(skill);
if (!fm) throw new Error('SKILL.md needs front matter');
const name = /^name:\s*(.+)$/m.exec(fm[1])[1].trim();
const description = /^description:\s*(.+)$/m.exec(fm[1])[1].trim();
// The Claude apps' rules for a skill's front matter.
if (name !== NAME || !/^[a-z0-9-]{1,64}$/.test(name) || /claude|anthropic/.test(name)) throw new Error(`Invalid skill name "${name}"`);
if (!description || description.length > 1024 || /<[a-z]/i.test(description)) throw new Error('The description must be 1–1024 characters, without XML tags');

/** A stage template as the skill shows it: no front matter, no title line. */
function asset(lang, stage) {
  const text = fs.readFileSync(path.join(ROOT, 'templates', lang, `${stage}.md`), 'utf8');
  return text.replace(/^---\n[\s\S]*?\n---\n/, '').replace(/^\s*# .*\n+/, '').trimStart();
}

fs.rmSync(OUT, { recursive: true, force: true });
const dir = path.join(OUT, NAME);
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'SKILL.md'), skill);
for (const lang of ['en', 'he']) {
  fs.mkdirSync(path.join(dir, 'assets', lang), { recursive: true });
  for (const stage of STAGES) fs.writeFileSync(path.join(dir, 'assets', lang, `${stage}.md`), asset(lang, stage));
}
fs.writeFileSync(path.join(OUT, 'assistant-instructions.md'), assistantInstructions(skill));
console.log(`Built ${path.relative(ROOT, OUT)}: ${NAME}/ (SKILL.md and ${STAGES.length * 2} templates) and assistant-instructions.md`);
