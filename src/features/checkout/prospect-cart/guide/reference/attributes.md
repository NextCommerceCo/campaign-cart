---
title: "Features/Checkout/Prospect Cart/Attributes"
group: "Features"
category: "Prospect Cart"
---

# Attributes

<!-- Generated from the feature manifest. Do not edit by hand:
     edit <feature>.manifest.ts, then run `npm run docs:reference`. -->

Captures an abandoning visitor as a lead the moment they type an email or phone, before they finish paying.

Turned on by `form[data-next-checkout]`.

## `data-auto-create`

| | |
|---|---|
| Type | `'true' \| 'false'` |
| Required | no |
| Default | `true` |

Whether a prospect is created automatically when the trigger fires. Set `false` to keep the feature loaded but create prospects only from your own code.

> **Watch out:** Any value other than `"false"` counts as enabled.

---

## `data-trigger-on`

| | |
|---|---|
| Type | `string` |
| Required | no |
| Default | `emailEntry` |

What counts as enough intent to record a prospect. This is the main trade-off in the feature: earlier triggers catch more leads, later ones record fewer accidental ones.

**Valid values:**

- `formStart` — The visitor interacts with the form at all.
- `emailEntry` — A valid email has been entered.
- `phoneEntry` — A phone number long enough to be real has been entered.
- `emailAndPhone` — Both are present — fewest, best-quality leads.
- `manual` — Never automatic; you call it yourself.

> **Watch out:** An unrecognised value is ignored and the default stands.

---

## `data-email-field`

| | |
|---|---|
| Type | `string` |
| Required | no |
| Default | `email` |

Which checkout field holds the email, when the form names it something other than `email`.

---

## `data-phone-field`

| | |
|---|---|
| Type | `string` |
| Required | no |
| Default | `phone` |

Which checkout field holds the phone number.

---

## `data-min-phone-digits`

| | |
|---|---|
| Type | `number` |
| Required | no |
| Default | `7` |

How many digits a phone number needs before it counts as entered. Guards against recording a prospect from a half-typed number.

> **Watch out:** A non-numeric or non-positive value logs a warning and the default is used.

---

## `data-prospect-config`

| | |
|---|---|
| Type | `JSON string` |
| Required | no |
| Default | — |

All of the above at once, as JSON, plus the options that have no attribute of their own: `includeUtmData` (default `true`) and `sessionTimeout` in minutes (default `30`).

```html
data-prospect-config='{"triggerOn":"emailAndPhone","sessionTimeout":60}'
```

> **Watch out:** The individual attributes override matching keys in this JSON. Malformed JSON logs a warning and is ignored entirely — including the parts that were valid.

## How it is turned on

There is no attribute of its own: the checkout form starts this feature, and its
options go on the same `<form>`.

```html
<form data-next-checkout
      data-trigger-on="emailEntry"
      data-min-phone-digits="9">
  <input data-next-checkout-field="email" type="email">
  <input data-next-checkout-field="phone" type="tel">
</form>
```

The email and phone inputs are found through their
`data-next-checkout-field` names — see
[checkout-form](../../../../checkout/checkout-form/guide/reference/attributes.md). Legacy
`os-checkout-field` names and plain `name="phone"` / `type="tel"` inputs are
accepted as fallbacks, so existing forms usually work unchanged.

## Cautions

- A prospect is recorded **before the visitor agrees to buy anything**. Whether
  that counts as consent to contact them depends on your jurisdiction and on what
  your form says — check before choosing an early trigger.
- `formStart` fires on any interaction, so it records visitors who typed one
  character and left. Prefer `emailEntry` unless you have a reason.
