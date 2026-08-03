---
title: "Features/Display/Quantity Text/Get Started"
group: "Features"
category: "Quantity Text"
---

# Get Started

<!-- Generated from the feature manifest and its e2e fixture. Do not edit by
     hand: edit <feature>.manifest.ts or the fixture, then run
     `npm run docs:reference`. -->

Turning on `quantity-text` on a page that already loads the SDK.

## Prerequisites

- The SDK is loaded and the page has an API key in its `<head>`:
  ```html
  <meta name="next-api-key" content="{YOUR_CAMPAIGN_API_KEY}">
  ```
- [`display-core`](../../../display/display-core/guide/overview.md) is on the page — it resolves its package from the same ancestor `data-next-package-id` context that display bindings use.

## Turn it on

Put `data-next-quantity-text` on the element. Nothing registers the feature in JavaScript — the attribute in your markup is the whole wiring step, matched by `[data-next-quantity-text]`.

These attributes are required:

| Attribute | Type | What it does |
|---|---|---|
| `data-next-quantity-text` | `string (template)` | The sentence to render, with `{qty}` where the number belongs. |

Everything else is optional — see [attributes.md](./reference/attributes.md).

### Text that reflows with the quantity

```html
<!--
  Template combines all three substitution forms:
  {qty} -> quantity, {qty*3} -> quantity x3, {item|items} -> singular/plural.
  Default quantity is 1 with no upsell control, so this renders statically.
-->
<div data-next-package-id="2">
  <span id="qty-text" data-next-quantity-text="{qty} {item|items}, get {qty*3}"
    >placeholder</span
  >
</div>
```

This is the markup `e2e/fixtures/quantity-text.html` uses, so it is known to work against the current SDK. See [tested-example.md](./reference/tested-example.md).

## Check it worked

- With `?debug=true` on the URL, the console shows `QuantityTextEnhancer initialized` under `QuantityTextEnhancer`. No line means the feature never activated — check the activating attribute is spelled exactly as above.

## Next steps

- [overview.md](./overview.md) — what it does and why it is built this way
- [reference/attributes.md](./reference/attributes.md) — every attribute
- [relations.md](./relations.md) — what it needs, and what breaks it
- [reference/errors.md](./reference/errors.md) and [reference/logs.md](./reference/logs.md) — when it does not work
