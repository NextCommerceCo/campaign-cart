---
title: "Features/Checkout/Express Checkout Container/Attributes"
group: "Features"
category: "Express Checkout Container"
---

# Attributes

<!-- Generated from the feature manifest. Do not edit by hand:
     edit <feature>.manifest.ts, then run `npm run docs:reference`. -->

Renders the express payment buttons — PayPal, Apple Pay, Google Pay — for whichever of them the campaign and device support.

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
| `data-next-express-checkout` | `paypal`, `apple_pay`, `google_pay` | On each generated button: which method it is (`paypal`, `apple_pay`, `google_pay`). Style individual methods from this. |
| `data-action` | `submit` | Set to `submit` on each generated button. |

## Example

```html
<div data-next-express-checkout="container">
  <p>Express checkout</p>
  <div data-next-express-checkout="buttons"></div>
</div>
```

`express-checkout:initialized` fires **once per available method**, so a page
offering all three sees it three times. Use it to reveal the section only when at
least one button actually rendered — Apple Pay is absent on non-Apple devices, and
an empty "Express checkout" heading looks broken.

Completion and failure do **not** have express-specific events in this build:
listen for `order:completed` and `payment:error`, which cover express and
standard checkout alike. The `express-checkout:completed` / `:failed` names
exist on `EventMap` but are never emitted — they are marked deprecated there.
