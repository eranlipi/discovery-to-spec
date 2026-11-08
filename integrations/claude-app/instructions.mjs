// The d2s assistant's instructions, as plain text for any chat assistant
// (a Claude Project, a ChatGPT Project, a Gemini skill).
// The single source is the Claude skill's SKILL.md: its body, without the
// front matter and without the pointers to the skill's own template files.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const SKILL_NAME = 'd2s-discovery';
// Kept under 8,000 characters: some apps cap their instructions fields, and the caps aren't all published.
export const MAX_CHARS = 8000;

export function readSkill() {
  return fs.readFileSync(path.join(HERE, SKILL_NAME, 'SKILL.md'), 'utf8');
}

/** The skill's one-paragraph description, for apps that ask for one (Gemini skills: up to 1,024 characters). */
export function assistantDescription(skill = readSkill()) {
  const m = /^description:\s*(.+)$/m.exec(skill);
  return m ? m[1].trim() : '';
}

export function assistantInstructions(skill = readSkill()) {
  const fm = /^---\n[\s\S]*?\n---\n/.exec(skill);
  const body = (fm ? skill.slice(fm[0].length) : skill).trim();
  const text =
    body
      .replace(/^- \*\*Full templates:\*\*.*\n/m, '')
      .replace(/Template(?: with guidance notes)?: `assets\/[^`]+` or `assets\/[^`]+`\. /g, '') + '\n';
  if (text.length > MAX_CHARS) throw new Error(`The assistant instructions are ${text.length} characters; keep them under ${MAX_CHARS}.`);
  return text;
}
