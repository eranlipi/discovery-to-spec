# discovery-to-spec

**A free, repo-native workflow for design and product teams.** Every feature moves through six short Markdown documents, from the problem to a spec developers (and coding agents) can build from, with a human decision gate in the middle.

```
frame → research → options → decide → spec → handoff
```

**Website and in-browser sandbox:** [discoverytospec.com](https://discoverytospec.com)

> Status: v0.5.0, early. It works end to end and has tests, but expect changes. Feedback and issues are very welcome.

## Why

AI coding tools made building fast. What's slow now is everything before it: framing the problem, understanding users, choosing a direction and getting everyone to agree. Spec-driven tools like [OpenSpec](https://github.com/Fission-AI/OpenSpec) start once you already know the change you want. discovery-to-spec covers the part before that, and hands off a spec at the end.

## What you get

- **A `design/` folder in your repository**, with one folder per feature ("exploration") and one short document per stage.
- **A decision gate.** `d2s next` won't move an exploration forward until the current document is complete. The decision passes only with one line per approver (name, role and date) covering product, design and engineering. Placeholders like "TBD" and AI tool names are rejected, and CI can check each approval against a GitHub review.
- **A decision log** (`design/decisions.md`) that fills itself, so nobody re-argues a decision six months later.
- **A generated handoff** with the chosen direction, its Figma links and the acceptance criteria in one place. Rejected directions stay out. If your repo uses OpenSpec, it also drafts an OpenSpec change proposal.
- **A one-page summary for design and product** (`summary.md`), generated with the handoff: the problem, what you learned, what you decided and why, what you didn't choose, who approved, and what's being built.
- **Agent skills** for Claude Code and Cursor (`/d2s-frame` … `/d2s-handoff`), plus an `AGENTS.md` section for other agents. Agents help write and summarize; they're told never to invent research and never to approve decisions.
- **An optional CI check** for pull requests.

See [`examples/checkout`](examples/checkout) for a complete, fictional feature that went through all six stages, or try the whole flow in the [sandbox on the website](https://discoverytospec.com/#sandbox). It runs the real CLI in your browser.

## Free and safe to adopt

- MIT license, no paid tier.
- **Zero dependencies** and no telemetry. The CLI makes no network calls, except an opt-in CI check that asks GitHub who approved a pull request. The CLI is about 1,200 lines of plain Node.js you can review in an afternoon.
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

To pin a version, install a tag: `npm i -D github:eranlipi/discovery-to-spec#v0.5.0`.

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
| 6. Handoff | `handoff.md`, `summary.md` | Generated: a handoff for development, and a one-page summary for design and product | Engineering, design and product |

The structure borrows from Shape Up (appetite, no-gos), continuous discovery (evidence-based insights) and architecture decision records.

## Commands

| Command | What it does |
| --- | --- |
| `d2s init` | Creates the design folder, templates, agent skills and config. Options: `--lang en\|he`, `--dir`, `--agents claude,cursor,agents-md\|none`, `--cli`, `--ci`, `--force` |
| `d2s new "<title>"` | Starts an exploration. Options: `--slug`, `--owner` |
| `d2s status [id]` | Lists explorations, or shows one stage by stage. `--all` includes archived ones |
| `d2s check [id]` | Validates documents and exits with 1 on errors. Stages already passed must be complete; the current one may be in progress (`--strict` requires it too). `--verify-approvals` checks approvals against GitHub reviews (see below) |
| `d2s next <id>` | Validates the current stage and opens the next one. Passing the decision adds a row to the decision log; passing the spec generates the handoff and the summary |
| `d2s handoff <id>` | Regenerates the handoff and the summary (and the OpenSpec draft). `--openspec` forces the draft |
| `d2s archive <id>` | Moves a built exploration to `explorations/archive/` |

An id can be the folder name (`003-checkout`), its number (`3`) or its slug (`checkout`).

## The decision gate

"Approved by" in `decision.md` takes one line per person: name, role, date, and optionally a GitHub handle.

```markdown
## Approved by
- Dana Levi, design, 2026-11-20, @danalevi
- Omer Cohen, product, 2026-11-20, @omerc
- Yael Bar, engineering, 2026-11-21, @yaelbar
```

`d2s next` refuses to pass the decision when:

| Rule | Fails when | Message |
| --- | --- | --- |
| Format | A line isn't name, role, date | "Approved by" needs one line per person: name, role, date |
| No placeholders | A line is TBD, TODO, N/A, ?, pending, or a Hebrew equivalent | "TBD" is not an approval. Add the people who approved |
| Required roles | A role from the config has no line | Missing approval from: engineering |
| People only | A name is an AI tool or an agent (Claude, Copilot, Cursor, ChatGPT, Gemini…) | Only people approve. Remove "Claude" |
| Different people | One person fills two roles, unless the config allows it | Dana Levi is listed for two roles |

Roles can be written in English or Hebrew (`product`/`מוצר`, `design`/`עיצוב`, `engineering`/`פיתוח`), with common variants like "PM", "UX" or "engineering lead". Hebrew repos get the messages in Hebrew.

The rules live in `.d2s.json`. Teams of two or three set `allowSamePerson` to `true`.

```json
{
  "approvals": {
    "roles": ["product", "design", "engineering"],
    "allowSamePerson": false,
    "verify": "none"
  }
}
```

**Verifying approvals on GitHub.** Set `verify` to `"github-pr"` and every line needs a GitHub handle. In CI, `d2s check --verify-approvals` then asks the GitHub API whether each listed handle approved the pull request, and fails on any line without a matching approval. It only looks at explorations whose `decision.md` the pull request changes. This is the only time d2s uses the network. With `verify` at `"none"`, the flag does nothing.

**Upgrading from 0.1.** Passing the gate now records a `decided` date in `brief.md`. Decisions that passed before the upgrade have no date, so `d2s check` shows their free-text approvals as warnings, not errors, and CI keeps passing.

## Designers don't need a terminal

Every document is plain Markdown. Designers and product managers can edit files on github.com (the pencil icon), or write in Figma or a doc and have someone paste it in. The `<!-- -->` notes in the templates are guidance and don't count as content. The one rule: keep the `##` headings, because the check looks for them.

The [sandbox on the website](https://discoverytospec.com/#sandbox) opens on a **Designer view**: each stage is a form with one field per `##` heading, the template's note as helper text, and a **Next stage** button that runs the real gate and shows each gap next to its field. It writes the same Markdown the CLI does; **Show the file** reveals it. The [Figma plugin](figma-plugin/README.md) brings the same form into Figma: attach selected frames, pass the gate and save to GitHub without leaving the canvas.

## The d2s assistant in Claude, ChatGPT or Gemini (no terminal)

Designers and product managers who work in a chat assistant, not in a terminal, can add the **d2s assistant** to the one they already use. The [website](https://discoverytospec.com/#assistant) has the steps and a copy button for each:

- **Claude:** upload the `d2s-discovery` skill once (Customize → Skills), or paste the instructions into a Project.
- **ChatGPT:** paste the instructions into a Project. On Business and Enterprise plans, a Skill works too.
- **Gemini:** create a skill (Skills → Create → Create manually) and paste the description and the instructions.

In an ordinary chat, the assistant then helps them:
- frame the problem, pushing back when the request is a solution;
- turn raw interview notes into insights with evidence and confidence;
- lay out genuinely different directions;
- prepare the decision;
- write the spec.

Each stage ends with a document that has the team's headings. **Paste from AI** in the Figma plugin or the website sandbox fills the stage's fields from it, and the gate checks it as usual. Setup is in [integrations/claude-app/README.md](integrations/claude-app/README.md). The skill and the plain instructions are attached to each release.

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

`d2s init --ci` adds `.github/workflows/d2s-check.yml`, which runs `d2s check --verify-approvals` on pull requests that touch the design folder, and again when a review is submitted. Approvals are only checked against GitHub if `.d2s.json` sets `approvals.verify` to `"github-pr"`.

## Languages

Templates ship in English (default) and Hebrew (`--lang he`, right to left). The CLI's own messages are in English. To add a language, see [CONTRIBUTING.md](CONTRIBUTING.md).

## Customizing

- **Templates:** edit `design/templates/*.md` in your repo. Every `##` heading is required unless it ends with `(optional)`.
- **Config:** `.d2s.json` holds `lang`, `dir`, `cli` (the command the generated docs and skills use) and `approvals` (see [the decision gate](#the-decision-gate)).
- The handoff reads a few headings by name: the problem, open questions, chosen direction, approved by and acceptance criteria. Keep those if you rename others.

## Roadmap

- A GitHub Action, so explorations can be started and advanced from the Actions tab with no terminal at all.
- The Figma plugin's next steps: sign-in with a GitHub App, a pull request per exploration, and approvals as verified reviews.
- GitHub issue forms for opening a brief without touching files.
- Publishing to npm.
- More languages.

## Website

The site lives in [`site/`](site). It's a single static page built with zero dependencies, and its sandbox runs this repository's CLI in the browser, with a Designer view (forms) and a Developer view (a terminal). `npm run site` builds it into `site/dist`. See [site/README.md](site/README.md) for deploying to Cloudflare Pages.

## Contributing

Issues and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
