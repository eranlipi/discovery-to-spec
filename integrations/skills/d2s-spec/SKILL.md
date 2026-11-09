---
name: d2s-spec
description: Stage 5 (spec) of a discovery-to-spec design exploration. Turns the approved direction into a buildable UX spec covering screens and flow, states (empty, loading, error, no permission), edge cases, testable acceptance criteria, accessibility, copy and the design-system components it reuses. Use whenever an approved design needs to be specified for development, or when developers keep asking about states and edge cases.
---

# d2s: spec (stage 5 of 6)

Input: $ARGUMENTS is the exploration id. If it is empty, run `{{cli}} status` and ask which one.

1. Read `.d2s.json` and write in its `lang`. Read `{{dir}}/context.md`, then `decision.md`, and spec only the approved direction. If `decision.md` has no approval, stop and say so.
2. If the Figma MCP server is available, read every linked frame, and the current screens linked under "Where it lives today" in the brief. List the screens in flow order, each with its frame link.
3. For each screen, go through the states: default, empty, loading, error, no permission, and any other state the design implies. Ask the user about every state the design doesn't show.
4. Cover edge cases: long text, many items, zero items, slow or no connection, first-time user, and right-to-left layout where relevant.
5. Write one acceptance criterion per behavior, in the template's format (Given / When / Then, or בהינתן / כאשר / אז in Hebrew). Each one must be testable.
6. Fill "Existing components": the design-system components the screens reuse, with a link to the Figma library or Storybook, and any new component with the reason it is needed. If the Figma MCP server is available, search the team's design-system library (and the repo's Code Connect mappings or Storybook, if any) and prefer existing components.
7. Record anything undecided as an open question; never invent behavior.
8. Run `{{cli}} check <id>`. Next step: `{{cli}} next <id>`, which generates `handoff.md`.
