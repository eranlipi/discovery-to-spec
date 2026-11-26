---
name: d2s-options
description: Stage 3 (options) of a discovery-to-spec design exploration. Helps the team lay out 2 to 4 genuinely different design directions, with Figma links, pros, cons, the insight each relies on and what each changes in the product. Use whenever the user wants to explore alternatives, compare design directions or brainstorm solutions for a framed problem.
---

# d2s: options (stage 3 of 6)

Setup: `.d2s.json` at the repository root holds `cli`, the command that runs d2s (such as `npx d2s`), and `dir`, the design folder (usually `design`). Below, `<cli>` and `<dir>` stand for those values. If there is no `.d2s.json`, this repository isn't set up yet: say so, offer to run `npx discovery-to-spec init`, and continue once it has run.

Input: $ARGUMENTS is the exploration id. If it is empty, run `<cli> status --json` and ask which one.

1. Read `.d2s.json` and write in its `lang`. Read `<dir>/context.md`, `brief.md` and `insights.md` first; every direction must address the problem and the desired outcome in the brief, starting from where it lives in the product today.
2. Help the user describe 2 to 4 directions that differ in approach, not only in visuals. If two directions are variations of the same idea, say so and help find a real alternative.
3. For each direction write a short name, its Figma or prototype link, the idea in a sentence or two, pros, cons, the insight it relies on, and what changes in the product: the screens that change, the design-system components it reuses, any new components, and the effect on other flows.
4. Ask the user for the Figma links; never make up a link. If the Figma MCP server is available, read the linked frames so the descriptions match the designs, read the current screens linked under "Where it lives today" in the brief, and search the team's design-system library. Prefer existing components, and name every new one.
5. Write the recommendation section, but make clear that the decision belongs to the team at the decision gate.
6. Run `<cli> check <id> --strict --json` and work through each issue's `fix` until `ok` is true. Next step: `<cli> next <id>`, then `/d2s-decide`.
