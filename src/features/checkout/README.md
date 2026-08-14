# Checkout Enhancers

Handles the checkout form: field collection, validation, payment processing, order creation, and express checkout (PayPal, Apple Pay, Google Pay).

## Layout

Each feature is a folder holding its enhancer, its manifest, its `guide/`, and its tests —
import the folder (`@/features/checkout/checkout-form`), never the inner file. Everything
below the features is **shared by more than one of them**, which is why it stays at this
level rather than inside a feature.

### Features

| Folder | Class | Activated by | Purpose |
|---|---|---|---|
| `checkout-form/` | `CheckoutFormEnhancer` | `form[data-next-checkout]` | The checkout form: fields, validation, payment, order creation. Being split — see below |
| `checkout-review/` | `CheckoutReviewEnhancer` | `[data-next-enhancer]` | Displays stored checkout data for review |
| `express-checkout-container/` | `ExpressCheckoutContainerEnhancer` | `[data-next-express-checkout="container"]` | Container for PayPal / Apple Pay / Google Pay |
| `prospect-cart/` | `ProspectCartEnhancer` | `form[data-next-checkout]` — but **not via the scanner** | Saves the prospect (email capture) before the order, for abandoned-cart recovery |

`prospect-cart/` is the exception worth knowing: its manifest documents the same
`form[data-next-checkout]` as the form itself, because that is the markup that brings it to
life — but `AttributeScanner` never instantiates it. `CheckoutFormEnhancer.initializeProspectCart()`
constructs it and drives it from the form's email field, so it exists only where an
enhanced checkout form does. Grepping the scanner for it finds nothing; that is expected,
not a missing registration.

### Inside `checkout-form/` — an in-progress split

`checkout-form.enhancer.ts` was 3,826 lines. It is being reduced by lifting cohesive
clusters into sibling modules, **lowest-coupling first**, with the E2E suite as the net.
Each module takes a small explicit **context object** instead of reaching into the enhancer
— the same shape `features/cart/accept-upsell` uses — so the coupling is the context's
field list and nothing more.

