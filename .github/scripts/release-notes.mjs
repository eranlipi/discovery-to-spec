// Prints the release notes for the version in package.json: its section of
// CHANGELOG.md, then how to install that version. Used by workflows/release.yml.
import fs from 'node:fs';

const { version } = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const lines = fs.readFileSync('CHANGELOG.md', 'utf8').split('\n');
const heading = new RegExp(`^## ${version.replace(/\./g, '\\.')}(\\s|$)`);
const start = lines.findIndex((l) => heading.test(l));
if (start < 0) {
  console.error(`CHANGELOG.md has no "## ${version}" section.`);
  process.exit(1);
}
let end = lines.findIndex((l, i) => i > start && /^## /.test(l));
if (end < 0) end = lines.length;
const body = lines.slice(start + 1, end).join('\n').trim().replace(/^### /gm, '## ');
const { name } = JSON.parse(fs.readFileSync('package.json', 'utf8'));
process.stdout.write(
  `${body}\n\n## Install\n\n\`\`\`bash\nnpm i -D ${name}@${version}   # or: pnpm add -D / yarn add -D\nnpx d2s init\n\`\`\`\n`,
);
