---
title: "Features/Cart/Coupon/Get Started"
group: "Features"
category: "Coupon"
---

# Get Started

<!-- Generated from the feature manifest and its e2e fixture. Do not edit by
     hand: edit <feature>.manifest.ts or the fixture, then run
     `npm run docs:reference`. -->

Turning on `coupon` on a page that already loads the SDK.

## Prerequisites

- The SDK is loaded and the page has an API key in its `<head>`:
  ```html
  <meta name="next-api-key" content="{YOUR_CAMPAIGN_API_KEY}">
  ```
- `cartStore` — a coupon applies to a cart, so the field reads and writes cart state. With an empty cart the API rejects the code.

## Turn it on

Put `data-next-coupon` on the element. Nothing registers the feature in JavaScript — the attribute in your markup is the whole wiring step, matched by `[data-next-coupon=""]`.

These attributes are required:

| Attribute | Type | What it does |
|---|---|---|
| `data-next-coupon` | `string` | Marks the coupon area. |

Everything else is optional — see [attributes.md](./reference/attributes.md).

### A coupon input with an apply button

```html
<button data-next-action="add-to-cart" data-next-package-id="1">
  Add to cart
</button>

<div data-next-coupon="input">
  <input type="text" data-next-coupon="input" placeholder="Coupon code" />
  <button data-next-coupon="apply">Apply</button>
</div>
```

This is the markup `e2e/fixtures/coupon.html` uses, so it is known to work against the current SDK. See [tested-example.md](./reference/tested-example.md).

## Check it worked

- With `?debug=true` on the URL, the console shows `Coupon enhancer initialized successfully` under `CouponEnhancer`. No line means the feature never activated — check the activating attribute is spelled exactly as above.
- It emits `coupon:applied`, `coupon:removed`, `coupon:validation-failed`. Listen for one to confirm it is running:
  ```js
  window.nextReady.push(() => {
    next.on('coupon:applied', payload => console.log(payload));
  });
  ```
- It sets `next-disabled`: on the apply button while a code is being validated, so the visitor cannot submit twice. Watch that class in the element inspector — it is the quickest check that state is tracking.

## Next steps

- [overview.md](./overview.md) — what it does and why it is built this way
- [reference/attributes.md](./reference/attributes.md) — every attribute
- [reference/events.md](./reference/events.md) — payloads you can hook
- [relations.md](./relations.md) — what it needs, and what breaks it
- [reference/errors.md](./reference/errors.md) and [reference/logs.md](./reference/logs.md) — when it does not work
