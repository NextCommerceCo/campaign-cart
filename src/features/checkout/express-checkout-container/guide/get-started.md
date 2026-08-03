---
title: "Features/Checkout/Express Checkout Container/Get Started"
group: "Features"
category: "Express Checkout Container"
---

# Get Started

<!-- Generated from the feature manifest and its e2e fixture. Do not edit by
     hand: edit <feature>.manifest.ts or the fixture, then run
     `npm run docs:reference`. -->

Turning on `express-checkout-container` on a page that already loads the SDK.

## Prerequisites

- The SDK is loaded and the page has an API key in its `<head>`:
  ```html
  <meta name="next-api-key" content="{YOUR_CAMPAIGN_API_KEY}">
  ```
- `cartStore` — the wallet buttons create an order from the current cart, so an empty cart makes them fail rather than being hidden.

## Turn it on

Put `data-next-express-checkout` on the element. Nothing registers the feature in JavaScript — the attribute in your markup is the whole wiring step, matched by `[data-next-express-checkout="container"]`.

These attributes are required:

| Attribute | Type | What it does |
|---|---|---|
| `data-next-express-checkout` | `string` | Marks the container and, on a child, the element buttons are injected into. |

Everything else is optional — see [attributes.md](./reference/attributes.md).

### A container the SDK fills with express-payment buttons

```html
<!-- The container injects express-payment buttons into the [buttons] child
     based on the campaign's available_express_payment_methods. -->
<div data-next-express-checkout="container">
  <div data-next-express-checkout="buttons"></div>
</div>
```

This is the markup `e2e/fixtures/express-checkout-container.html` uses, so it is known to work against the current SDK. See [tested-example.md](./reference/tested-example.md).

## Check it worked

- With `?debug=true` on the URL, the console shows `ExpressCheckoutContainerEnhancer initialized` under `ExpressCheckoutContainerEnhancer`. No line means the feature never activated — check the activating attribute is spelled exactly as above.
- It emits `express-checkout:initialized`. Listen for one to confirm it is running:
  ```js
  window.nextReady.push(() => {
    next.on('express-checkout:initialized', payload => console.log(payload));
  });
  ```

## Next steps

- [overview.md](./overview.md) — what it does and why it is built this way
- [reference/attributes.md](./reference/attributes.md) — every attribute
- [reference/events.md](./reference/events.md) — payloads you can hook
- [relations.md](./relations.md) — what it needs, and what breaks it
- [reference/errors.md](./reference/errors.md) and [reference/logs.md](./reference/logs.md) — when it does not work
