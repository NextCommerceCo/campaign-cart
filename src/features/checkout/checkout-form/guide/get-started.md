---
title: "Features/Checkout/Checkout Form/Get Started"
group: "Features"
category: "Checkout Form"
---

# Get Started

<!-- Generated from the feature manifest and its e2e fixture. Do not edit by
     hand: edit <feature>.manifest.ts or the fixture, then run
     `npm run docs:reference`. -->

Turning on `checkout-form` on a page that already loads the SDK.

## Prerequisites

- The SDK is loaded and the page has an API key in its `<head>`:
  ```html
  <meta name="next-api-key" content="{YOUR_CAMPAIGN_API_KEY}">
  ```
- `cartStore` — the order is built from the cart; submitting with an empty one throws rather than being prevented.

## Turn it on

Put `data-next-checkout` on the element. Nothing registers the feature in JavaScript — the attribute in your markup is the whole wiring step, matched by `form[data-next-checkout]`.

These attributes are required:

| Attribute | Type | What it does |
|---|---|---|
| `data-next-checkout` | `boolean (presence)` | Marks the `<form>` as the checkout. |
| `data-next-checkout-field` | `string (field name)` | Marks an input as a checkout field and names it. |

Everything else is optional — see [attributes.md](./reference/attributes.md).

### A minimal checkout form

```html
<!-- A minimal checkout form. Wrap each field in a .form-group: validation
     errors are styled on that wrapper, so a field without one cannot show
     its error state. -->
<form data-next-checkout>
  <div class="form-group">
    <label for="email">Email</label>
    <input
      type="text"
      id="email"
      data-next-checkout-field="email"
      name="email"
    />
  </div>
  <div class="form-group">
    <label for="fname">First name</label>
    <input
      type="text"
      id="fname"
      data-next-checkout-field="fname"
      name="fname"
    />
  </div>
  <div class="form-group">
    <label for="lname">Last name</label>
    <input
      type="text"
      id="lname"
      data-next-checkout-field="lname"
      name="lname"
    />
  </div>
  <button type="submit">Complete order</button>
</form>
```

This is the markup `e2e/fixtures/checkout-form.html` uses, so it is known to work against the current SDK. See [tested-example.md](./reference/tested-example.md).

## Check it worked

- With `?debug=true` on the URL, the console shows `CheckoutFormEnhancer initialized` under `CheckoutFormEnhancer`. No line means the feature never activated — check the activating attribute is spelled exactly as above.
- It emits `checkout:form-initialized`, `checkout:spreedly-ready`, `checkout:location-fields-shown`, and more. Listen for one to confirm it is running:
  ```js
  window.nextReady.push(() => {
    next.on('checkout:form-initialized', payload => console.log(payload));
  });
  ```
- It sets `next-error`: on a field's error message element when validation fails, alongside `next-error-field` on the input itself. Watch that class in the element inspector — it is the quickest check that state is tracking.

## Next steps

- [overview.md](./overview.md) — what it does and why it is built this way
- [reference/attributes.md](./reference/attributes.md) — every attribute
- [reference/events.md](./reference/events.md) — payloads you can hook
- [relations.md](./relations.md) — what it needs, and what breaks it
- [reference/errors.md](./reference/errors.md) and [reference/logs.md](./reference/logs.md) — when it does not work
