import { defineStore } from '@/docs/schema/state-manifest';

export default defineStore({
  id: 'checkout',
  storeHook: 'useCheckoutStore',
  stateInterface: 'CheckoutState',
  interfaceFile: 'state/checkout/checkout.state.ts',
  summary:
    'Holds the checkout the shopper is part-way through: the contact and address fields they have typed, the payment and shipping they picked, the coupon codes they entered, and whether an order is currently being submitted.',

  persistence: {
    mechanism: 'zustand-persist',
    key: 'next-checkout-store',
    newFieldRule:
      'a new field is **not** persisted until you add it to the `partialize` list in `checkout.state.ts`. This store writes a hand-picked subset, so a field you add reads back as its initial value after a reload and the bug looks like "the form forgot what I typed". Add it to `partialize` deliberately — and never add anything carrying card data, which is exactly what that filter exists to keep out of sessionStorage.',
  },

  fields: [
    {
      name: 'step',
      kind: 'persisted',
      description:
        'Which step of a multi-step checkout the shopper reached, starting at 1. A single-page checkout leaves it at 1 for the whole flow.',
      notes:
        'The checkout form reads its step from the `data-next-step-number` attribute on the form and writes it here — the value flows DOM → store, never back. Writing `setStep(2)` moves no one to step 2; it only relabels what the store reports.',
    },
    {
      name: 'isProcessing',
      kind: 'transient',
      description:
        'True while an order is being submitted. Use it to disable the submit button: a card charge is not reversible from the page, so a second click risks a second attempt.',
    },
    {
      name: 'errors',
      kind: 'transient',
      description:
        'Validation and submission messages, keyed by the form field they belong to — `email`, `phone`, and `billing-phone` are typical keys. The key `general` holds a whole-order failure such as a declined payment rather than a single bad field. An empty map means nothing has failed since the last clear.',
      notes:
        'Deliberately excluded from persistence, so a reload shows a clean form even if the previous attempt was declined. If you need the shopper to see why the order failed after a reload, re-run validation — do not expect the message to still be here.',
    },
    {
      name: 'formData',
      kind: 'persisted',
      description:
        'Everything the shopper typed into the checkout form, keyed by field name — `email`, `fname`, `lname`, `address1`, `address2`, `city`, `province`, `postal`, `country`, `phone`, `accepts_marketing`, plus the `billing-*` variants. This is what the order request is built from, so a missing key here becomes a missing address line on the order.',
      notes:
        'What gets stored is filtered: `cvv`, `card_cvv`, `card_number`, and every expiry variant (`month`, `year`, `expiration_month`, `expiration_year`, `exp-month`, `exp-year`) are stripped before writing, and so is any empty string. Reading `formData.cvv` back after a reload returns `undefined` by design — take card data from the hosted card fields, never from here.',
    },
    {
      name: 'paymentToken',
      kind: 'transient',
      description:
        'The single-use token that stands in for the card the shopper entered, produced by the hosted card fields. `undefined` means no card has been tokenised yet, and the order cannot be submitted as a card payment.',
      notes:
        'Never persisted — a token is payment data with a short life. After a reload the shopper must re-enter the card, so do not build a "resume checkout" flow that assumes the token is still here.',
    },
    {
      name: 'paymentMethod',
      kind: 'persisted',
      description:
        'How the shopper is paying. `credit-card` is the default and covers the hosted card fields; `paypal`, `apple_pay`, and `google_pay` are the express buttons; `card_token` is the API-side spelling of `credit-card` kept for callers that pass the API value straight through. The rest — `klarna`, `affirm`, `bancontact`, `giropay`, `ideal`, `link`, `sepa_debit`, `sofort`, `swish`, `twint` — are redirect methods: the checkout collects no payment details for them, and the shopper finishes paying at the provider the created order points to. Any other string is allowed too and is sent to the orders API unchanged, so a page can offer a method this SDK release does not know by name.',
      notes:
        'Express methods are downgraded on the way to storage: if the shopper picked Apple Pay, Google Pay, or PayPal and then reloads, the store comes back as `credit-card`, because an express session does not survive the page. The symptom is a shopper who "loses" their Apple Pay choice on refresh — expected, not a bug.',
    },
    {
      name: 'shippingMethod',
      kind: 'persisted',
      description:
        "The shipping option the shopper chose, with its id, name, code, and price. `undefined` means they have not chosen one, in which case the order builder falls back to the cart's method, then to the campaign's first shipping method, and only then to shipping method id 1.",
    },
    {
      name: 'billingAddress',
      kind: 'persisted',
      description:
        "The separate billing address, in the form's own field names (`address1`, `city`, `province`, `postal`, `phone`). `undefined` means there is no separate billing address — either the shopper is billing to the shipping address, or they have not filled it in yet.",
      notes:
        'Empty fields are dropped before persisting, and an address whose every field is empty is stored as `undefined` rather than as an empty object. So after a reload a partly-typed billing address comes back with only the filled keys — code that assumes all keys are present will read `undefined` for the rest.',
    },
    {
      name: 'sameAsShipping',
      kind: 'persisted',
      description:
        'Whether the shopper is billing to the shipping address. True by default. When it is true the order is built without a billing address block, and `billingAddress` is ignored even if it holds values.',
    },
    {
      name: 'testMode',
      kind: 'transient',
      description:
        'Whether this checkout is a test order rather than a real purchase. False for a real shopper.',
      notes:
        'Excluded from persistence on purpose, so a test session cannot leak into a later real one in the same tab. It is also not the switch the test-order tooling reads — that lives in `core/test-mode.ts`, so flipping this field alone does not put the page into test mode.',
    },
    {
      name: 'vouchers',
      kind: 'persisted',
      description:
        'The coupon codes currently applied to this checkout. This is the source of truth for coupons — the cart store\'s `vouchers` is a copy written on each totals recalculation, so read coupons from here (or via `sdk.getCoupons()`) and never write them into the cart store directly.',
      notes:
        'Codes go in uppercased and trimmed, and `removeVoucher` normalises the same way before comparing — both `applyCoupon` and `removeVoucher` run every code through the same `normalizeVoucherCode()` (`@/utils/voucher.ts`), so `removeVoucher(\'save10\')` removes a stored `SAVE10`.',
    },
  ],

  operations: [
    {
      name: 'sdk.applyCoupon(code)',
      effect:
        'Uppercases and trims the code, refuses it if it is already in `vouchers` (comparing normalised on both sides, so a code stored un-normalised still dedupes), adds it, then recalculates cart totals against the API. Returns `{ success, message }` — the message is ready to show to the shopper.',
    },
    {
      name: 'sdk.removeCoupon(code)',
      effect:
        'Removes the code from `vouchers` and recalculates totals against the API. Normalises the code the same way `applyCoupon` does before matching, so any casing or surrounding whitespace still finds the stored entry.',
    },
  ],

  setters: [
    { name: 'setStep(step)', effect: 'Records which step the form is showing.' },
    {
      name: 'setProcessing(processing)',
      effect: 'Flips `isProcessing`. Call it around a submit so buttons can disable.',
    },
    {
      name: 'setError(field, error)',
      effect:
        'Adds or replaces one message in `errors`. Use `general` as the field for a whole-order failure.',
    },
    { name: 'clearError(field)', effect: 'Drops one field\'s message.' },
    { name: 'clearAllErrors()', effect: 'Empties `errors` — what the form calls before each submit.' },
    {
      name: 'updateFormData(data)',
      effect:
        'Merges keys into `formData`, leaving untouched keys alone. It does not validate and does not recalculate totals.',
    },
    {
      name: 'setPaymentToken(token)',
      effect: 'Stores the token from the hosted card fields for the next submit.',
    },
    {
      name: 'setPaymentMethod(method)',
      effect: 'Sets how the shopper is paying. No API call; the choice is sent with the order.',
    },
    {
      name: 'setShippingMethod(method)',
      effect:
        'Records the chosen shipping option. Totals do not change until the cart recalculates — use the cart operation `setShippingMethod` when the price should update.',
    },
    { name: 'setBillingAddress(address)', effect: 'Replaces the separate billing address.' },
    {
      name: 'setSameAsShipping(same)',
      effect: 'Switches billing between "same as shipping" and the separate address.',
    },
    { name: 'setTestMode(testMode)', effect: 'Marks this checkout as a test order.' },
    {
      name: 'addVoucher(code)',
      effect:
        'Appends a code without normalising it and without recalculating. Prefer `sdk.applyCoupon(code)`, which does both.',
    },
    {
      name: 'removeVoucher(code)',
      effect:
        'Removes a matching code (normalised the same way `addVoucher`/`applyCoupon` store it) without recalculating. Prefer `sdk.removeCoupon(code)`.',
    },
    {
      name: 'reset()',
      effect:
        'Returns every field to its initial value — step 1, empty form, no coupons, `credit-card`. Use it after an order completes so the next checkout in the same tab starts clean.',
    },
  ],

  example: `{
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
}`,

  cautions: [
    "**Persistence is filtered, so \"I added a field and it resets\" is the expected outcome.** Only the fields listed in `partialize` (`step`, `formData`, `shippingMethod`, `billingAddress`, `sameAsShipping`, `paymentMethod`, `vouchers`) reach sessionStorage. Add your field to that list if it must survive a reload — and leave it out if it touches card data.",
    '**Coupons live here, not in the cart store.** `useCartStore.vouchers` is refreshed from this store every time totals are recalculated, so writing a coupon into the cart store is overwritten on the next recalculation and the API never sees it. Write here via `sdk.applyCoupon()`.',
    '**Express payment choices do not survive a reload.** `apple_pay`, `google_pay`, and `paypal` are rewritten to `credit-card` on the way to storage, so a refreshed page shows the card form. Re-offer the express buttons on load rather than trusting the stored method.',
    '**Card data is never in this store after a reload.** `paymentToken` is not persisted and CVV, card number, and expiry are stripped from `formData`. A "resume checkout" flow has to send the shopper back through the hosted card fields.',
    "**`reset()` is not called for you when an order completes.** A tab that finishes one order and starts another keeps the previous shopper's form data and coupons in sessionStorage. Call `reset()` once the order is confirmed.",
  ],
});