| Module | What it owns | Needs from the form |
|---|---|---|
| `phone-input.ts` | `intl-tel-input` wiring for the shipping and billing phone fields, so the order carries an E.164 number rather than typed text | 7 fields |
| `billing-animation.ts` | Expanding/collapsing the billing section (height animation + a fallback for when `transitionend` never fires) | 3 fields |
| `billing-form-setup.ts` | Cloning the shipping form into a billing one, rewriting each field's identity to `billing-`, and setting the section's opening state without animation | 3 fields |
| `expiration-fields.ts` | The card expiry month/year dropdowns, including the rule that keeps the year list consistent with the chosen month so an already-past date cannot be assembled | 1 field |
| `country-fields.ts` | The country dropdowns, and relabelling "state"/"postcode" per the chosen country (province, county, prefecture — required or not) | 4 fields |
| `state-fields.ts` | Refilling the state/province dropdown per country, including hiding it entirely for countries with neither states nor a requirement | 4 (billing) / 8 (shipping) |
| `autofill-detection.ts` | Polling for **browser** autofill, which fires no events — without it the store stays empty while the form looks full, and the order submits blank | 4 fields |
| `field-validation-display.ts` | The error/tick states as a shopper interacts: blur commits a verdict (but never errors an empty field), input only clears, change validates a value that arrived without typing | 2 fields |
| `field-scanning.ts` | Which elements on the page become order data — the `data-next-checkout-field` / `os-checkout-field` scan, the submit button, the payment buttons, and the two name↔element lookups | 4 (scan) / 2 (lookup) |
| `form-population.ts` | Putting the stored checkout data back into the boxes after a reload or a step back, and the reverse: emptying every box and resetting the store after a duplicate-purchase warning | 7 (populate) / 5 (clear) |
| `location-field-visibility.ts` | The city/state/postcode rows that stay collapsed until a street address exists — shipping and billing each with their own element list and their own one-way latch | 6 |
| `country-selection.ts` | Which country the shipping form opens on (stored → URL → session → detected), and pointing both address forms at a country chosen outside the form | 3 (resolve) / 6 (apply) |
| `multi-step-navigation.ts` | Recognising that this form is one step of several, and the validate-then-navigate that replaces order creation on it | 3 (detect) / 8 (navigate) |
| `duplicate-purchase-warning.ts` | The "you have already paid" modal a shopper meets on a checkout that still holds a completed order, and the two answers to it | 4 |
| `billing-toggle.ts` | The "different billing address" checkbox: the mid-animation guard, the 10 ms debounce, the store write, and seeding the billing country on open | 5 |
| `method-selection.ts` | The two radio groups — which payment method's fields are shown, and which shipping method the cart recalculates on | 1 (payment) / 2 (shipping) |
| `test-order.ts` | The debug panel's "fill test data", and the Konami code that fills the form and places a **real** test order | 3 (fill) / 6 (Konami) |
| `meta-tags.ts` | Where the checkout sends the visitor next, written as `<meta>` tags — the door `setSuccessUrl` / `setFailureUrl` open | 0 |
| `prospect-cart-lifecycle.ts` | Bringing the prospect cart to life on a checkout form — constructing it against the form, starting it, and logging the two events it reports back. Failure is warned and swallowed: a prospect cart is a marketing convenience, never a condition of buying | 3 |
| `payment-error-display.ts` | The banner a shopper sees when a payment is declined, and the re-entrancy guard that keeps it from announcing itself into an infinite loop — the display emits the event the listener handles | 3 (display) / 3 (listen) |
| `store-subscriptions.ts` | What the form does when state changes underneath it rather than because the shopper touched something: store errors onto fields, address rows opened, submit button disabled while processing, cart emptiness noted, and the card fields built if the Spreedly key arrives after boot | 3 (checkout) / 1 (cart) / 3 (config) |
| `postal-code-format.ts` | Rewriting a postcode into its country's shape as it is typed, and putting the caret back where the shopper left it | 2 fields |
| `field-value.ts` | What a field is *worth* to the order — a phone as E.164, a checkbox as a boolean, everything else as typed | 1 field |
| `billing-field-routing.ts` | Where a `billing-*` value goes: renamed to the orders API's spelling (`fname` → `first_name`) on its way into `billingAddress`, plus the billing postcode and province dropdown | 3 fields |
| `contact-persistence.ts` | What happens once the shopper *finishes* with a contact field — the prospect cart's email, user-data storage, and creating the prospect cart. Never on `input` | 3 fields |

Each has a colocated test in `checkout-form/tests/`.

**Two rules learned the hard way while doing this** — both cost a red test:

- **Extract verbatim; do not tidy in the same step.** Factoring two near-identical
  fallbacks into one helper collapsed two separately-searchable log strings into a
  templated one. Log strings are a contract, *and* a templated message is not a literal at
  the `logger.*` call — so the generator stops being able to read it and the line vanishes
  from `reference/logs.md` entirely.
- **A `logger` call moving file changes its published anchor**, so `logs.md` needs
  regenerating (`UPDATE_DOCS=1 npm run docs:reference`). That regeneration is the drift test
  telling you the docs followed the code — not a nuisance.

### What is left, and the proposed seams

The first **seven** modules came out **verbatim** — cohesive clusters with 1–8 dependencies,
so lifting them changed no behaviour by construction. `field-validation-display.ts` is the
first that did not: its body was restructured into named helpers (`handleBlur`,
`handleInput`, `handleChange`, `markValid`, `clearErrorLabels`) because the original was one
120-line `if/else if` chain where the three interactions' *differences* were the whole
point and were invisible. Same behaviour, different shape — which is why it needs tests in
a way the verbatim ones did not.

The remaining big methods need a *designed* seam rather than a move. Measured, not
estimated (`handleFieldChange` as it now stands, after the display half came out):

| Method | Lines | `this.` fields | `this.` calls |
|---|---|---|---|
| `handleFormSubmit` | 240 | 11 | 5 |
| `initialize` | ~~223~~ → 59 | ~~18~~ | ~~18~~ — **done, see below** |
| `handleFieldChange` | ~~168~~ → 26 | ~~9~~ | ~~7~~ — **done, see below** |

**`handleFieldChange` — done, and it was never two halves.** It looked like one big switch
but was really **two** fused: one half branches on the *field name* to route a value into
the store, the other branched on the *event type* (`blur` / `input` / `change`) to show or
clear errors. Two independent jobs sharing one entry point. **The event-type half is now
`field-validation-display.ts`** — it needed only two things from the form despite the whole
method touching nine, which is the evidence the split was real.

