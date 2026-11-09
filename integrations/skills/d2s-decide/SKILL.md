---
name: d2s-decide
description: Stage 4 (decision gate) of a discovery-to-spec design exploration. Prepares the decision meeting and records the outcome in decision.md, covering the chosen direction, the reasoning, the rejected options and who approved. Use whenever a team is choosing between design directions, preparing a design decision meeting or documenting a design decision.
---

# d2s: decide (stage 4 of 6)

Input: $ARGUMENTS is the exploration id. If it is empty, run `{{cli}} status` and ask which one.

1. Read `.d2s.json` and write in its `lang`. Read `{{dir}}/context.md` (its design principles help compare directions), then `brief.md`, `insights.md` and `options.md`.
2. Before the meeting, prepare a one-screen comparison of the directions against the brief's desired outcome and appetite. Show it to the user and don't write `decision.md` yet.
3. After the team decides, fill in the chosen direction (with its Figma link), the reasoning, and what was rejected and why.
4. Never fill in the "approved by" section yourself, and never state that something was approved unless the user tells you who approved it. Approval is a human act. When the user tells you, explain the format the gate checks: one line per person, `name, role, date` and optionally `@github-handle`, covering every role in `.d2s.json` (`approvals.roles`). Placeholders like "TBD" and AI tool names fail the gate.
5. Run `{{cli}} check <id>`. Once the user confirms the approval is recorded, `{{cli}} next <id>` adds the decision to `{{dir}}/decisions.md` and opens the spec stage (`/d2s-spec`).
