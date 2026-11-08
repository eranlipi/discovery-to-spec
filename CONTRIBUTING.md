# Contributing

Thanks for helping. discovery-to-spec is meant to stay small, so the bar for new features is "does this make the workflow clearer for design and product teams?".

## Ground rules

- **No runtime dependencies.** Plain Node.js 18+ and its standard library only. This keeps the tool easy to audit and safe to adopt in companies.
- **No network calls and no telemetry.** The CLI only reads and writes files inside the user's repository.
- **The `##` headings in the templates are part of the contract.** `d2s check` and the handoff rely on them. Changing a heading is a breaking change for teams that already have documents.
- **Agents never approve.** Skills may help write and summarize, but must never fill in "approved by" or invent research.

## Development

```bash
git clone https://github.com/eranlipi/discovery-to-spec
cd discovery-to-spec
npm test                      # node:test, no install needed
node bin/d2s.js help
```

To try the CLI on a scratch repo:

```bash
mkdir /tmp/try && cd /tmp/try
node /path/to/discovery-to-spec/bin/d2s.js init
node /path/to/discovery-to-spec/bin/d2s.js new "Something to explore"
```

## Project layout

| Path | What it is |
| --- | --- |
| `bin/d2s.js` | CLI entry point |
| `src/cli.js` | Commands and output |
| `src/lib.js` | Front matter, section parsing, validation, explorations |
| `templates/<lang>/` | Stage templates, plus the design folder's README, context and decision log |
| `integrations/skills/` | Agent skills (rendered into `.claude/skills/` and `.cursor/commands/`) |
| `integrations/agents-md.md` | The block added to `AGENTS.md` |
| `integrations/ci/` | The optional GitHub Actions check |
| `examples/checkout/` | A complete, fictional exploration |
| `site/` | The website, including the in-browser sandbox |
| `test/` | Tests (including a build of the site) |

## Adding a language

1. Copy `templates/en/` to `templates/<lang>/` and translate every file. Keep the `{{placeholders}}` and the `(optional)` markers (the word "optional" in your language works too if you add it to `OPTIONAL_RE` in `src/lib.js`).
2. Add the language to `LANGS` and its key headings to `KEY_SECTIONS` in `src/lib.js`.
3. Add a test that runs a full exploration in that language (see the Hebrew test in `test/cli.test.js`).

## Pull requests

- Keep changes focused, and add or update tests.
- Run `npm test` before opening the PR.
- Describe the problem the change solves for a team, not only what the code does.
