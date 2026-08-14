---
title: "Features/Checkout/Checkout Form/Attributes"
group: "Features"
category: "Checkout Form"
---

# Attributes

<!-- Generated from the feature manifest. Do not edit by hand:
     edit <feature>.manifest.ts, then run `npm run docs:reference`. -->

Turns a plain HTML form into a working checkout: validates it, tokenizes the card, creates the order, and sends the visitor onward.

Turned on by `form[data-next-checkout]`.

## On the form element

### `data-next-checkout`

| | |
|---|---|
| Type | `boolean (presence)` |
| Required | yes |
| Default | — |

Marks the `<form>` as the checkout. Must be on a real `<form>` element — the feature is registered against `form[data-next-checkout]`, so a `<div>` carrying it is never activated.

---

### `data-next-checkout-step`

| | |
|---|---|
| Type | `string (URL)` |
| Required | no |
| Default | — |

Makes this form one step of a multi-step checkout: validation and submission apply to this step rather than the whole order, and **the value is the URL to navigate to** once the step validates.

> **Watch out:** It is a URL, not a step name. `data-next-checkout-step="shipping"` sends the visitor to `/shipping` relative to the current page — usually a 404 — rather than to the next step. Use the real path, e.g. `/checkout/payment`.

---

### `data-next-step-number`

| | |
|---|---|
| Type | `number` |
| Required | no |
| Default | `1` |

Which step this form is, when `data-next-checkout-step` is set. The number decides what pressing "next" checks: step 1 the contact details and the shipping address, step 2 that same address again in case it was cleared behind them, step 3 everything — the full form check, the card fields, and the separate billing address when the visitor asked for one. Any other number is checked against step 2, so a fourth step is still a gate; anything that is not a whole number above zero is read as step 1 and logged as `Step number "…" is not a whole number above zero`.

> **Watch out:** On step 3, choosing "use a different billing address" and leaving it blank fails validation with `Billing first name is required` and one message per missing billing field. It used to be skipped on this path, and the order reached the gateway to be declined by Address Verification instead. Keep the billing reveal container on the step-3 page, or those messages have nowhere to render.

## Fields

### `data-next-checkout-field`

| | |
|---|---|
| Type | `string (field name)` |
| Required | yes |
| Default | — |

Marks an input as a checkout field and names it. The name is what maps the input to the order — see **Field names** below for the set.

> **Watch out:** The legacy `os-checkout-field` attribute is still read, so existing forms keep working. Use `data-next-checkout-field` in new markup.

---

### `data-next-required`

| | |
|---|---|
| Type | `'true'` |
| Required | no |
| Default | — |

Forces validation on a field that is optional by default. Phone is the usual case: mark it required when your fulfilment needs it.

---

### `data-next-checkout-submit`

| | |
|---|---|
| Type | `boolean (presence)` |
| Required | no |
| Default | — |

Marks the submit control. Without it the form falls back to its own submit event, so a `<button type="submit">` still works. Put it on a `<button>` or an `<input type="submit">` — those are the two the browser lets the form disable while the order is being placed. On an `<a>` or a `<div>` it is ignored, with `Submit button not found in checkout form` in the console, because nothing can stop a second click on those.

## Payment

### `data-next-checkout-payment`

| | |
|---|---|
| Type | `string (method)` |
| Required | no |
| Default | — |

Marks a payment method choice — a radio or a button — and names the method it selects.

**Valid values:**

- `credit` — Card, entered in the hosted card fields. `credit_card`, `card` and `card_token` select the same method; `credit` is what the starter templates carry.
- `paypal` — PayPal.
- `apple_pay` — Apple Pay.
- `google_pay` — Google Pay.
- `klarna` — Klarna.
- `affirm` — Affirm.
- `bancontact` — Bancontact.
- `ideal` — iDEAL.
- `link` — Link.
- `giropay` — Giropay.
- `sepa_debit` — SEPA Direct Debit, under the one name the orders API takes. The platform payment-methods guide calls the same method `sepa_direct`; that name is not accepted.
- `sofort` — Sofort.
- `swish` — Swish.
- `twint` — TWINT.

> **Watch out:** Written with underscores, the same as everywhere else the SDK names a payment method. `-` and `_` are interchangeable and case is ignored, so `apple_pay`, `apple-pay` and `APPLE_PAY` are one value — but keep to underscores in new markup so a page reads the same as the docs. The API name still differs for a card (`credit` becomes `card_token`); the SDK translates that. **A value that is not on this list still works if the API accepts it** — it is sent to the orders API exactly as written, so a method added to the platform after this SDK release can be offered without waiting for an upgrade. `Payment method "…" is not one the SDK knows` in the console is a heads-up rather than a failure; if it was a typo, the API refuses the order and names the method.

## Structural components

### `data-next-component`

| | |
|---|---|
| Type | `string` |
| Required | no |
| Default | — |

Names a structural part of the form so the feature can show, hide, clone, or write into it. These are containers, not inputs.

**Valid values:**

- `shipping-form` — Wrapper for the shipping address fields.
- `billing-form` — Wrapper for the billing address fields.
- `different-billing-address` — The container revealed when the visitor says billing differs from shipping.
- `location` — The country/state/postcode group. Revealed together once a country is known, and cloned to build the billing equivalent.
- `billing-location` — Set by the feature on the cloned billing location group.
- `shipping-field-row` — One row of shipping fields, for row-level show and hide.
- `credit-error` — Container for card errors.
- `credit-error-text` — Element the card error message is written into.
- `paypal-error` — Container for PayPal errors.

---

### `data-next-component-location`