The field-name half was billed as "the more entangled of the two, because it writes to the
store and drives the state dropdowns". Measured, that was wrong twice over. Its 9 fields and
7 calls are not shared: they partition into **seven small jobs run in sequence**, each
needing 1–3 things — a pipeline, not a knot. And routing a value is only two of those seven.
The rest are a postcode formatter, an analytics event, cross-page contact storage, the
prospect cart's lifecycle, and a *second* validation pass over four fields. Naming the jobs
is what the method needed; four of them came out as modules with 1–3 dependencies, and the
three that reach into the form's own state stayed as named steps under a
`FIELD VALUE ROUTING` banner, in the order they run.

One thing deliberately did **not** come out: the `add_shipping_info` block. It is nearly
identical to the copy in `autofill-detection.ts`, but the two log *different* reasons
(`address complete` vs `browser autofill`). Sharing them would collapse two literal log
strings into one templated message — which is exactly the mistake the second rule above
records, and would delete both lines from the published `logs.md`. Duplication was the
cheaper price.

`tests/field-routing.test.ts` pins the dispatch and the step order; each module has its own
colocated test. Four defects those tests reproduce are documented at the test and **left as
found** — see the `DEFECT:` tests. The one that reaches an order: a **billing** phone is
stored as the national text the shopper typed, overwriting the E.164 number
`phone-input.ts` wrote on the same event, because the E.164 arm of the value reader tests
for `billing-phone` inside a branch the billing prefix already excluded. The shipping phone
is unaffected.

**`handleFormSubmit` — split by submit path.** Its five calls
(`validateExpressCheckoutFields`, `processOrder`, `handleStepNavigation`,
`displayPaymentError`, `handleError`) reveal three distinct routes: express checkout,
multi-step navigation, and the normal order submit. Extract one function per route behind a
thin dispatcher. **This is the money path** — each route needs its own E2E before and after,
not just the suite as a whole.

**`initialize` — re-sequenced, not extracted (done).** With 18 fields and 18 calls it touched
nearly the whole class, so pulling pieces out would have produced a context object that was
simply the enhancer again. What it actually is, is a **boot sequence**: an ordered list of
named steps, the shape `core/sdk-initializer.ts` already has. It now reads as one: 223 lines
became 59, a 25-step sequence — 15 of them new private methods listed under a
`BOOT SEQUENCE STEPS` banner in the order they run — with every line moved verbatim and no
statement reordered. Extraction was the wrong tool; nothing left the file.

The order is the contract, so it is asserted rather than described: `tests/boot-sequence.test.ts`
replaces every step with a recorder and compares the recorded order against the full list,
including the one conditional step (`initializeCreditCard`, which runs only when a Spreedly
environment key is configured).

**Field scanning/population and address management — done, and neither was one cluster.**
"Field scanning/population" was two: finding the elements (`field-scanning.ts`) and moving
values between them and the store (`form-population.ts`). "Address management" was three:
choosing and applying a country (`country-selection.ts`), loading its provinces (already
`state-fields.ts`), and the collapsed address rows (`location-field-visibility.ts`), which
share almost no dependencies. `initializeAddressManagement` measured 10 fields and 6 calls —
`initialize`'s situation, not an extraction's — so it was **re-sequenced in place** into four
named steps with only the country-priority chain lifted out.

Nine defects those modules' tests pin down are left as found. The two that reach a shopper:
a page whose billing rows use `data-next-component-location="billing-location"` gets rows
that are never managed at all, and `initializeLocationFieldVisibility`'s billing check reads
`formData['billing-address1']`, a key nothing in the SDK writes — the billing rows appear
today only because `restoreBillingAddress` runs first. Reorder those two boot steps and a
returning shopper's billing address rows stay hidden.

Also still in the enhancer: the credit-card / Spreedly wiring, `handleFormSubmit` and its three
routes, `createTestOrder`, `getNextPageUrlFromMeta`, and **teardown — measured at 109 lines and
23 fields and deliberately left in place.** It fails the 1-8 threshold worse than `initialize`
(18) or `initializeAddressManagement` (10) did, and it is already the flat ordered named-step
shape that re-sequencing produces, so re-sequencing would add methods without removing a line.

