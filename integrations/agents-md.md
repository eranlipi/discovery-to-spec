## Design workflow (discovery-to-spec)

Design and product work lives in `{{dir}}/explorations/<id>/`, one folder per feature, and moves through six stages: frame → research → options → decide → spec → handoff. Each stage has one document; `{{dir}}/README.md` explains the process.

Rules for AI agents:
- Write documents in the language set in `.d2s.json` (`lang`) and keep the `##` headings unchanged.
- Never invent user research, quotes, numbers or Figma links. Record unknowns as open questions.
- Never fill in the "approved by" section of `decision.md`. Only people approve decisions. The gate expects one line per person (`name, role, date`, optionally `@github-handle`) and rejects placeholders and AI tool names.
- Before implementing a UI change that has an exploration, read its `handoff.md` and `spec.md`. If the Figma MCP server is available, read the linked frames. If something isn't specified, ask instead of guessing.
- Commands: `{{cli}} status` shows where each exploration stands; `{{cli}} next <id>` validates the current stage and opens the next one.
