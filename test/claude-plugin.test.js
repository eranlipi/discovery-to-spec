'use strict';

// The Claude Code plugin: the repository is its own marketplace, and the plugin's skills
// are the same files `d2s init` copies, so they must work without being rendered.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const json = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
const pkg = json('package.json');
const plugin = json('.claude-plugin/plugin.json');
const market = json('.claude-plugin/marketplace.json');
const SKILLS = path.join(ROOT, plugin.skills);
const skills = fs.readdirSync(SKILLS).filter((n) => n.startsWith('d2s-')).sort();

test('claude plugin: its version follows package.json', () => {
  assert.equal(plugin.name, pkg.name);
  assert.equal(plugin.version, pkg.version, 'bump .claude-plugin/plugin.json with package.json');
  assert.equal(plugin.license, pkg.license);
});

test('claude plugin: the marketplace lists this repository as the plugin', () => {
  assert.equal(market.plugins.length, 1);
  assert.equal(market.plugins[0].name, plugin.name);
  assert.equal(market.plugins[0].source, './');
});

test('claude plugin: ships every packaged skill', () => {
  assert.equal(path.resolve(SKILLS), path.join(ROOT, 'integrations', 'skills'));
  assert.deepEqual(skills, ['d2s-decide', 'd2s-explore', 'd2s-frame', 'd2s-handoff', 'd2s-options', 'd2s-research', 'd2s-spec']);
});

test('claude plugin: skills read cli and dir from .d2s.json instead of placeholders', () => {
  for (const name of skills) {
    const text = fs.readFileSync(path.join(SKILLS, name, 'SKILL.md'), 'utf8');
    assert.match(text, new RegExp(`^---\\nname: ${name}\\ndescription: `), `${name} has front matter`);
    assert.doesNotMatch(text, /\{\{\w+\}\}/, `${name} has no placeholders: a plugin installs it as is`);
    assert.match(text, /^Setup: `\.d2s\.json` at the repository root holds `cli`/m, `${name} explains <cli> and <dir>`);
    assert.match(text, /offer to run `npx discovery-to-spec init`/, `${name} handles a repository without d2s`);
  }
});