**The six clusters above came out verbatim, and every one measured 1-8 dependencies** - the
threshold `initialize` (18) and `initializeAddressManagement` (10) failed. Fifteen defects
those modules' tests pin down are left as found. The four that reach a shopper: a
non-numeric `data-next-step-number` becomes `NaN`, and `validateStep` passes any step that
is not 1, 2 or 3 - so that gate checks nothing and an empty form reaches payment; the
duplicate-purchase modal can open twice (boot *and* bfcache restore) because the "already
warned" mark is written only after the shopper answers; its "Close" path calls
`populateFormData()` without awaiting it and then clears the form, so the previous order's
address can reappear in a form that was just emptied; and the shipping-method table is
hard-coded to ref_id 1/2/3 with hard-coded prices, so on any other campaign clicking a
shipping method does nothing at all - no store write, no recalculation, no log.

**One order payload, one builder.** The enhancer used to hand-assemble its own `CreateOrder`
alongside `OrderBuilder`, and the two disagreed about the shipping-method fallback. Every
path — normal submit, express, and the test order — now builds through
[`builders/order-builder.ts`](./builders/order-builder.ts), so a cart produces the same
`shipping_method` and the same `payment_detail` whichever route the shopper walked. Do not
re-introduce a second assembler: a payload built anywhere else is a payload that drifts.

### Shared by the features above

| Path | Class | Purpose |
|---|---|---|
| `processors/express-checkout-processor.ts` | `ExpressCheckoutProcessor` | Handles express payment flows |
| `managers/order-manager.ts` | `OrderManager` | Builds and submits the order API call. Takes an `IApiClient` — see [`api/README.md`](../../api/README.md) |
| `services/credit-card-service.ts` | `CreditCardService` | Tokenizes card data (Stripe/Braintree) |
| `services/ui-service/` | `UIService` | Manages form UI state (errors, loading, payment forms, floating labels). Split — see below |
| `validation/` | `CheckoutValidator` | Field validation rules. Split — see below |
| `builders/order-builder.ts` | `OrderBuilder` | Assembles `CreateOrder` payload |
| `address-autocomplete/` | `AddressAutocompleteEnhancer` | Address suggestions in the form |
| `constants/` | — | Field mappings, selectors, payment icons, validation config |
| `utils/`, `debug/` | — | URL/redirect helpers and the checkout debug panel |
| `checkout.types.ts` | — | Types shared across the checkout features |
| `tests/` | — | Tests for the shared pieces above (`OrderBuilder`). A feature's own tests live in that feature's folder |

#### Inside `services/ui-service/` — split by layer

`ui-service.ts` was 1,080 lines holding four unrelated jobs. It is now a folder whose
`ui-service.ts` is an orchestrator: it owns the mutable state and delegates each job to a
module taking an explicit **context object**, the same shape the `checkout-form/` modules
use. `index.ts` keeps the import path callers already use — `../services/ui-service` — so
nothing outside the folder changed.

| Module | What it owns | Needs from the service |
|---|---|---|
| `loading-state.ts` | Which sections are busy, and the progress bar. The form is `next-processing` while **any** section is, which is why the per-section map exists | 3 fields |
| `field-error-display.ts` | Validation messages on the fields, scroll-and-focus to the first problem, and the ARIA that describes both | 5 fields |
| `payment-form-display.ts` | Revealing the chosen payment method's fields and collapsing the rest — snapped at startup from the store, animated on a change | 3 fields |
| `floating-labels.ts` | Labels that float above filled inputs, including the poll that catches browser autofill and the bridge for the hosted card fields | 5 fields |

Each has a colocated test in `ui-service/tests/`. Three defects those tests pin down are
left as found, each documented at the test that reproduces it: switching payment method
twice inside 300 ms leaves the deselected form open, `updateFieldState('valid')` leaves the
error icon and message behind, and `enhanceAccessibility` looks for the message in the
field's parent while `ErrorDisplayManager` writes it to the `.form-group`. **And nothing
calls `UIService.destroy()`** — `CheckoutFormEnhancer.destroy()` tears down its validator,
card service, prospect cart, phone inputs, and autocomplete, but not this service, so the
autofill poll and every label listener outlive the form.

#### Inside `validation/` — split by layer

