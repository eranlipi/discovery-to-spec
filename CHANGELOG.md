# Changelog

## 0.6.1 (2026-11-12)

On npm.

- **Published to npm** as [`discovery-to-spec`](https://www.npmjs.com/package/discovery-to-spec). Install it with `npm i -D discovery-to-spec`, `pnpm add -D discovery-to-spec` or `yarn add -D discovery-to-spec`, or run it once with `npx discovery-to-spec init`. Installing from GitHub still works.
- When the tool isn't installed in the project, `d2s init` now writes `npx discovery-to-spec` as the command, instead of `npx github:eranlipi/discovery-to-spec`. Repositories set up earlier keep their command; change `"cli"` in `.d2s.json` to switch.
- The CI check that `d2s init --ci` writes installs dependencies with pnpm or yarn when the project has their lockfile, not always `npm ci`.

## 0.6.0 (2026-11-09)

One flow for product managers, and documents that ask how a feature fits the product.

### A discovery session in the d2s assistant

- **New: a discovery session.** When someone brings a new request, the assistant in Claude, ChatGPT or Gemini offers to take it through Frame, Research and Options in one conversation, instead of three chats and three pastes:
  - it frames the problem, pushing back on solution-first requests, and asks where the feature lives in the product today, with links to the current screens;
  - it asks for whatever evidence exists and writes insights with evidence and confidence. With none, it says so plainly and leaves Research short, so the gate stops there;
  - it drafts 2 to 4 genuinely different directions in words, each with what changes in the product, and leaves their Figma links to design;
  - it ends with one document: `# Frame`, `# Research` and `# Options` (in Hebrew `# מסגור`, `# חקר`, `# כיוונים`), each followed by the stage's headings.
- It never invents quotes, numbers or Figma links, and it stops before Decide: approvals stay with people. The single-stage flow is unchanged.
- Paste your `design/context.md` into the chat, and the assistant works from your product, users, design principles and design system.

### Paste from AI takes the whole session

- In the Figma plugin and the website sandbox, **Paste from AI** recognizes a session's document by its stage headings, in English or Hebrew, and fills the stages in turn: the current stage first, then the real gate, then the next stage while the gate passes.
- It stops at Options: filled but never passed, so design can add the frames and review it. It never fills or passes Decide.
- When a gate stops it, the gaps show next to their fields as before. The parts not used yet wait as a local draft ("Options is waiting until Research passes") and are offered again once that stage passes.
- In the plugin, the whole paste is saved as one commit, such as "001-checkout: Frame, Research and Options drafted by Dana via d2s plugin".
- A document for one stage pastes exactly as before.

### How a feature fits the product

- **brief.md** has a new required section, **Where it lives today** (in Hebrew, איפה זה חי היום): the screens and flows it touches today, with links to the current Figma frames, and what users do there. For a brand-new area, "New area, nothing exists yet" is enough.
- **options.md** asks each direction what changes in the product: the screens that change, the design-system components it reuses, new components, and the effect on other flows.
- **spec.md**: **Existing components** is now required.
- **context.md** says the assistant and agents read it for every feature, and asks for links to the Figma library, Storybook and tokens.
- The summary for design and product shows where the feature lives today.
- The Claude Code skills ask the new questions and read `design/context.md`. With the Figma MCP server connected, they read the current screens and the design-system library and prefer existing components.

### Upgrading from 0.5.0

- **Run `d2s init --force`** to get the new templates. It now refreshes the templates, `design/README.md` and `design/context.md` that you haven't changed, and keeps the ones you have, listing the sections to add to them by hand.
- Explorations that passed Frame or Spec before the upgrade don't have the new sections. `d2s check` shows them as warnings, not errors, so CI keeps passing. The stage an exploration is at, and every new exploration, need them to pass the gate.
- To paste whole sessions in Figma, import the new plugin zip below. For the discovery session, upload the new skill zip to Claude, or copy the new instructions into your ChatGPT project or Gemini skill.

## 0.5.0 (2026-11-08)

The d2s assistant, in Claude, ChatGPT or Gemini.

### On the website

- **A new section, "An AI assistant for the thinking",** explains what the assistant does and how to add it to the chat assistant a designer already uses. Each tool has its own tab with steps and a copy button:
  - **Claude:** upload the `d2s-discovery` skill once, or paste the instructions into a Project.
  - **ChatGPT:** paste the instructions into a Project. This works on every plan. On Business and Enterprise, a Skill works too.
  - **Gemini:** create a skill and paste the description and the instructions, then call it with `/`.
- **Try it right away:** a button copies sample raw interview notes (Hebrew or English) to paste into the assistant.
- The instructions can also be read on the page before copying.

### One assistant, three tools

- **The instructions now work in any assistant.** The document ends with "choose **Paste from AI**", not a Claude-only line.
- **Paste from Claude is now Paste from AI** (in Hebrew, הדבקה מ-AI), in the Figma plugin and the website sandbox. Documents with the old closing line still paste cleanly.
- **New release file:** `d2s-assistant-instructions.md` replaces `project-instructions.md`. It is the same method as plain text, kept under 8,000 characters.

### Why not custom GPTs or Gems

- Custom GPTs can no longer be created on personal ChatGPT plans, and Gemini Gems are being retired. ChatGPT Projects and Gemini skills are the paths that keep working.

### Upgrading from 0.4.0

- **Nothing to change.** To get the new button name in Figma, import the new plugin zip below. A skill already uploaded to Claude keeps working; upload the new zip to get the new closing line.

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
