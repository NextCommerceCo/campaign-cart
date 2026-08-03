---
title: "Features/Checkout/Checkout Review/Get Started"
group: "Features"
category: "Checkout Review"
---

# Get Started

<!-- Generated from the feature manifest and its e2e fixture. Do not edit by
     hand: edit <feature>.manifest.ts or the fixture, then run
     `npm run docs:reference`. -->

Turning on `checkout-review` on a page that already loads the SDK.

## Prerequisites

- The SDK is loaded and the page has an API key in its `<head>`:
  ```html
  <meta name="next-api-key" content="{YOUR_CAMPAIGN_API_KEY}">
  ```
- [`checkout-form`](../../../checkout/checkout-form/guide/overview.md) is on the page — it plays back what the form collected, reading the checkout store the form writes to. On a page with no checkout form there is nothing to show and every slot stays empty.

## Turn it on

Put `data-next-enhancer` on the element. Nothing registers the feature in JavaScript — the attribute in your markup is the whole wiring step, matched by `[data-next-enhancer]`.

These attributes are required:

| Attribute | Type | What it does |
|---|---|---|
| `data-next-enhancer` | `'checkout-review'` | Turns the element into a review block. |
| `data-next-checkout-review` | `string (field name)` | Marks an element as a review slot and names the checkout field to show in it. |

Everything else is optional — see [attributes.md](./reference/attributes.md).

### Playing back what the visitor typed

```html
<!-- Reads the persisted checkout store's formData and renders each field as
     textContent. Empty fields get the next-review-empty class. -->
<div data-next-enhancer="checkout-review">
  <span data-next-checkout-review="email"></span>
  <span data-next-checkout-review="fname"></span>
  <span data-next-checkout-review="lname"></span>
  <span data-next-checkout-review="city"></span>
</div>
```

This is the markup `e2e/fixtures/checkout-review.html` uses, so it is known to work against the current SDK. See [tested-example.md](./reference/tested-example.md).

## Check it worked

- With `?debug=true` on the URL, look for `CheckoutReviewEnhancer` lines in the console. None at all means the feature never activated.

## Next steps

- [overview.md](./overview.md) — what it does and why it is built this way
- [reference/attributes.md](./reference/attributes.md) — every attribute
- [relations.md](./relations.md) — what it needs, and what breaks it
- [reference/errors.md](./reference/errors.md) and [reference/logs.md](./reference/logs.md) — when it does not work
