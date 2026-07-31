---
title: "Features/Display/Order Display/Get Started"
group: "Features"
category: "Order Display"
---

# Get Started

<!-- Generated from the feature manifest and its e2e fixture. Do not edit by
     hand: edit <feature>.manifest.ts or the fixture, then run
     `npm run docs:reference`. -->

Turning on `order-display` on a page that already loads the SDK.

## Prerequisites

- The SDK is loaded and the page has an API key in its `<head>`:
  ```html
  <meta name="next-api-key" content="{YOUR_CAMPAIGN_API_KEY}">
  ```
- `orderStore` — it reads the completed order, loaded from the `?ref_id` in the URL. Opened without one there is no order and every binding stays at its placeholder.

## Turn it on

Put `data-next-display` on the element. Nothing registers the feature in JavaScript — the attribute in your markup is the whole wiring step, matched by `[data-next-display]`.

These attributes are required:

| Attribute | Type | What it does |
|---|---|---|
| `data-next-display` | `string (order path)` | The order value to show, as `order.{path}`. |

Everything else is optional — see [attributes.md](./reference/attributes.md).

### Order values on a receipt page

```html
<!-- OrderDisplayEnhancer auto-loads the order from the ?ref_id URL param. -->
<span id="order-number" data-next-display="order.number">?</span>
<span id="order-total" data-next-display="order.total">?</span>
<a id="order-status" data-next-display="order.statusUrl">Status</a>
```

This is the markup `e2e/fixtures/order-display.html` uses, so it is known to work against the current SDK. See [tested-example.md](./reference/tested-example.md).

## Check it worked

- With `?debug=true` on the URL, look for `OrderDisplayEnhancer` lines in the console. None at all means the feature never activated.
- It sets `next-loaded`: on the element once the order has arrived and its value is rendered. Removed while loading or after a failure, so it is the signal that what is on screen is real. Watch that class in the element inspector — it is the quickest check that state is tracking.

## Next steps

- [overview.md](./overview.md) — what it does and why it is built this way
- [reference/attributes.md](./reference/attributes.md) — every attribute
- [relations.md](./relations.md) — what it needs, and what breaks it
- [reference/errors.md](./reference/errors.md) and [reference/logs.md](./reference/logs.md) — when it does not work
