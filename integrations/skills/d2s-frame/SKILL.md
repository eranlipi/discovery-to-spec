---
name: d2s-frame
description: Stage 1 (frame) of a discovery-to-spec design exploration. Turns a feature request, idea or stakeholder ask into a one-page brief covering the problem, who it matters to, the desired outcome, the appetite and the no-gos. Use whenever someone wants to start a new feature, design request or product idea, including when they jump straight to a solution.
---

# d2s: frame (stage 1 of 6)

Input: $ARGUMENTS is a title for a new exploration or an existing exploration id. If it is empty, ask which one.

1. Read `.d2s.json` (keys: `dir`, `lang`). Write all document text in `lang` (`he` = Hebrew, `en` = English).
2. For a new exploration, run `{{cli}} new "<title>"` (add `--slug <latin-name>` when the title isn't in English) and use the id it prints. For an existing one, open `{{dir}}/explorations/<id>/brief.md`.
3. Fill the brief section by section by interviewing the user, one question at a time.
   - If the user describes a solution ("add a button that…"), ask what problem it solves and for whom. The brief describes the problem, not the solution.
   - "Desired outcome" should be observable. Ask how they would know it worked.
   - "Appetite" is a decision about how much time the problem is worth, not an estimate.
4. Write only what the user told you. Never invent users, data, quotes or numbers. Put unknowns under open questions.
5. Keep the `##` headings unchanged, because `{{cli}} check` looks for them. The `<!-- -->` guidance comments can stay.
6. Run `{{cli}} check <id>`. When it passes, tell the user the brief is ready, and that the next step is `{{cli}} next <id>` followed by `/d2s-research`.
