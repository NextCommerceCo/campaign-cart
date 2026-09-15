---
title: "Features/Checkout/Address Form/Get Started"
group: "Features"
category: "Address Form"
---

# Get Started

<!-- Generated from the feature manifest and its e2e fixture. Do not edit by
     hand: edit <feature>.manifest.ts or the fixture, then run
     `npm run docs:reference`. -->

Turning on `address-form` on a page that already loads the SDK.

## Prerequisites

- The SDK is loaded and the page has an API key in its `<head>`:
  ```html
  <meta name="next-api-key" content="{YOUR_CAMPAIGN_API_KEY}">
  ```
- [`checkout-form`](../../../checkout/checkout-form/guide/overview.md) is on the page — the fields it builds carry `data-next-checkout-field`, and the checkout form is what reads them into the order, fills the country and province dropdowns, and validates them. On a page with no checkout form the fields render and collect nothing.

## Turn it on

Put `data-next-address` on the element. Nothing registers the feature in JavaScript — the attribute in your markup is the whole wiring step, matched by `[data-next-address]`.

These attributes are required:

| Attribute | Type | What it does |
|---|---|---|
| `data-next-address` | `'shipping' \| 'billing'` | Turns an empty container into an address block and says which address it collects. |

Everything else is optional — see [attributes.md](./reference/attributes.md).

### A country-driven address block

```html
<!-- The container is empty: the SDK builds the fields a country collects, in
     the order that country writes them. Everything else on the form is
     ordinary checkout markup. -->
<form data-next-checkout>
  <div class="form-group">
    <label for="fname">First name</label>
    <input type="text" id="fname" data-next-checkout-field="fname" />
  </div>
  <div class="form-group">
    <label for="lname">Last name</label>
    <input type="text" id="lname" data-next-checkout-field="lname" />
  </div>
  <div class="form-group">
    <label for="email">Email</label>
    <input
      type="text"
      id="email"
      data-next-checkout-field="email"
      name="email"
    />
  </div>

  <div data-next-address="shipping"></div>

  <button type="submit">Place order</button>
</form>
```

This is the markup `e2e/fixtures/address-form.html` uses, so it is known to work against the current SDK. See [tested-example.md](./reference/tested-example.md).

## Check it worked

- With `?debug=true` on the URL, look for `AddressFormEnhancer` lines in the console. None at all means the feature never activated.
- It emits `address:fields-rendered`. Listen for one to confirm it is running:
  ```js
  window.nextReady.push(() => {
    next.on('address:fields-rendered', payload => console.log(payload));
  });
  ```

## Next steps

- [overview.md](./overview.md) — what it does and why it is built this way
- [reference/attributes.md](./reference/attributes.md) — every attribute
- [reference/events.md](./reference/events.md) — payloads you can hook
- [relations.md](./relations.md) — what it needs, and what breaks it
- [reference/errors.md](./reference/errors.md) and [reference/logs.md](./reference/logs.md) — when it does not work
