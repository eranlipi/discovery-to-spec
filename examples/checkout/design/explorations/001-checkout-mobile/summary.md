---
id: 001-checkout-mobile
generated: 2026-11-08
---

# Mobile checkout drop-off: summary

> For design and product: the whole exploration on one page. Generated with the handoff (npx d2s handoff 001-checkout-mobile), so fix things in the stage documents, not here.

## The problem
Fictional example. About 40% of users who reach checkout on mobile don't complete it. On desktop the rate is much lower, so we suspect the mobile experience rather than pricing.

## Who it matters to
Returning customers who order from their phone, usually during a short break or on the go.

## Desired outcome
More completed mobile orders, and fewer support tickets saying "the payment didn't go through".

## Appetite and no-gos
Three weeks of a small team: a designer, a product manager and a developer.

We don't switch payment providers and we don't change prices or shipping.

## What we learned
1. **The form is too long for a small screen.** Four of six interviewees said they "give up and finish on the computer". Confidence: high.
2. **Card errors are unclear.** About a quarter of the support tickets describe "the payment didn't go through" with no explanation. Confidence: medium.
3. **Cards can't be saved.** Returning customers re-enter their details on every order. Confidence: medium.

## What we decided
One-page checkout (Direction A) with clear error messages. https://www.figma.com/design/EXAMPLE/Checkout?node-id=10-1

It addresses the strongest insight (the long form) and fits in three weeks.

## What we didn't choose, and why
- Direction B is deferred to a follow-up, because it depends on the payment provider and a security review.
- Direction C is rejected, because in research multi-step flows felt longer.

## Risks to watch after launch
Track the mobile completion rate and the number of payment-related support tickets.

## Approved by
- Maya Cohen, product, 2026-11-05
- Noa Levi, design, 2026-11-05
- Amir Katz, engineering, 2026-11-06

## What we're building
1. Cart: https://www.figma.com/design/EXAMPLE/Checkout?node-id=10-2
2. One-page checkout: https://www.figma.com/design/EXAMPLE/Checkout?node-id=10-1
3. Order confirmation: https://www.figma.com/design/EXAMPLE/Checkout?node-id=10-3

## Figma
- https://www.figma.com/design/EXAMPLE/Checkout?node-id=10-1
- https://www.figma.com/design/EXAMPLE/Checkout?node-id=10-2
- https://www.figma.com/design/EXAMPLE/Checkout?node-id=10-3

## Open questions
Do users drop off before entering card details, or after?

Whether customers are comfortable saving a card with us.

## Documents
- [Brief](./brief.md)
- [Insights](./insights.md)
- [Options](./options.md)
- [Decision](./decision.md)
- [Spec](./spec.md)
- [Handoff for development](./handoff.md)
