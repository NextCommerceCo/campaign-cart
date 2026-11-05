---
title: 'Billing address'
group: 'Attribute Reference/Checkout'
order: 505
---

# Billing address

A same-as-shipping checkbox and a billing section. While the box is ticked the billing section is
hidden, the order says the billing address is the shipping one, and billing fields are not checked.

```html
<label><input type="checkbox" name="use_shipping_address" checked /> Billing address same as shipping</label>

<div data-next-component="different-billing-address">
  <div data-next-component="billing-form"></div>
</div>
```

## Attributes

| Attribute                                         | Means                                                                                  |
| ------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `input[name="use_shipping_address"]`              | Ticked: billing is the shipping address. The shopper's choice is kept in this tab      |
| `data-next-component="different-billing-address"` | Shown while the box is unticked                                                        |
| `data-next-component="billing-form"`              | Where the billing fields go. Left empty, the SDK copies the shipping rows into it      |
| `data-next-component="shipping-form"`             | Where the shipping rows are copied from (the whole form without it)                    |
| `data-next-component="shipping-field-row"`        | A shipping row to copy                                                                 |
| `data-next-checkout-field="billing-<field>"`      | A billing field written by the page                                                    |
| `<div data-next-address="billing">`               | A billing address drawn for its country. See [data-next-address](data-next-address.md) |

Copied rows are `shipping-field-row` and `location` rows, except the one with the email. Each copy
loses its headings, and its fields are renamed `billing-<field>`, with `name` and `id` prefixed
`billing_` and the values cleared. A copied `location` row becomes `billing-location`.

Billing fields are checked on the final submit, the way the shipping ones are; a multi-step step
checks only the shipping address.

## Set by the SDK

| On                                                  | Set                                                                                          |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `[data-next-component="different-billing-address"]` | `display: none` and `billing-form-collapsed` while ticked; `billing-form-expanded` otherwise |
| Copied rows                                         | `data-next-component="billing-field-row"` / `"billing-location"`                             |

## 0.4.x

`os-checkout-element` and `os-checkout-component` are read in place of `data-next-component`.

## Events

[address.entered](/event-reference/checkout/address.entered) and
[address.updated](/event-reference/checkout/address.updated) carry `type: 'billing'` for this
address.
