# Mobile checkout drop-off: options

> Stage 3 of 6: 2 to 4 genuinely different directions. It's fine to try things and throw them away.

## Direction A
**One-page checkout.** Every field on one shortened screen, with browser autofill.
Figma: https://www.figma.com/design/EXAMPLE/Checkout?node-id=10-1
Pros: quick to build, fewer steps. Cons: still a long screen on small phones. Relies on insight 1.
What changes in the product: Shipping details and Payment become one screen; the cart and Order confirmation stay. Reuses the design system's form fields, primary button and error message, with no new components. Desktop checkout is not affected.

## Direction B
**Digital wallet and saved cards.** An Apple Pay / Google Pay button at the top, and saved cards for returning customers.
Figma: https://www.figma.com/design/EXAMPLE/Checkout?node-id=20-1
Pros: shortest path for returning customers. Cons: depends on the payment provider and needs a security review. Relies on insights 1 and 3.
What changes in the product: a wallet button above the form and a saved-card picker in Payment. New components: the wallet button and the card picker. My account needs a page to manage saved cards.

## Direction C (optional)
**Short steps with progress.** Three short screens with a progress bar.
Figma: https://www.figma.com/design/EXAMPLE/Checkout?node-id=30-1
Pros: each screen is simple. Cons: more steps, and interviewees said multi-step flows "feel long".
What changes in the product: Shipping details and Payment split into three short steps. New component: a progress bar. Other flows are not affected.

## Direction D (optional)

## Recommendation
Direction A now, within the appetite, with clear error messages. Direction B as a follow-up, once the payment provider is checked.
