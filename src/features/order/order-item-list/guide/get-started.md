---
title: "Features/Order/Order Item List/Get Started"
group: "Features"
category: "Order Item List"
---

# Get Started

<!-- Generated from the feature manifest and its e2e fixture. Do not edit by
     hand: edit <feature>.manifest.ts or the fixture, then run
     `npm run docs:reference`. -->

Turning on `order-item-list` on a page that already loads the SDK.

## Prerequisites

- The SDK is loaded and the page has an API key in its `<head>`:
  ```html
  <meta name="next-api-key" content="{YOUR_CAMPAIGN_API_KEY}">
  ```
- `orderStore` — it renders the lines of a loaded order, which needs the `?ref_id` the order page is opened with.

## Turn it on

Put `data-next-order-items` on the element. Nothing registers the feature in JavaScript — the attribute in your markup is the whole wiring step, matched by `[data-next-order-items]`.

These attributes are required:

| Attribute | Type | What it does |
|---|---|---|
| `data-next-order-items` | `boolean (presence)` | Marks the element as the order line list. |

Everything else is optional — see [attributes.md](./reference/attributes.md).

### Order lines using the built-in row template

```html
<!-- Loaded with ?ref_id=test-order-ref so the SDK auto-loads the order.
     Left empty so the enhancer renders lines with its default template
     (.order-item / .order-item-name / .line-total). -->
<div data-next-order-items></div>
```

This is the markup `e2e/fixtures/order-item-list.html` uses, so it is known to work against the current SDK. See [tested-example.md](./reference/tested-example.md).

## Check it worked

- With `?debug=true` on the URL, the console shows `OrderItemListEnhancer initialized` under `OrderItemListEnhancer`. No line means the feature never activated — check the activating attribute is spelled exactly as above.
- It sets `order-loading`: the order is still being fetched. Show a skeleton from this rather than assuming rows exist on first paint. Watch that class in the element inspector — it is the quickest check that state is tracking.

## Next steps

- [overview.md](./overview.md) — what it does and why it is built this way
- [reference/attributes.md](./reference/attributes.md) — every attribute
- [relations.md](./relations.md) — what it needs, and what breaks it
- [reference/errors.md](./reference/errors.md) and [reference/logs.md](./reference/logs.md) — when it does not work
