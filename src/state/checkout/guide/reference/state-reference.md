---
title: "State/Checkout/State Reference"
group: "State"
category: "Checkout Store"
---

# useCheckoutStore

<!-- Generated from the store manifest. Do not edit by hand:
     edit <store>.state-manifest.ts, then run `npm run docs:reference`. -->

Holds the checkout the shopper is part-way through: the contact and address fields they have typed, the payment and shipping they picked, the coupon codes they entered, and whether an order is currently being submitted.

Persisted to Zustand `persist` over sessionStorage under `next-checkout-store`. There is no expiry.

## Schema

The **Survives** column is the part that is invisible in the type: two fields can look identical and only one comes back after a refresh.

| Field | Type | Survives | Meaning |
|---|---|---|---|
| `step` | `number` | persisted — survives a reload | Which step of a multi-step checkout the shopper reached, starting at 1. A single-page checkout leaves it at 1 for the whole flow.<br>⚠️ The checkout form reads its step from the `data-next-step-number` attribute on the form and writes it here — the value flows DOM → store, never back. Writing `setStep(2)` moves no one to step 2; it only relabels what the store reports. |
| `isProcessing` | `boolean` | transient — runtime only | True while an order is being submitted. Use it to disable the submit button: a card charge is not reversible from the page, so a second click risks a second attempt. |
| `errors` | `Record<string, string>` | transient — runtime only | Validation and submission messages, keyed by the form field they belong to — `email`, `phone`, and `billing-phone` are typical keys. The key `general` holds a whole-order failure such as a declined payment rather than a single bad field. An empty map means nothing has failed since the last clear.<br>⚠️ Deliberately excluded from persistence, so a reload shows a clean form even if the previous attempt was declined. If you need the shopper to see why the order failed after a reload, re-run validation — do not expect the message to still be here. |
| `formData` | `Record<string, any>` | persisted — survives a reload | Everything the shopper typed into the checkout form, keyed by field name — `email`, `fname`, `lname`, `address1`, `address2`, `city`, `province`, `postal`, `country`, `phone`, `accepts_marketing`, plus the `billing-*` variants. This is what the order request is built from, so a missing key here becomes a missing address line on the order.<br>⚠️ What gets stored is filtered: `cvv`, `card_cvv`, `card_number`, and every expiry variant (`month`, `year`, `expiration_month`, `expiration_year`, `exp-month`, `exp-year`) are stripped before writing, and so is any empty string. Reading `formData.cvv` back after a reload returns `undefined` by design — take card data from the hosted card fields, never from here. |
| `paymentToken` | `string` | transient — runtime only | The single-use token that stands in for the card the shopper entered, produced by the hosted card fields. `undefined` means no card has been tokenised yet, and the order cannot be submitted as a card payment.<br>⚠️ Never persisted — a token is payment data with a short life. After a reload the shopper must re-enter the card, so do not build a "resume checkout" flow that assumes the token is still here. |
| `paymentMethod` | `CheckoutPaymentMethod` | persisted — survives a reload | How the shopper is paying. `credit-card` is the default and covers the hosted card fields; `paypal`, `apple_pay`, and `google_pay` are the express buttons; `card_token` is the API-side spelling of `credit-card` kept for callers that pass the API value straight through. The rest — `klarna`, `affirm`, `bancontact`, `ideal`, `link`, `sepa_direct`, `swish`, `twint` — are redirect methods: the checkout collects no payment details for them, and the shopper finishes paying at the provider the created order points to. Any other string is allowed too and is sent to the orders API unchanged, so a page can offer a method this SDK release does not know by name.<br>⚠️ Express methods are downgraded on the way to storage: if the shopper picked Apple Pay, Google Pay, or PayPal and then reloads, the store comes back as `credit-card`, because an express session does not survive the page. The symptom is a shopper who "loses" their Apple Pay choice on refresh — expected, not a bug. |
| `shippingMethod` | `\| { id: number; name: string; price: number; code: string; } \| undefined` | persisted — survives a reload | The shipping option the shopper chose, with its id, name, code, and price. `undefined` means they have not chosen one, in which case the order builder falls back to the cart's method, then to the campaign's first shipping method, and only then to shipping method id 1. |
| `billingAddress` | `\| { first_name: string; last_name: string; address1: string; address2?: string \| undefined; city: string; province: string; postal: string; country: string; phone: string; } \| undefined` | persisted — survives a reload | The separate billing address, in the form's own field names (`address1`, `city`, `province`, `postal`, `phone`). `undefined` means there is no separate billing address — either the shopper is billing to the shipping address, or they have not filled it in yet.<br>⚠️ Empty fields are dropped before persisting, and an address whose every field is empty is stored as `undefined` rather than as an empty object. So after a reload a partly-typed billing address comes back with only the filled keys — code that assumes all keys are present will read `undefined` for the rest. |
| `sameAsShipping` | `boolean` | persisted — survives a reload | Whether the shopper is billing to the shipping address. True by default. When it is true the order is built without a billing address block, and `billingAddress` is ignored even if it holds values. |
| `testMode` | `boolean` | transient — runtime only | Whether this checkout is a test order rather than a real purchase. False for a real shopper.<br>⚠️ Excluded from persistence on purpose, so a test session cannot leak into a later real one in the same tab. It is also not the switch the test-order tooling reads — that lives in `core/test-mode.ts`, so flipping this field alone does not put the page into test mode. |
| `vouchers` | `string[]` | persisted — survives a reload | The coupon codes currently applied to this checkout. This is the source of truth for coupons — the cart store's `vouchers` is a copy written on each totals recalculation, so read coupons from here (or via `sdk.getCoupons()`) and never write them into the cart store directly.<br>⚠️ Codes go in uppercased and trimmed, and `removeVoucher` normalises the same way before comparing — both `applyCoupon` and `removeVoucher` run every code through the same `normalizeVoucherCode()` (`@/utils/voucher.ts`), so `removeVoucher('save10')` removes a stored `SAVE10`. |

