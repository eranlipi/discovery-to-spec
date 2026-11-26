# discovery-to-spec: Claude Code plugin

Skills for the [discovery-to-spec](https://discoverytospec.com) design workflow. Every feature moves through six short Markdown documents in your repository, from the problem to a spec a coding agent can build from, with a human decision gate in the middle:

```
frame → research → options → decide → spec → handoff
```

## Install

Inside Claude Code:

```
/plugin install discovery-to-spec --marketplace eranlipi/discovery-to-spec
```

On Claude Code versions before 2.1.275, run `/plugin marketplace add eranlipi/discovery-to-spec` first, then `/plugin install discovery-to-spec@discovery-to-spec`.

## Skills

| Skill | What it helps with |
|---|---|
| `/discovery-to-spec:d2s-explore` | Thinking an idea through before committing to it. Reads earlier decisions, asks one question at a time, writes nothing without a yes |
| `/discovery-to-spec:d2s-frame` | Interviewing the requester and writing the brief |
| `/discovery-to-spec:d2s-research` | Turning raw notes into insights with evidence |
| `/discovery-to-spec:d2s-options` | Laying out genuinely different directions |
| `/discovery-to-spec:d2s-decide` | Preparing the decision meeting and recording the outcome (never the approval) |
| `/discovery-to-spec:d2s-spec` | Going through every state and edge case, and writing testable criteria |
| `/discovery-to-spec:d2s-handoff` | Implementing from the spec, asking instead of guessing |

The skills never invent research and never approve a decision: approvals are for people.

## What the plugin runs, sends and fetches

The plugin itself is Markdown only: seven skills, with no hooks, no MCP servers, no scripts and no telemetry.

- **It runs the d2s command line tool.** The skills ask Claude to run the open-source [`discovery-to-spec`](https://www.npmjs.com/package/discovery-to-spec) CLI in your repository, with the command saved in your repository's `.d2s.json` (for example `npx d2s`). When a repository has no `.d2s.json`, a skill offers to set it up with `npx discovery-to-spec init`, which downloads the package from the npm registry. Claude asks before it runs a command, as your permission settings say.
- **It reads and writes files in your repository:** `.d2s.json` and the documents in your design folder (`design/` unless you chose another).
- **It sends nothing anywhere.** The CLI has zero dependencies and makes no network calls. The one exception is not part of this plugin: an opt-in CI check you can add to your own GitHub workflow, which asks GitHub who approved a pull request.
- **Figma is optional.** If you have connected the Figma MCP server yourself, the skills read the frames your documents link to. The plugin doesn't install or configure it.

## More

The full documentation, the CLI reference and an example are in the [repository README](https://github.com/eranlipi/discovery-to-spec#readme). MIT license.
