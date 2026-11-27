---
name: d2s-handoff
description: Stage 6 (handoff) of a discovery-to-spec design exploration. Generates the developer handoff and implements the UI from the approved spec. Use whenever a design spec is ready for development, or a developer or coding agent is about to implement a designed feature that has an exploration folder.
---

# d2s: handoff (stage 6 of 6)

Setup: `.d2s.json` at the repository root holds `cli`, the command that runs d2s (such as `npx d2s`), and `dir`, the design folder (usually `design`). Below, `<cli>` and `<dir>` stand for those values. If there is no `.d2s.json`, this repository isn't set up yet: say so, offer to run `npx discovery-to-spec init`, and continue once it has run.

Input: $ARGUMENTS is the exploration id. If it is empty, run `<cli> status --json` and ask which one.

1. Before reading or building anything, run `<cli> check <id> --strict --json`. Build only from an exploration at the handoff stage with `ok` true.
   - At the spec stage: run `<cli> next <id>` to generate the handoff. At an earlier stage (a decision that was reopened is back at decide): stop and say which stage it is at. Never build from an older `handoff.md`.
   - An issue with code `stale`: a source document changed after the handoff was generated. Run `<cli> handoff <id>`, then check again.
   - An issue with code `changed`: the chosen direction was edited after it was approved. Stop and show the user the issue. Don't build, and don't run `<cli> reopen <id>` unless the user asks: the people who approved decide that.
   - Any other error: stop and show it to the user.
2. Read `handoff.md` and `spec.md` in full. If the Figma MCP server is available, read each linked frame before building that screen.
3. Prefer existing design system components. Use the repo's Code Connect mappings or Storybook if there are any.
4. Build one screen or state at a time, and write a test for each acceptance criterion.
5. If anything is unspecified, or the spec conflicts with the Figma frames, stop and ask instead of guessing. Write the answer back into `spec.md` so the next person has it, then run `<cli> handoff <id>` so the handoff matches. A change to the chosen direction itself is not yours to write: it goes back to the people who approved it.
6. If the repo uses OpenSpec, the handoff created a draft proposal in `openspec/changes/`. Continue with the OpenSpec workflow to add spec deltas and tasks.
7. When the work is merged, run `<cli> archive <id>`.