New fields: a new field is **not** persisted until you add it to the `partialize` list in `checkout.state.ts`. This store writes a hand-picked subset, so a field you add reads back as its initial value after a reload and the bug looks like "the form forgot what I typed". Add it to `partialize` deliberately — and never add anything carrying card data, which is exactly what that filter exists to keep out of sessionStorage.

## What you can do

### Do this

The supported path. These carry the business logic and talk to the API.

| Call | Effect |
|---|---|
| `sdk.applyCoupon(code)` | Uppercases and trims the code, refuses it if it is already in `vouchers` (comparing normalised on both sides, so a code stored un-normalised still dedupes), adds it, then recalculates cart totals against the API. Returns `{ success, message }` — the message is ready to show to the shopper. |
| `sdk.removeCoupon(code)` | Removes the code from `vouchers` and recalculates totals against the API. Normalises the code the same way `applyCoupon` does before matching, so any casing or surrounding whitespace still finds the stored entry. |

### Direct writes

Set state without an API call. Nothing recalculates unless the effect says so.

| Call | Effect |
|---|---|
| `setStep(step)` | Records which step the form is showing. |
| `setProcessing(processing)` | Flips `isProcessing`. Call it around a submit so buttons can disable. |
| `setError(field, error)` | Adds or replaces one message in `errors`. Use `general` as the field for a whole-order failure. |
| `clearError(field)` | Drops one field's message. |
| `clearAllErrors()` | Empties `errors` — what the form calls before each submit. |
| `updateFormData(data)` | Merges keys into `formData`, leaving untouched keys alone. It does not validate and does not recalculate totals. |
| `setPaymentToken(token)` | Stores the token from the hosted card fields for the next submit. |
| `setPaymentMethod(method)` | Sets how the shopper is paying. No API call; the choice is sent with the order. |
| `setShippingMethod(method)` | Records the chosen shipping option. Totals do not change until the cart recalculates — use the cart operation `setShippingMethod` when the price should update. |
| `setBillingAddress(address)` | Replaces the separate billing address. |
| `setSameAsShipping(same)` | Switches billing between "same as shipping" and the separate address. |
| `setTestMode(testMode)` | Marks this checkout as a test order. |
| `addVoucher(code)` | Appends a code without normalising it and without recalculating. Prefer `sdk.applyCoupon(code)`, which does both. |
| `removeVoucher(code)` | Removes a matching code (normalised the same way `addVoucher`/`applyCoupon` store it) without recalculating. Prefer `sdk.removeCoupon(code)`. |
| `reset()` | Returns every field to its initial value — step 1, empty form, no coupons, `credit-card`. Use it after an order completes so the next checkout in the same tab starts clean. |

## What the data looks like

```json
{
  "step": 2,
  "isProcessing": false,
  "errors": {},
  "formData": {
    "email": "dana@example.com",
    "fname": "Dana",
    "lname": "Whitfield",
    "address1": "412 Sunset Blvd",
    "city": "Austin",
    "province": "TX",
    "postal": "78701",
    "country": "US",
    "phone": "+15125550142",
    "accepts_marketing": true
  },
  "paymentMethod": "credit-card",
  "shippingMethod": { "id": 2, "name": "Express (2 days)", "code": "express", "price": 9.99 },
  "sameAsShipping": true,
  "testMode": false,
  "vouchers": ["SAVE10"]
}
```

## Cautions

- **Persistence is filtered, so "I added a field and it resets" is the expected outcome.** Only the fields listed in `partialize` (`step`, `formData`, `shippingMethod`, `billingAddress`, `sameAsShipping`, `paymentMethod`, `vouchers`) reach sessionStorage. Add your field to that list if it must survive a reload — and leave it out if it touches card data.
- **Coupons live here, not in the cart store.** `useCartStore.vouchers` is refreshed from this store every time totals are recalculated, so writing a coupon into the cart store is overwritten on the next recalculation and the API never sees it. Write here via `sdk.applyCoupon()`.
- **Express payment choices do not survive a reload.** `apple_pay`, `google_pay`, and `paypal` are rewritten to `credit-card` on the way to storage, so a refreshed page shows the card form. Re-offer the express buttons on load rather than trusting the stored method.
- **Card data is never in this store after a reload.** `paymentToken` is not persisted and CVV, card number, and expiry are stripped from `formData`. A "resume checkout" flow has to send the shopper back through the hosted card fields.
- **`reset()` is not called for you when an order completes.** A tab that finishes one order and starts another keeps the previous shopper's form data and coupons in sessionStorage. Call `reset()` once the order is confirmed.
