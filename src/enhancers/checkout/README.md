# Checkout Enhancers

Handles the checkout form: field collection, validation, payment processing, order creation, and express checkout (PayPal, Apple Pay, Google Pay).

## Files

| File | Class | Purpose |
|---|---|---|
| `CheckoutFormEnhancer.ts` | `CheckoutFormEnhancer` | Main checkout `<form>` enhancer |
| `CheckoutReviewEnhancer.ts` | `CheckoutReviewEnhancer` | Displays stored checkout data for review |
| `ProspectCartEnhancer.ts` | `ProspectCartEnhancer` | Saves prospect (email capture) before order |
| `ExpressCheckoutContainerEnhancer.ts` | `ExpressCheckoutContainerEnhancer` | Container for PayPal/Apple Pay/Google Pay |
| `processors/ExpressCheckoutProcessor.ts` | `ExpressCheckoutProcessor` | Handles express payment flows |
| `managers/FieldManager.ts` | `FieldManager` | Finds and reads form fields |
| `managers/OrderManager.ts` | `OrderManager` | Builds and submits the order API call |
| `services/CreditCardService.ts` | `CreditCardService` | Tokenizes card data (Stripe/Braintree) |
| `services/UIService.ts` | `UIService` | Manages form UI state (errors, loading, button) |
| `validation/CheckoutValidator.ts` | `CheckoutValidator` | Field validation rules |
| `builders/OrderBuilder.ts` | `OrderBuilder` | Assembles `CreateOrder` payload |
| `constants/` | — | Field mappings, selectors, payment icons, validation config |

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
  → On success: redirect or emit purchase event
  → Analytics: nextAnalytics + EcommerceEvents.purchase()
```
