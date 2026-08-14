---
title: "Features/Checkout/Express Checkout Container/Attributes"
group: "Features"
category: "Express Checkout Container"
---

# Attributes

<!-- Generated from the feature manifest. Do not edit by hand:
     edit <feature>.manifest.ts, then run `npm run docs:reference`. -->

Renders the express payment buttons — PayPal, Apple Pay, Google Pay, Link — for whichever of them the campaign and device support.

Turned on by `[data-next-express-checkout="container"]`.

## `data-next-express-checkout`

| | |
|---|---|
| Type | `string` |
| Required | yes |
| Default | — |

Marks the container and, on a child, the element buttons are injected into. You supply the container; the SDK supplies the buttons, because which ones are available depends on the campaign and on the visitor's device.

**Valid values:**

- `container` — The outer element the feature activates on.
- `buttons` — The child element buttons are rendered into.

> **Watch out:** With no `"buttons"` child the feature logs `No buttons container found with data-next-express-checkout="buttons"` and renders nothing — the usual reason an express section stays empty.

## Set by the feature

Written to the element as state changes. Read these from CSS or tests instead of inferring state from the rendered text.

| Name | Values | Meaning |
|---|---|---|
| `data-next-express-checkout` | `paypal`, `apple_pay`, `google_pay`, `link` | On each generated button: which method it is (`paypal`, `apple_pay`, `google_pay`, `link`). Style individual methods from this. |
| `data-action` | `submit` | Set to `submit` on each generated button. |

## Example

```html
<div data-next-express-checkout="container">
  <p>Express checkout</p>
  <div data-next-express-checkout="buttons"></div>
</div>
```

`express-checkout:initialized` fires **once per available method**, so a page
offering all four sees it four times. Use it to reveal the section only when at
least one button actually rendered — Apple Pay is absent on non-Apple devices, and
an empty "Express checkout" heading looks broken.

`express-checkout:started`, `:completed` and `:failed` all fire from the click,
and `payment:error` fires alongside them, covering express and standard checkout
alike.

**None of them means the shopper paid.** An express order is created *before* the
payment: it comes back with a `payment_complete_url`, the SDK sends the shopper
to PayPal with it, and they can still cancel or press back. Hang conversion
tracking on `order:completed`, which fires on the success page for the order
fetched back from the API — that is where the SDK's own `dl_purchase` comes from
([issue #71](https://github.com/NextCommerceCo/campaign-cart/issues/71)).