`checkout-validator.ts` was 777 lines. `CheckoutValidator` is now an orchestrator: it owns
the mutable pieces (the rule table, the map of fields currently failing, and the two
services the form installs after startup) and delegates each job to a sibling module taking
an explicit **context object**, the same shape `ui-service/` uses. The file name is
unchanged, so `../validation/checkout-validator` still resolves and nothing outside the
folder moved.

| Module | What it owns | Needs from the validator |
|---|---|---|
| `validation-patterns.ts` | Whether one value looks like an email, phone, name or city — with no knowledge of forms or countries | 0 |
| `field-labels.ts` | The name a shopper sees for a field in a message, including the country's word for "state" and "postcode" | 0 |
| `first-error-field.ts` | Which of several problems to scroll to (topmost on the page), and handing card fields to Spreedly's own focus | 0 |
| `field-rules.ts` | The per-field rule table and running one rule — the path used while the shopper types | 2 |
| `billing-address-validation.ts` | The separate billing address, which arrives with API field names and gets "Billing …" messages | 2 |
| `error-display.ts` | Remembering which fields failed and putting that on the page — clearing an error never marks a field correct | 4 |
| `form-validation.ts` | The submit-time verdict: every problem at once, plus card and billing | 4 |
| `step-validation.ts` | One step of a multi-step checkout; step 3 hands over to the form check | shares `form-validation`'s 4 |

Each has a colocated test in `validation/tests/`, plus `checkout-validator.test.ts` pinning
the public surface the form calls. Everything came out **verbatim** — the only shape change
is braces around the `postal` arm of `applyRule`, so its `const` is scoped to the case
rather than the switch.

Those tests pin down a set of defects, each documented at the test that reproduces it and
**left as found** — this is the checkout path, and changing which orders are accepted is
not a refactor. The two that block a sale: `isValidName` is Latin-1 only, so a name in any
other script cannot be entered (while the city check next door accepts every script), and
neither the name nor the city pattern contains the curly apostrophe an iPhone keyboard
produces. The two that let a bad order through: `validateStep(3)` passes `billingAddress:
undefined, sameAsShipping: true` unconditionally, so a multi-step checkout never validates
a separate billing address; and every card check sits inside `if (creditCardService)` with
no `else`, so a form whose Spreedly key never arrived is pronounced valid with the card
fields empty. See the `DEFECT:` tests in `validation/tests/` for the rest.

**Attributes and errors documented by `checkout-form` are read and thrown in the shared
folders** — `ui-service` reads `data-next-payment-method`, `order-manager` and
`credit-card-service` throw four of its documented errors. Its manifest claims them with
`src/`-relative `extraSource` entries; if you move any of these folders, update that list
or the attribute and error drift checks stop seeing the code.

---

## CheckoutFormEnhancer

**Attribute:** `data-next-checkout` on `<form>` element (must be a `<form>`).

The main enhancer that coordinates the entire checkout flow.

```html
<form data-next-checkout data-next-checkout-type="standard">
  <!-- fields, payment, submit -->
</form>
```

### Responsibilities
1. **Field collection** — finds all `[data-next-checkout-field]` and `[os-checkout-field]` inputs
2. **Validation** — delegates to `CheckoutValidator` on submit and field blur
3. **Credit card tokenization** — delegates to `CreditCardService`
4. **Order creation** — delegates to `OrderManager` / `OrderBuilder` → `ApiClient`
5. **Country/state** — uses `CountryService` to populate state dropdowns
6. **Phone input** — integrates `intl-tel-input` for international phone formatting
7. **Billing address** — toggle for separate billing address (`[data-next-component="different-billing-address"]`)
8. **Prospect save** — email capture via `ProspectCartEnhancer` before full order
9. **Express checkout** — delegates PayPal/Apple Pay/Google Pay to `ExpressCheckoutProcessor`
10. **Loading overlay** — shows `LoadingOverlay` during API call
11. **Analytics** — fires ecommerce events via `nextAnalytics`

### Form field attributes
Fields are found by either:
- `data-next-checkout-field="fname"` (new convention)
- `os-checkout-field="fname"` (legacy convention)

Standard field names: `fname`, `lname`, `email`, `phone`, `address1`, `address2`, `city`, `province`, `postal`, `country`, `card-number`, `card-expiry`, `card-cvv`, `card-name`

