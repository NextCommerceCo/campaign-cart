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

Still in the enhancer: field scanning/population, address and country management, payment,
and order submission. The money path (order submission) is deliberately last.

### Shared by the features above

| Path | Class | Purpose |
|---|---|---|
| `processors/express-checkout-processor.ts` | `ExpressCheckoutProcessor` | Handles express payment flows |
| `managers/order-manager.ts` | `OrderManager` | Builds and submits the order API call. Takes an `IApiClient` — see [`api/README.md`](../../api/README.md) |
| `services/credit-card-service.ts` | `CreditCardService` | Tokenizes card data (Stripe/Braintree) |
| `services/ui-service.ts` | `UIService` | Manages form UI state (errors, loading, button) |
| `validation/checkout-validator.ts` | `CheckoutValidator` | Field validation rules |
| `builders/order-builder.ts` | `OrderBuilder` | Assembles `CreateOrder` payload |
| `address-autocomplete/` | `AddressAutocompleteEnhancer` | Address suggestions in the form |
| `constants/` | — | Field mappings, selectors, payment icons, validation config |
| `utils/`, `debug/` | — | URL/redirect helpers and the checkout debug panel |
| `checkout.types.ts` | — | Types shared across the checkout features |
| `tests/` | — | Tests for the shared pieces above (`OrderBuilder`). A feature's own tests live in that feature's folder |

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
Reads `[data-next-payment-method]` or `[os-payment-method]` elements. Supported values: `credit`, `paypal`, `apple-pay`, `google-pay`, `klarna`.

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

`CheckoutValidator` validates fields on submit and optionally on blur. Validation rules are defined in `constants/validation-config.ts`.

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
  → emit('order:completed', order)
  → handleOrderRedirect(order):
      • resolve redirect URL (payment_complete_url > meta > order_status_url > fallback)
      • cartStore.reset() + checkoutStore.reset()  ← clears items, vouchers, form state
      • window.location.href = finalUrl
  → Analytics: nextAnalytics + EcommerceEvents.purchase()
```

### Post-success state reset

Immediately before navigation, `handleOrderRedirect()` resets `cartStore` (items, vouchers, shipping method, totals) and `checkoutStore` (form data, payment token, billing address, vouchers). Zustand’s `persist` middleware writes the cleared state to `sessionStorage` synchronously, so the confirmation / upsell page loads with an empty cart and no leftover coupons.

Reset runs only when a redirect URL is resolved. If none is available the `order:redirect-missing` event is emitted with cart and checkout state intact, so a merchant’s fallback handler can retry or recover.
