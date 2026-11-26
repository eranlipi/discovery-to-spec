---
name: d2s-research
description: Stage 2 (research) of a discovery-to-spec design exploration. Synthesizes raw research (interview notes, support tickets, analytics, survey answers, user feedback) into insights.md, with evidence and a confidence level for each insight. Use whenever the user shares research material or user feedback for an exploration, or asks to summarize what users said.
---

# d2s: research (stage 2 of 6)

Setup: `.d2s.json` at the repository root holds `cli`, the command that runs d2s (such as `npx d2s`), and `dir`, the design folder (usually `design`). Below, `<cli>` and `<dir>` stand for those values. If there is no `.d2s.json`, this repository isn't set up yet: say so, offer to run `npx discovery-to-spec init`, and continue once it has run.

Input: $ARGUMENTS is the exploration id. If it is empty, run `<cli> status --json` and ask which one.

1. Read `.d2s.json` and write in its `lang`. Read `<dir>/context.md` and the exploration's `brief.md` first, because the research serves that problem.
2. Open `<dir>/explorations/<id>/insights.md`. If it doesn't exist, the brief hasn't passed its gate yet; run `<cli> status <id>` and tell the user.
3. Ask for the raw material: pasted notes, files in the repo, or exported data. Read all of it before writing anything.
4. Write at most 5 insights. For each one give what was learned, the supporting evidence (a direct quote or a number, with its source), and a confidence level (high, medium or low) that reflects how much evidence there is.
5. Never invent, embellish or merge quotes, numbers or sources. If the evidence is thin, say so and lower the confidence.
6. Anonymize personal data (names, emails, phone numbers, account ids) in the document.
7. List the opportunities that follow from the insights, and put untested assumptions under "still unclear".
8. Run `<cli> check <id> --strict --json` and work through each issue's `fix` until `ok` is true. Next step: `<cli> next <id>`, then `/d2s-options`.
