# Changelog

## 0.4.0 (2026-11-08)

The thinking before the build, in the tools designers already use.

### d2s in the Claude app

- **New skill, `d2s-discovery`,** for claude.ai and Claude desktop. It brings the d2s method to people who work in chat, not in a terminal. Claude:
  - frames the problem, asking which problem a solution-first request solves;
  - turns raw interview notes, tickets and data into insights with evidence and confidence, anonymizing names and phone numbers;
  - lays out 2–4 genuinely different directions;
  - prepares the decision meeting;
  - writes the spec.
- **The same rules as the agent skills:** Claude never invents research, quotes, numbers or Figma links, and never fills in "Approved by".
- **Each stage ends with a document** that has the team's exact headings, in Hebrew or English.
- **Download:** `d2s-discovery-skill-v0.4.0.zip` is attached below, uploaded once in Claude under Customize → Skills. For plans without custom skills, `project-instructions.md` sets up the same thing as a Claude Project. Setup is in [integrations/claude-app/README.md](integrations/claude-app/README.md).

### Paste from Claude

- **Paste from Claude** in the Figma plugin and in the website sandbox fills the current stage's fields from a document written in Claude. Each `##` heading fills the field with the same name.
- A pasted document never fills "Approved by". Headings that match no field are listed, not lost.

### Upgrading from 0.3.1

- **Nothing to change.** To get Paste from Claude in Figma, import the new plugin zip below.

## 0.3.1 (2026-11-08)

Fixes found while preparing a live demo of the Figma plugin. Download `d2s-figma-plugin-v0.3.1.zip` below to get them in Figma.

- Fixed: clicking Next stage right after typing could show the next stage's empty fields as if the gate had stopped. The late check now stays quiet once the stage has passed, in the website sandbox and in the Figma plugin.
- Fixed: Hebrew commit messages from the plugin pointed the stage arrow the wrong way.
- The approval rows in the form explain themselves in plain words, instead of the template's line-format note.
- The summary for design and product leaves out optional sections that are empty, has no commands in it, and drops the repeated Figma list. Previews show Figma frame links as "Figma · 10-1".

## 0.3.0 (2026-11-08)

Designers can now work in Figma, and every exploration ends with a page for design and product.

### Figma plugin

A panel inside Figma (`figma-plugin/`) that runs the real d2s core on the design files in your GitHub repository:

- Start an exploration, fill each stage as a form, and pass the gate with Next stage. Gaps show next to their fields.
- Attach the frames selected on the canvas to any field. Each link gets a "Show on canvas" button that jumps to the frame, on any page. Explorations linked to the open file come first.
- Save sends your changes to GitHub as one commit. If someone else changed the same file, you choose: keep yours or take theirs. Unsaved drafts survive closing the panel.
- At the end: the summary for design and product, the handoff for developers, and a link to copy for developers.
- English and Hebrew (right to left), following the repository's templates.

It connects with a fine-grained GitHub token (Contents: Read and write on one repository) and talks only to `api.github.com`. Download `d2s-figma-plugin-v0.3.0.zip` below, unzip it, and in the Figma desktop app choose Plugins → Development → Import plugin from manifest. Details in [figma-plugin/README.md](figma-plugin/README.md).

This is the first version: approvals are typed names, and changes go straight to the chosen branch. Sign-in with a GitHub App, a pull request per exploration and verified approvals come next.

### A summary for design and product

- Passing the spec now writes `summary.md` next to `handoff.md`: the problem, who it matters to, the outcome, appetite and no-gos, what we learned, what we decided and why, what we didn't choose, risks, who approved, what's being built, Figma links and open questions. `d2s handoff` regenerates both.
- The website sandbox's last stage shows it as "For design and product", next to "For developers".

### Upgrading from 0.2.0

- Nothing to change. Existing repositories get the summary from the packaged template the next time an exploration passes the spec, or with `d2s handoff <id>`.
- To customize it, run `d2s init --force`, which adds `design/templates/summary.md` and keeps your settings.

## 0.2.0 (2026-11-08)

A real approval gate, and a way to run an exploration without a terminal.

### Approval gate

- "Approved by" now takes one line per person: name, role, date, and an optional GitHub handle. The gate rejects free text, placeholders ("TBD", "N/A", "טרם נקבע"…), AI tool names, missing roles and one person in two roles. Messages are in Hebrew for Hebrew templates.
- `.d2s.json` has a new `approvals` block: `roles` (default product, design, engineering), `allowSamePerson` and `verify`. `init --force` keeps it.
- `d2s check --verify-approvals` asks the GitHub API whether each listed handle approved the pull request, when `approvals.verify` is `"github-pr"`. It's the only network access in d2s, and it's off by default. The CI workflow now runs it, and runs again when a review is submitted.
- Passing the decision records a `decided` date in `brief.md`. Decisions that passed before 0.2.0 get warnings, not errors, so CI doesn't break on upgrade.
- The decision log lists approvers as "Name (role)".
- `d2s status` shortens the title column to fit the terminal.
- `d2s init --force` keeps the existing language, design folder and command instead of resetting them.

### Website

- Website for discoverytospec.com in `site/`, in English with a Hebrew option, and a sandbox that runs the real CLI in the browser.
- The sandbox opens on a Designer view: a stage rail, one form field per section with the template's guidance as helper text, a Next stage button that runs the real gate and shows each gap next to its field, structured approvals, a formatted handoff preview and a Show the file toggle. The form is a shared component (`site/src/stage-form.js`) for the planned Figma plugin.
- The terminal moved to a Developer tab, with fixes: suggestion chips keep their places, a newly opened file starts at the top, free text offers `d2s new "<text>"`, `help` lists the sandbox shortcuts, and `approve` writes valid approval lines (`approve TBD` shows the gate refusing it).

### Upgrading from 0.1.0

- Existing explorations keep working. Decisions that passed the gate before 0.2.0 show their free-text approvals as warnings in `d2s check`, not errors.
- Run `d2s init --force` (add `--ci` if you use the CI check) to refresh the agent skills and the workflow and add the `approvals` block to `.d2s.json`. It now keeps your language, folder and command; before 0.2.0 it reset them unless you passed the flags again.
- The next decision that passes the gate needs one line per approver, for example `- Dana Levi, design, 2026-11-20`.
- Releases are now published by `.github/workflows/release.yml`: merging a new `version` in `package.json` to `master` tags it and publishes its section of this file as the release notes.

## 0.1.0 (2026-11-08)

First release.

- `d2s init`, `new`, `status`, `check`, `next`, `handoff` and `archive`.
- Six stage templates in English and Hebrew, with a decision gate and an automatic decision log.
- Generated handoff with the chosen direction, its Figma links and the acceptance criteria; an OpenSpec draft proposal when the repo uses OpenSpec.
- Agent skills for Claude Code and Cursor, and an `AGENTS.md` block for other agents.
- Optional GitHub Actions check for pull requests.
- A complete fictional example in `examples/checkout`.
