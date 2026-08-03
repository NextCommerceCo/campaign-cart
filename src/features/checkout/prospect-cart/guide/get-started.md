---
title: "Features/Checkout/Prospect Cart/Get Started"
group: "Features"
category: "Prospect Cart"
---

# Get Started

<!-- Generated from the feature manifest and its e2e fixture. Do not edit by
     hand: edit <feature>.manifest.ts or the fixture, then run
     `npm run docs:reference`. -->

Turning on `prospect-cart` on a page that already loads the SDK.

## Prerequisites

- The SDK is loaded and the page has an API key in its `<head>`:
  ```html
  <meta name="next-api-key" content="{YOUR_CAMPAIGN_API_KEY}">
  ```
- [`checkout-form`](../../../checkout/checkout-form/guide/overview.md) is on the page — it is not scanned from the DOM at all — the checkout form constructs it when the form carries `data-auto-create`. Without a `[data-next-checkout]` form it never runs.

## Turn it on

Put `data-next-checkout` on the element. Nothing registers the feature in JavaScript — the attribute in your markup is the whole wiring step, matched by `form[data-next-checkout]`.

### Capturing an abandoned cart from a part-filled form

```html
<!-- There is no prospect-cart attribute of its own: you turn it on with two
     attributes on the checkout form. With trigger-on="emailEntry" the cart is
     captured as soon as email and both names are valid and the cart has items
     — so an abandoned checkout is still recorded. The form then fires a
     next:prospect-cart-created DOM event you can listen for. -->
<form data-next-checkout data-auto-create="true" data-trigger-on="emailEntry">
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
</form>
```

This is the markup `e2e/fixtures/prospect-cart.html` uses, so it is known to work against the current SDK. See [tested-example.md](./reference/tested-example.md).

## Check it worked

- With `?debug=true` on the URL, the console shows `ProspectCartEnhancer initialized` under `ProspectCartEnhancer`. No line means the feature never activated — check the activating attribute is spelled exactly as above.

## Next steps

- [overview.md](./overview.md) — what it does and why it is built this way
- [reference/attributes.md](./reference/attributes.md) — every attribute
- [relations.md](./relations.md) — what it needs, and what breaks it
- [reference/errors.md](./reference/errors.md) and [reference/logs.md](./reference/logs.md) — when it does not work