| | |
|---|---|
| Type | `string` |
| Required | no |
| Default | — |

Alternative marker for the location group, accepted alongside `data-next-component="location"`.

## Read from other elements

These are not placed on the element this feature is bound to — look for them on inputs elsewhere in the page, or on a linked selector.

| Name | Values | Meaning |
|---|---|---|
| `data-next-payment-method` | `credit` / `paypal` / `apple_pay` / `google_pay` / `klarna` / `affirm` / `bancontact` / `giropay` / `ideal` / `link` / `sepa_debit` / `sofort` / `swish` / `twint` | Wraps one payment choice inside the form, and names the method it offers. The feature looks for a radio input and a `[data-next-payment-form]` **inside** this wrapper, so a payment form that is not nested in one is never revealed or collapsed. **Watch out:** Underscores, `-` accepted, case ignored — `apple_pay` and `apple-pay` are one value. The card is the only one whose name changes downstream: `credit` here is `credit-card` in the checkout store and `card_token` on the order, and the SDK translates both hops. Everything after `klarna` is a **redirect method**: it has no fields to reveal, so its `[data-next-payment-form]` can be empty — the shopper is sent to the payment provider to pay once the order exists. |
| `data-next-payment-form` | — | Marks the fields belonging to a payment method, inside that method's container. The form is revealed when the method is chosen and collapsed when another is — so card fields are not in the tab order while PayPal is selected. |

## Set by the feature

Written to the element as state changes. Read these from CSS or tests instead of inferring state from the rendered text.

| Name | Values | Meaning |
|---|---|---|
| `data-next-payment-state` | `expanded` / `collapsed` | On a payment form: whether it is currently shown. Animate the reveal from this rather than from the element appearing. |

## CSS classes

Toggled by the feature. Style these rather than tracking the same state yourself.

| Name | Values | Meaning |
|---|---|---|
| `next-error` | — | On a field's error message element when validation fails, alongside `next-error-field` on the input itself. |
| `next-error-field` | — | On an input that failed validation. |

## Field names

The value of `data-next-checkout-field` is what maps an input to the order, so
these names are fixed rather than free text:

| Name | Holds |
|---|---|
| `email` | Contact email |
| `fname` | First name |
| `lname` | Last name |
| `phone` | Phone number |
| `address1` | Street address |
| `address2` | Apartment, suite, unit |
| `city` | City |
| `province` | State, province, or region |
| `postal` | Postcode or ZIP |
| `country` | Country |
| `payment-method` | The chosen payment method |
| `exp-month` / `cc-month` | Card expiry month |
| `exp-year` / `cc-year` | Card expiry year |

Billing equivalents use the same names inside the billing container; the feature
maps them to the order's billing address itself.

The card number and CVV are **not** in this list. They live in hosted payment
fields that the SDK inserts, so no card number ever passes through your markup or
SDK code — only the token from `payment:tokenized` does.

```html
<form data-next-checkout>
  <input data-next-checkout-field="email" type="email">
  <input data-next-checkout-field="fname">
  <input data-next-checkout-field="lname">
  <input data-next-checkout-field="phone" type="tel" data-next-required="true">

  <div data-next-component="shipping-form">
    <input data-next-checkout-field="address1">
    <div data-next-component="location">
      <select data-next-checkout-field="country"></select>
      <select data-next-checkout-field="province"></select>
      <input data-next-checkout-field="postal">
    </div>
  </div>

  <label><input type="radio" data-next-checkout-payment="credit"> Card</label>
  <label><input type="radio" data-next-checkout-payment="paypal"> PayPal</label>

  <button data-next-checkout-submit>Complete order</button>
</form>
```

## What fires when

The order of events is the fastest way to see where a checkout stopped:

1. `checkout:form-initialized` — fields, validation, and payment are wired up
2. `checkout:spreedly-ready` — the hosted card fields will accept input
3. `checkout:location-fields-shown` — the country group was revealed (also a DOM `CustomEvent`)
4. `checkout:started` — the visitor submitted; **the order does not exist yet**
5. `payment:tokenized` — the card became a token
6. `order:redirect-missing` — the order succeeded but carried no redirect URL, so
   the visitor is stranded on the checkout page unless you handle it

`payment:error` can fire instead of 5 or 6, for card-field problems and for a
declined order alike.

**Nothing here announces that the order was created**, deliberately. Creating an
order is not completing one: a card payment that needs 3-D Secure, every express
method, and every redirect method (iDEAL, Bancontact, SEPA, TWINT, Swish, Affirm,
Link, Klarna) leave this page with the money still unmoved and a
`payment_complete_url` to send the shopper to — which the SDK always follows in
preference to any success URL of your own. So purchase tracking hangs on
`order:completed`, which the order store emits on the page the shopper lands on
next, for an order fetched back from the API — and which is where the SDK's own
`dl_purchase` comes from. Do not use `checkout:started` either: it fires before
the payment call, so failed attempts would count as revenue.

## Cautions

- **Must be a `<form>`.** The activating selector is `form[data-next-checkout]`;
  a `<div>` with the attribute is silently never enhanced.
- **The location group is revealed as a unit.** Country, province, and postcode
  live inside `data-next-component="location"` and appear together once a country
  is known. Splitting them across containers breaks that reveal.
- **The billing location group is cloned from the shipping one** and stamped
  `data-next-component="billing-location"`. Do not hand-write a billing location
  group as well, or there will be two.
- **Legacy `os-checkout-*` attributes still work** and are read as fallbacks. They
  are not deprecated in code, but prefer `data-next-*` so one form does not mix
  both conventions.