### Payment method detection
Reads `[data-next-payment-method]` or `[os-payment-method]` elements. Supported values: `credit_card`, `paypal`, `apple_pay`, `google_pay`, `klarna`, `affirm`, `bancontact`, `giropay`, `ideal`, `link`, `sepa_debit`, `sofort`, `swish`, `twint` — underscores, matching every other place the SDK names a method. Separators and case are ignored (`apple-pay` = `apple_pay`), and `constants/field-mappings.ts` holds the one table that maps a value to the store's name and on to the API's. A value the table does not list is passed through to the orders API unchanged rather than read as a card, so the API decides whether it can be charged.

### Shipping / billing form containers
- `[data-next-component="shipping-form"]` or `[os-checkout-component="shipping-form"]`
- `[data-next-component="billing-form"]` or `[os-checkout-component="billing-form"]`
- `[data-next-component="different-billing-address"]` — toggle container for billing address visibility

---

## CheckoutReviewEnhancer

**Attribute:** `data-next-enhancer="checkout-review"` on a container.

Displays previously entered checkout data (from `checkoutStore`) for a multi-step review page.

```html
<div data-next-enhancer="checkout-review">
  <span data-next-checkout-review="email"></span>
  <span data-next-checkout-review="fname" data-next-format="text"></span>
  <span data-next-checkout-review="shippingAddress" data-next-format="address"></span>
</div>
```

### Child attributes
- `data-next-checkout-review="<field>"` — field name from `checkoutStore.formData`
- `data-next-format` — `text` (default), `address`, `name`, `phone`, `currency`
- `data-next-fallback` — fallback text when field is empty

---

## ExpressCheckoutContainerEnhancer

**Attribute:** `data-next-express-checkout="container"`

Container for express payment buttons. Manages visibility of PayPal/Apple Pay/Google Pay buttons based on device/browser capabilities.

```html
<div data-next-express-checkout="container">
  <div data-next-express-checkout="paypal"><!-- PayPal button --></div>
  <div data-next-express-checkout="apple_pay"><!-- Apple Pay button --></div>
  <div data-next-express-checkout="google_pay"><!-- Google Pay button --></div>
</div>
```

---

## Validation

`CheckoutValidator` validates fields on submit and optionally on blur. The rules live in `validation/`: `validation/field-rules.ts` builds the per-field rule set, `validation/validation-patterns.ts` holds the email/phone/name checks, and `validation/field-labels.ts` turns a field name into the wording an error message uses.

Error display is handled by `UIService` which looks for `[data-next-error="<fieldName>"]` or `[os-checkout-error="<fieldName>"]` elements adjacent to or within each field.

---

## Order Flow

```
User submits form
  → CheckoutFormEnhancer.handleSubmit()
  → CheckoutValidator.validate()   (show errors if invalid)
  → CreditCardService.tokenize()   (if credit card payment)
  → OrderBuilder.build()           (assemble CreateOrder payload)
  → ApiClient.createOrder()
  → handleOrderRedirect(order):
      • resolve redirect URL (payment_complete_url > meta > order_status_url > fallback)
      • cartStore.reset() + checkoutStore.reset()  ← clears items, vouchers, form state
      • window.location.href = finalUrl

…then, on the page that redirect lands on:

  → useOrderStore.loadOrder(ref_id)   (?ref_id= in the URL, read during boot)
  → emit('order:completed', order)    ← the only producer; the order is paid by now
  → Analytics: dl_purchase, once per order
```

No event is emitted for the *created* order. Express checkout and a card needing
3-D Secure both leave the checkout page unpaid, so reporting there counted orders
nobody paid for — [issue #71](https://github.com/NextCommerceCo/campaign-cart/issues/71).

### Post-success state reset

Immediately before navigation, `handleOrderRedirect()` resets `cartStore` (items, vouchers, shipping method, totals) and `checkoutStore` (form data, payment token, billing address, vouchers). Zustand’s `persist` middleware writes the cleared state to `sessionStorage` synchronously, so the confirmation / upsell page loads with an empty cart and no leftover coupons.

Reset runs only when a redirect URL is resolved. If none is available the `order:redirect-missing` event is emitted with cart and checkout state intact, so a merchant’s fallback handler can retry or recover.
