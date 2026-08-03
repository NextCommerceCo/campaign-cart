---
title: "Features/Checkout/Checkout Form/Errors"
group: "Features"
category: "Checkout Form"
---

# Errors

<!-- Generated from the feature manifest. Do not edit by hand:
     edit <feature>.manifest.ts, then run `npm run docs:reference`. -->

Every error `checkout-form` can raise, at the exact message, so a console line can be matched to a cause.

**Recoverable** means the visitor can get past it by retrying or correcting what they entered — no code change needed. **Fatal** means it happens every time until the markup, code, or config changes.

## `CheckoutFormEnhancer must be applied to a form element`

| | |
|---|---|
| Type | Fatal |
| Cause | `data-next-checkout` is on something other than a `<form>` — usually a `<div>` wrapping one. |

**Fix:** Move the attribute onto the `<form>` itself. The enhancer submits the form and reads its fields, neither of which works from a wrapper.

```html
<!-- wrong -->
<div data-next-checkout><form>…</form></div>

<!-- right -->
<form data-next-checkout>…</form>
```

---

## `Invalid order response: missing ref_id`

| | |
|---|---|
| Type | Fatal |
| Cause | The order API returned success but no `ref_id`, so there is nothing to redirect to. |

**Fix:** The order may well have been created — check the API before telling the visitor it failed, or they may be charged for an order the page abandoned. If it reproduces, it is a backend contract problem, not a markup one.

---

## `Missing required customer information`

| | |
|---|---|
| Type | Recoverable |
| Cause | Submit was reached with email, first name, or last name still empty. |

**Fix:** Normally validation stops the submit before this, so seeing it means a field is not wired: check each of `data-next-checkout-field="email"`, `"fname"`, and `"lname"` exists and is spelled exactly that way. A misspelled field name reads as empty no matter what the visitor typed.

---

## `Cannot create order with empty cart`

| | |
|---|---|
| Type | Recoverable |
| Cause | Submit was reached with nothing in the cart. |

**Fix:** Guard the submit button on cart contents — `data-next-show="cart.hasItems"` — so the visitor cannot reach a checkout with nothing to buy. This also fires if the cart was cleared in another tab, since the cart is per-session.

---

## `Payment token is required for credit card payments`

| | |
|---|---|
| Type | Recoverable |
| Cause | The payment method is a card, but tokenisation has not produced a token yet. |

**Fix:** Wait for `payment:tokenized` before allowing submit. Submitting while the card fields are still being tokenised reaches this — most often on a fast double-click of the pay button.

---

## `Payment token is required`

| | |
|---|---|
| Type | Recoverable |
| Cause | The same condition on the express-checkout path, where the wallet did not return a token. |

**Fix:** Check the express payment method completed rather than being dismissed. A visitor closing the Apple Pay or Google Pay sheet cancels tokenisation, and the click should be treated as abandoned rather than retried.

---

## `Cannot create express order with empty cart`

| | |
|---|---|
| Type | Recoverable |
| Cause | An express-checkout button was used with nothing in the cart. |

**Fix:** Hide the express buttons until the cart has items. They sit outside the form, so form validation does not cover them.

---

## `Credit card service is not ready`

| | |
|---|---|
| Type | Recoverable |
| Cause | Card tokenisation was asked for before the payment iframe finished loading. |

**Fix:** Wait for `checkout:spreedly-ready` before enabling the pay button. On a slow connection the form is interactive well before the payment fields are.

---

## `Credit card payment system is not ready. Please refresh the page and try again.`

| | |
|---|---|
| Type | Recoverable |
| Cause | The same condition at submit time, phrased for the visitor rather than the console. |

**Fix:** This message is shown in the UI, so treat it as visitor-facing: if it appears often, the payment iframe is loading too slowly and the pay button is being enabled too early.

---

## `Credit card data is incomplete`

| | |
|---|---|
| Type | Recoverable |
| Cause | Tokenisation was attempted with a card field still blank. |

**Fix:** The payment iframe owns those fields, so this is the visitor missing one — surface it next to the card inputs rather than as a general error.

---

## `Too many requests. Please wait a moment and try again.`

| | |
|---|---|
| Type | Recoverable |
| Cause | The order API replied 429. |
| Raised by | the API, not this feature |

**Fix:** Wait and retry. Repeated bursts usually mean the pay button is not disabled while a submit is in flight, letting one visitor send several orders.

---

## `Authentication error. Please refresh the page and try again.`

| | |
|---|---|
| Type | Recoverable |
| Cause | The order API replied 401 or 403 — the session is no longer valid. |
| Raised by | the API, not this feature |

**Fix:** A refresh gets a new session. Seen early in a checkout, check the API key in `<meta name="next-api-key">` is the live one for this campaign.

---

## `Invalid order data. Please check your information and try again.`

| | |
|---|---|
| Type | Recoverable |
| Cause | The order API rejected the payload — a 422. |
| Raised by | the API, not this feature |

**Fix:** Read the response body: it names the field. Recurring cases are usually a country/state pair the campaign does not ship to, or a phone number that is not in E.164 form.

---

## `Server error. Please try again in a few moments.`

| | |
|---|---|
| Type | Recoverable |
| Cause | The order API replied 5xx. |
| Raised by | the API, not this feature |

**Fix:** Retry. As with a missing `ref_id`, confirm the order was not created before letting the visitor submit again.
