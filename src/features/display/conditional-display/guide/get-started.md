---
title: "Features/Display/Conditional Display/Get Started"
group: "Features"
category: "Conditional Display"
---

# Get Started

<!-- Generated from the feature manifest and its e2e fixture. Do not edit by
     hand: edit <feature>.manifest.ts or the fixture, then run
     `npm run docs:reference`. -->

Turning on `conditional-display` on a page that already loads the SDK.

## Prerequisites

- The SDK is loaded and the page has an API key in its `<head>`:
  ```html
  <meta name="next-api-key" content="{YOUR_CAMPAIGN_API_KEY}">
  ```
- [`display-core`](../../../display/display-core/guide/overview.md) is on the page — conditions are written over the same namespaces as `data-next-display`, so what you can show is what you can test.

## Turn it on

Put `data-next-show` on the element. Nothing registers the feature in JavaScript — the attribute in your markup is the whole wiring step, matched by `[data-next-show]`. It is also registered against `[data-next-hide]`.

### Showing one element while the cart has items, and another while it is empty

```html
<button data-next-action="add-to-cart" data-next-package-id="1">
  Add to cart
</button>

<!-- Shown only when the cart has items. -->
<div id="show-when-items" data-next-show="cart.hasItems">Cart has items</div>

<!-- Hidden when the cart has items (i.e. shown while empty). -->
<div id="hide-when-items" data-next-hide="cart.hasItems">Your cart is empty</div>
```

This is the markup `e2e/fixtures/conditional-display.html` uses, so it is known to work against the current SDK. See [tested-example.md](./reference/tested-example.md).

## Check it worked

- With `?debug=true` on the URL, look for `ConditionalDisplayEnhancer` lines in the console. None at all means the feature never activated.

## Next steps

- [overview.md](./overview.md) — what it does and why it is built this way
- [reference/attributes.md](./reference/attributes.md) — every attribute
- [relations.md](./relations.md) — what it needs, and what breaks it
- [reference/errors.md](./reference/errors.md) and [reference/logs.md](./reference/logs.md) — when it does not work
