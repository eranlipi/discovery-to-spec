# Mobile checkout drop-off: spec

> Stage 5 of 6: the spec for development. This is where "done" is defined.

## Screens and flow
1. Cart: https://www.figma.com/design/EXAMPLE/Checkout?node-id=10-2
2. One-page checkout: https://www.figma.com/design/EXAMPLE/Checkout?node-id=10-1
3. Order confirmation: https://www.figma.com/design/EXAMPLE/Checkout?node-id=10-3

## States
- **Default:** every field on one screen; the address is prefilled when known.
- **Loading:** the "Pay" button shows progress and can't be tapped again.
- **Card declined:** a message above the field with the reason and what to do next.
- **No connection:** a message that the payment wasn't sent; the details stay in the form.

## Edge cases
- Long name or address: the field grows instead of truncating.
- Empty cart: back to the cart with an explanation.
- Double tap on "Pay": only one request is sent.

## Acceptance criteria
- Given a mobile customer with a full cart, When they tap "Pay", Then every field is shown on one page.
- Given a declined card, When the customer submits, Then a message shows the reason and what to do, and the details stay in the form.
- Given a double tap on "Pay", When the request is in progress, Then only one charge is made.

## Accessibility
- Every field has a label that screen readers announce.
- Error messages are announced as soon as they appear.
- Touch targets are at least 44 by 44 pixels.

## Copy (optional)
Card declined: "Your card was declined. Check the expiry date or try another card."

## Existing components
Form fields, primary button and error message from the design system. No new components.
