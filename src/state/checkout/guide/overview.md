---
title: "State/Checkout/Overview"
group: "State"
category: "Checkout Store"
---

# useCheckoutStore

> Last reviewed: 2026-07-30
> Owner: platform

The checkout store holds the checkout a shopper is part-way through: the contact
and address fields they have typed, the payment method and shipping option they
picked, the coupon codes they entered, and whether an order is being submitted
right now. It exists so that the order request has one place to be built from
instead of being scraped out of the DOM at submit time, and so a shopper who
reloads the page — or comes back from a payment redirect — does not have to type
their address again. It is also the authoritative home of applied coupons for the
whole SDK. Field-by-field detail lives in
[reference/state-reference.md](./reference/state-reference.md).

## Concept

Think of it as a **form-progress store that survives a reload only in a filtered
way**.

Data flows one direction: the checkout form and the express-checkout buttons write
into the store as the shopper interacts, and the order builder reads it at submit.
The store does not drive the form — it records what the form already did. That is
why `setStep(2)` does not move anyone to step 2: the step number arrives from the
form's `data-next-step-number` attribute, and the store only reports it.

The part that surprises people is that persistence is a **redaction step, not a
copy**. `partialize` does two things on every write to sessionStorage under
`next-checkout-store`: it drops fields entirely, and it rewrites the ones it
keeps.

```
in memory                          in sessionStorage (next-checkout-store)
─────────────────────────────      ───────────────────────────────────────
step, formData, shippingMethod  ─► kept
billingAddress                  ─► kept, empty fields dropped;
                                   all-empty → undefined
sameAsShipping, vouchers        ─► kept
paymentMethod: 'apple_pay'      ─► rewritten to 'credit-card'
formData.card_number / cvv /
  expiry / any empty string     ─► stripped
paymentToken                    ─► dropped (payment data)
errors, isProcessing            ─► dropped (transient)
testMode                        ─► dropped (session-specific)
```

So the store's own TSDoc line — "it persists across reloads so a shopper doesn't
lose progress" — is true for contact details, address, shipping choice, and
coupons, and deliberately false for anything to do with the card. A resumed
checkout always sends the shopper back through the hosted card fields.

## Business logic

- **A fresh checkout starts at step 1, `credit-card`, `sameAsShipping: true`,
  with no coupons, no errors, and an empty form.** `reset()` returns exactly
  there.
- **Errors are keyed by form field**, with `general` reserved for a whole-order
  failure such as a declined payment. The form calls `clearAllErrors()` before
  each submit, so anything present is from the current attempt.
- **`sameAsShipping` overrides `billingAddress`.** When it is true the order is
  built with no billing block at all, even if a billing address is filled in.
- **Shipping falls back in four steps** when the order is built: the cart store's
  `shippingMethod`, then this store's, then the campaign's first
  `shipping_methods` entry, then shipping method id `1`. Every order path —
  normal submit, express, and test order — walks that same ladder, because they
  all build through `OrderBuilder`.
- **`paymentMethod` is a UI-side vocabulary that is mapped at submit.** The order
  builder translates it through `API_PAYMENT_METHOD_MAP`, which lists every
  method the SDK knows — the redirect ones (`ideal`, `bancontact`, `sepa_direct`,
  `twint`, `swish`, `affirm`, `link`, `klarna`) included. Only the card entry
  actually changes name on the way, and **a method that is not listed is sent as
  it stands** rather than turned into a card, so the field can hold a name this
  SDK release predates and the API is what accepts or refuses it.
- **Express choices do not outlive the page.** `apple_pay`, `google_pay`, and
  `paypal` are written to storage as `credit-card`, because the express session
  they belong to is gone after a load.
- **Coupons live here and nowhere else.** `sdk.applyCoupon(code)` upper-cases and
  trims the code, refuses it with `Coupon already applied` if it is already in
  `vouchers`, appends it, and then recalculates cart totals against the API. The
  cart store's `vouchers` is a mirror refreshed on each recalculation — see
  [the cart store](../../cart/guide/reference/state-reference.md).
- **Removal is case- and whitespace-insensitive, like storage.** `removeVoucher`
  normalises both the code it is given and each stored code with the same
  `toUpperCase().trim()` `applyCoupon` uses, so `removeVoucher('save10')` removes
  a stored `SAVE10`.
- **`setShippingMethod` here does not reprice.** It records the choice; the money
  only changes when the cart recalculates.
- **Nothing resets the store when an order completes.** The persisted subset
  stays in sessionStorage until something calls `reset()`.

## Decisions

- We persist to sessionStorage rather than localStorage because a checkout in
  progress belongs to one visit in one tab; localStorage would prefill a shared
  or kiosk device with the previous shopper's name and address.
- We strip card data inside `partialize` rather than trusting callers to keep it
  out of `formData`, because the checkout form writes every input it finds by
  field name — the only place a redaction cannot be forgotten is the storage
  boundary itself.
- We downgrade express methods to `credit-card` on write rather than restoring
  the shopper's choice, because a restored `apple_pay` would render an express
  button with no live session behind it — a shopper clicking it would get a
  failure instead of a payment sheet.
- We keep the coupon list here rather than on the cart store because coupons are
  submitted as part of the order, so the store that builds the order should own
  them; the cart keeps a display-only copy.
- We let the markup own step navigation and have the store merely record `step`,
  because campaigns lay their steps out differently and a store-driven wizard
  would force one layout on every page.

## Limitations

- **It does not validate anything.** `updateFormData` merges whatever it is
  given, including an unparseable phone number or a missing country. Validation
  lives in the [checkout form
  feature](../../../features/checkout/checkout-form/guide/overview.md); read
  `errors` for its verdict rather than inferring validity from `formData`.
- **It does not navigate.** `setStep(n)` changes a number and nothing else. Show
  and hide steps in the form markup, and let it write the step back.
- **It cannot resume a card payment.** `paymentToken` is not persisted and the
  card number, CVV, and expiry are stripped from `formData`, so a "continue where
  you left off" flow has to re-tokenise through the hosted card fields.
- **A partly-typed billing address comes back incomplete.** Empty fields are
  dropped on write and an all-empty address is stored as `undefined`, so code
  that assumes every billing key is present reads `undefined` for the rest. Guard
  each field, or re-read the form.
- **`testMode` here does not put the page into test mode.** The submit path
  decides that from `core/test-mode.ts`; flipping this field alone changes
  nothing about the order that is placed.
- **It has no expiry and no automatic cleanup.** Unlike the order store's
  15-minute window, `next-checkout-store` lives for the whole tab session, so a
  checkout abandoned hours ago still prefills, and a tab that completes one order
  starts the next with the previous form data and coupons. Call `reset()` once an
  order is confirmed.
- **It does not know about the cart.** Nothing here validates that the shipping
  method or coupons still apply to the current lines; that reconciliation happens
  on the next cart recalculation.
