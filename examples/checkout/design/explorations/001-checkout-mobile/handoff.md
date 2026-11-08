---
id: 001-checkout-mobile
generated: 2026-11-08
---

# Mobile checkout drop-off: handoff

> Stage 6 of 6. Generated from the other documents (npx d2s handoff 001-checkout-mobile). Regenerating overwrites manual edits, so fix things in the source documents.

## In one line
One-page checkout (Direction A) with clear error messages. https://www.figma.com/design/EXAMPLE/Checkout?node-id=10-1

## Documents
- [Brief](./brief.md)
- [Insights](./insights.md)
- [Options](./options.md)
- [Decision](./decision.md)
- [Spec](./spec.md)

## Figma links
- https://www.figma.com/design/EXAMPLE/Checkout?node-id=10-1
- https://www.figma.com/design/EXAMPLE/Checkout?node-id=10-2
- https://www.figma.com/design/EXAMPLE/Checkout?node-id=10-3

## Acceptance criteria
- Given a mobile customer with a full cart, When they tap "Pay", Then every field is shown on one page.
- Given a declined card, When the customer submits, Then a message shows the reason and what to do, and the details stay in the form.
- Given a double tap on "Pay", When the request is in progress, Then only one charge is made.

## Open questions
Do users drop off before entering card details, or after?

## Notes for coding agents
- Read the [spec](./spec.md) in full before you start.
- If the Figma MCP server is available, read each linked frame before building that screen.
- Prefer existing design system components over new ones.
- Write a test for every acceptance criterion.
- If something is unspecified or conflicts with Figma, stop and ask. Don't invent behavior.
