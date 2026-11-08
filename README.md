# discovery-to-spec

**A free, repo-native workflow for design and product teams.** Every feature moves through six short Markdown documents, from the problem to a spec developers (and coding agents) can build from, with a human decision gate in the middle.

```
frame → research → options → decide → spec → handoff
```

**Website and in-browser sandbox:** [discoverytospec.com](https://discoverytospec.com)

> Status: v0.1.0, early. It works end to end and has tests, but expect changes. Feedback and issues are very welcome.

## Why

AI coding tools made building fast. What's slow now is everything before it: framing the problem, understanding users, choosing a direction and getting everyone to agree. Spec-driven tools like [OpenSpec](https://github.com/Fission-AI/OpenSpec) start once you already know the change you want. discovery-to-spec covers the part before that, and hands off a spec at the end.

## What you get

- **A `design/` folder in your repository**, with one folder per feature ("exploration") and one short document per stage.
- **A decision gate.** `d2s next` won't move an exploration forward until the current document is complete, and the decision can't pass without naming who approved it.
- **A decision log** (`design/decisions.md`) that fills itself, so nobody re-argues a decision six months later.
- **A generated handoff** with the chosen direction, its Figma links and the acceptance criteria in one place. Rejected directions stay out. If your repo uses OpenSpec, it also drafts an OpenSpec change proposal.
- **Agent skills** for Claude Code and Cursor (`/d2s-frame` … `/d2s-handoff`), plus an `AGENTS.md` section for other agents. Agents help write and summarize; they're told never to invent research and never to approve decisions.
- **An optional CI check** for pull requests.

See [`examples/checkout`](examples/checkout) for a complete, fictional feature that went through all six stages, or try the whole flow in the [sandbox on the website](https://discoverytospec.com/#sandbox). It runs the real CLI in your browser.

## Free and safe to adopt

- MIT license, no paid tier.
- **Zero dependencies**, no network calls, no telemetry. The tool is about 800 lines of plain Node.js you can review in an afternoon.
- No new accounts or licenses: it works with the GitHub repo and the Figma files you already have. The Figma MCP server and AI agents are optional.

## Install

Requires Node.js 18 or later. The package isn't on npm yet, so install it from GitHub.

```bash
# Recommended: add it to your project, so everyone runs the same version
npm i -D github:eranlipi/discovery-to-spec
npx d2s init

# Or run it once without adding it to the project
npx github:eranlipi/discovery-to-spec init

# No network access? Download or clone this repository, then
node path/to/discovery-to-spec/bin/d2s.js init
```

To pin a version, install a tag: `npm i -D github:eranlipi/discovery-to-spec#v0.1.0`.

## Quick start

```bash
npx d2s init                                    # once per repository
npx d2s new "Checkout drop-off on mobile"       # starts 001-checkout-drop-off-on-mobile
# fill design/explorations/001-checkout-drop-off-on-mobile/brief.md
npx d2s next 1                                  # passes the gate and opens insights.md
npx d2s status                                  # where every exploration stands
```

## The six stages

| Stage | Document | What it holds | Led by |
| --- | --- | --- | --- |
| 1. Frame | `brief.md` | The problem, who it matters to, desired outcome, appetite, no-gos | Product |
| 2. Research | `insights.md` | Insights with evidence and a confidence level | Design and product |
| 3. Options | `options.md` | 2 to 4 directions with Figma links, pros and cons | Design |
| 4. Decide | `decision.md` | The chosen direction, what was rejected and why, who approved | Product, design, engineering |
| 5. Spec | `spec.md` | Screens, states, edge cases, acceptance criteria, accessibility | Design |
| 6. Handoff | `handoff.md` | A generated summary for development | Engineering |

The structure borrows from Shape Up (appetite, no-gos), continuous discovery (evidence-based insights) and architecture decision records.

## Commands

| Command | What it does |
| --- | --- |
| `d2s init` | Creates the design folder, templates, agent skills and config. Options: `--lang en\|he`, `--dir`, `--agents claude,cursor,agents-md\|none`, `--cli`, `--ci`, `--force` |
| `d2s new "<title>"` | Starts an exploration. Options: `--slug`, `--owner` |
| `d2s status [id]` | Lists explorations, or shows one stage by stage. `--all` includes archived ones |
| `d2s check [id]` | Validates documents and exits with 1 on errors. Stages already passed must be complete; the current one may be in progress (`--strict` requires it too) |
| `d2s next <id>` | Validates the current stage and opens the next one. Passing the decision adds a row to the decision log; passing the spec generates the handoff |
| `d2s handoff <id>` | Regenerates the handoff (and the OpenSpec draft). `--openspec` forces the draft |
| `d2s archive <id>` | Moves a built exploration to `explorations/archive/` |

An id can be the folder name (`003-checkout`), its number (`3`) or its slug (`checkout`).

## Designers don't need a terminal

Every document is plain Markdown. Designers and product managers can edit files on github.com (the pencil icon), or write in Figma or a doc and have someone paste it in. The `<!-- -->` notes in the templates are guidance and don't count as content. The one rule: keep the `##` headings, because the check looks for them.

## AI agents

`init` installs one skill per stage:

| Command | Helps with |
| --- | --- |
| `/d2s-frame` | Interviewing the requester and writing the brief, pushing back on solution-first requests |
| `/d2s-research` | Turning raw notes into insights with evidence, anonymizing personal data |
| `/d2s-options` | Laying out genuinely different directions |
| `/d2s-decide` | Preparing the decision meeting and recording the outcome (never the approval) |
| `/d2s-spec` | Going through every state and edge case and writing testable criteria |
| `/d2s-handoff` | Implementing from the spec, asking instead of guessing |

Claude Code reads them from `.claude/skills/`, Cursor from `.cursor/commands/`. Agents that read `AGENTS.md` (Codex, Copilot and others) get the shared rules. If the Figma MCP server is connected, the skills read the linked frames.

Only use AI tools your organization has approved, and don't paste internal information into free public AI tools.

## OpenSpec

If your repo has an `openspec/` folder, passing the spec stage also writes `openspec/changes/<slug>/proposal.md` with the problem, the chosen direction and links to the design docs. Continue from there with your OpenSpec workflow to add spec deltas and tasks.

## CI

`d2s init --ci` adds `.github/workflows/d2s-check.yml`, which runs `d2s check` on pull requests that touch the design folder.

## Languages

Templates ship in English (default) and Hebrew (`--lang he`, right to left). The CLI's own messages are in English. To add a language, see [CONTRIBUTING.md](CONTRIBUTING.md).

## Customizing

- **Templates:** edit `design/templates/*.md` in your repo. Every `##` heading is required unless it ends with `(optional)`.
- **Config:** `.d2s.json` holds `lang`, `dir` and `cli` (the command the generated docs and skills use).
- The handoff reads a few headings by name: the problem, open questions, chosen direction, approved by and acceptance criteria. Keep those if you rename others.

## Roadmap

- A GitHub Action, so explorations can be started and advanced from the Actions tab with no terminal at all.
- A Figma plugin to start an exploration and write the brief from inside Figma.
- GitHub issue forms for opening a brief without touching files.
- Publishing to npm.
- More languages.

## Website

The site lives in [`site/`](site). It's a single static page built with zero dependencies, and its sandbox runs this repository's CLI in the browser. `npm run site` builds it into `site/dist`. See [site/README.md](site/README.md) for deploying to Cloudflare Pages.

## Contributing

Issues and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
