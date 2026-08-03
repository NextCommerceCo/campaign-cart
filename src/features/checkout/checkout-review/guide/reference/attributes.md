---
title: "Features/Checkout/Checkout Review/Attributes"
group: "Features"
category: "Checkout Review"
---

# Attributes

<!-- Generated from the feature manifest. Do not edit by hand:
     edit <feature>.manifest.ts, then run `npm run docs:reference`. -->

Plays back what the visitor entered — address, contact, payment method — so they can check it before paying.

Turned on by `[data-next-enhancer]`.

## `data-next-enhancer`

| | |
|---|---|
| Type | `'checkout-review'` |
| Required | yes |
| Default | — |

Turns the element into a review block. This is the generic activation attribute — its value names the enhancer to attach, so it is not specific to review and an unrecognised value attaches nothing.

**Valid values:**

- `checkout-review` — Attaches the review enhancer to this element.

> **Watch out:** A typo in the value fails silently: the scanner logs `Unknown enhancer type: <value>` and the block stays empty.

---

## `data-next-checkout-review`

| | |
|---|---|
| Type | `string (field name)` |
| Required | yes |
| Default | — |

Marks an element as a review slot and names the checkout field to show in it. The value is read back from the form as the visitor types, so the review stays correct without a page step.

---

## `data-next-format`

| | |
|---|---|
| Type | `string` |
| Required | no |
| Default | `text` |

How to render the value — for example formatting a phone number or a card expiry rather than echoing the raw input.

---

## `data-next-fallback`

| | |
|---|---|
| Type | `string` |
| Required | no |
| Default | `(empty)` |

What to show while the field is still blank. Without one an unfilled field renders as nothing, which reads as a broken layout rather than an empty value.

## Example

The review container is turned on with `data-next-enhancer="checkout-review"`;
each slot inside names its field:

```html
<div data-next-enhancer="checkout-review">
  <p data-next-checkout-review="email" data-next-fallback="No email yet"></p>
  <p data-next-checkout-review="shipping-address"></p>
  <p data-next-checkout-review="phone" data-next-format="phone"></p>
</div>
```

Field names match the `data-next-checkout-field` values on the form — see
[checkout-form](../../../../checkout/checkout-form/guide/reference/attributes.md). A name with
no matching field renders the fallback forever, which is the usual reason a review
row stays stuck on its placeholder.
