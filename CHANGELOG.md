# Changelog

## 0.2.0 (2026-11-08)

A real approval gate, and a way to run an exploration without a terminal.

### Approval gate

- "Approved by" now takes one line per person: name, role, date, and an optional GitHub handle. The gate rejects free text, placeholders ("TBD", "N/A", "טרם נקבע"…), AI tool names, missing roles and one person in two roles. Messages are in Hebrew for Hebrew templates.
- `.d2s.json` has a new `approvals` block: `roles` (default product, design, engineering), `allowSamePerson` and `verify`. `init --force` keeps it.
- `d2s check --verify-approvals` asks the GitHub API whether each listed handle approved the pull request, when `approvals.verify` is `"github-pr"`. It's the only network access in d2s, and it's off by default. The CI workflow now runs it, and runs again when a review is submitted.
- Passing the decision records a `decided` date in `brief.md`. Decisions that passed before 0.2.0 get warnings, not errors, so CI doesn't break on upgrade.
- The decision log lists approvers as "Name (role)".
- `d2s status` shortens the title column to fit the terminal.

### Website

- Website for discoverytospec.com in `site/`, in English with a Hebrew option, and a sandbox that runs the real CLI in the browser.
- The sandbox opens on a Designer view: a stage rail, one form field per section with the template's guidance as helper text, a Next stage button that runs the real gate and shows each gap next to its field, structured approvals, a formatted handoff preview and a Show the file toggle. The form is a shared component (`site/src/stage-form.js`) for the planned Figma plugin.
- The terminal moved to a Developer tab, with fixes: suggestion chips keep their places, a newly opened file starts at the top, free text offers `d2s new "<text>"`, `help` lists the sandbox shortcuts, and `approve` writes valid approval lines (`approve TBD` shows the gate refusing it).

## 0.1.0 (2026-11-08)

First release.

- `d2s init`, `new`, `status`, `check`, `next`, `handoff` and `archive`.
- Six stage templates in English and Hebrew, with a decision gate and an automatic decision log.
- Generated handoff with the chosen direction, its Figma links and the acceptance criteria; an OpenSpec draft proposal when the repo uses OpenSpec.
- Agent skills for Claude Code and Cursor, and an `AGENTS.md` block for other agents.
- Optional GitHub Actions check for pull requests.
- A complete fictional example in `examples/checkout`.
