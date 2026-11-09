# How design and product work here

Every feature or problem goes through six stages. Each stage leaves one short document, and only a direction approved at the decision gate moves on to development.

| Stage | Document | What it holds | Led by |
| --- | --- | --- | --- |
| 1. Frame | `brief.md` | The problem, who it matters to, where it lives in the product today, desired outcome, appetite and no-gos | Product |
| 2. Research | `insights.md` | User insights with evidence and confidence | Design and product |
| 3. Options | `options.md` | 2 to 4 directions with Figma links, pros and cons, and what each changes in the product | Design |
| 4. Decision gate | `decision.md` | What was chosen, what was rejected, why, and who approved | Product, design and engineering |
| 5. Spec | `spec.md` | Screens, states, edge cases, acceptance criteria and the components used | Design |
| 6. Handoff | `handoff.md`, `summary.md` | Generated: links and criteria for development, and a one-page summary for design and product | Engineering, design and product |

## Where things live

- `explorations/` — one folder per feature, holding the documents of every stage.
- `decisions.md` — the log of every decision made.
- `context.md` — standing product context: the product, users, design principles and design system. The AI assistant and agents read it for every feature.
- `templates/` — the templates. Adapt them to your team.

## No terminal needed

You don't need a terminal or Git to take part.

- **Edit on GitHub:** open the file on github.com, click the pencil icon, write and commit.
- **Write elsewhere:** write in Figma or a regular doc, and someone from engineering copies it in.
- **The `<!-- -->` notes** are guidance. You can leave them; they don't count as content.
- **Keep the `##` headings as they are** — the automatic check looks for them.

## For whoever runs the tool

```
{{cli}} new "Short name of the problem"   # start an exploration
{{cli}} status                            # where each exploration stands
{{cli}} next <id>                         # pass the gate to the next stage
{{cli}} check                             # validate all documents
{{cli}} archive <id>                      # archive once the feature is built
```

## With an AI agent (optional)

In Claude Code or Cursor there is a command per stage: `/d2s-frame`, `/d2s-research`, `/d2s-options`, `/d2s-decide`, `/d2s-spec`, `/d2s-handoff`. The agent helps you write and summarize, but it never invents data and never approves decisions.

Only use AI tools your organization has approved. Don't paste internal information into free public AI tools.
