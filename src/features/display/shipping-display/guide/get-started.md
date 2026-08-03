---
title: "Features/Display/Shipping Display/Get Started"
group: "Features"
category: "Shipping Display"
---

# Get Started

<!-- Generated from the feature manifest and its e2e fixture. Do not edit by
     hand: edit <feature>.manifest.ts or the fixture, then run
     `npm run docs:reference`. -->

Turning on `shipping-display` on a page that already loads the SDK.

## Prerequisites

- The SDK is loaded and the page has an API key in its `<head>`:
  ```html
  <meta name="next-api-key" content="{YOUR_CAMPAIGN_API_KEY}">
  ```
- `campaignStore` — shipping names and costs come from the campaign's shipping methods.

## Turn it on

Put `data-next-display` on the element. Nothing registers the feature in JavaScript — the attribute in your markup is the whole wiring step, matched by `[data-next-display]`.

These attributes are required:

| Attribute | Type | What it does |
|---|---|---|
| `data-next-shipping-id` | `number` | Which shipping method to describe. |

Everything else is optional — see [attributes.md](./reference/attributes.md).

### Two shipping methods, each showing its own values

```html
<!-- Standard shipping (ref_id 1, $5.99). -->
<div data-next-shipping-id="1">
  <span id="s1-cost" data-next-display="shipping.cost">?</span>
  <span id="s1-name" data-next-display="shipping.name">?</span>
  <span id="s1-free" data-next-display="shipping.isFree">?</span>
</div>

<!-- Free shipping (ref_id 2, $0.00). -->
<div data-next-shipping-id="2">
  <span id="s2-cost" data-next-display="shipping.cost">?</span>
  <span id="s2-name" data-next-display="shipping.name">?</span>
  <span id="s2-free" data-next-display="shipping.isFree">?</span>
</div>
```

This is the markup `e2e/fixtures/shipping-display.html` uses, so it is known to work against the current SDK. See [tested-example.md](./reference/tested-example.md).

## Check it worked

- With `?debug=true` on the URL, the console shows `ShippingDisplayEnhancer initialized with shipping ID {shippingId}` under `ShippingDisplayEnhancer`. No line means the feature never activated — check the activating attribute is spelled exactly as above.

## Next steps

- [overview.md](./overview.md) — what it does and why it is built this way
- [reference/attributes.md](./reference/attributes.md) — every attribute
- [relations.md](./relations.md) — what it needs, and what breaks it
- [reference/errors.md](./reference/errors.md) and [reference/logs.md](./reference/logs.md) — when it does not work
