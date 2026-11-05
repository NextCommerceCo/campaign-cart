---
title: 'data-next-checkout-field'
group: 'Attribute Reference/Checkout'
order: 502
---

# data-next-checkout-field

Names an input, select or textarea of the checkout form. The SDK reads it as the shopper types,
checks it when they leave it, restores it from this tab on a reload, and sends it with the order.

```html
<input data-next-checkout-field="email" type="email" />
<input data-next-checkout-field="first_name" />
<select data-next-checkout-field="country"></select>
<input data-next-checkout-field="phone_number" type="tel" data-next-required="true" />
<input data-next-checkout-field="accepts_marketing" type="checkbox" checked />
```

## Attributes

| Field                                       | Means                                                                                                                                           |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `email`                                     | Required, and checked as an email address                                                                                                       |
| `first_name`, `last_name`                   | Required                                                                                                                                        |
| `country`                                   | Required. A `<select>` is filled with the campaign's shipping countries                                                                         |
| `line1`                                     | Required                                                                                                                                        |
| `line2`                                     | Optional                                                                                                                                        |
| `city`, `state`, `postcode`                 | Required where the country's rules ask for them (only `city` before they load). See [data-next-address](data-next-address.md)                   |
| `phone_number`                              | Optional, unless it has `required` or `data-next-required="true"`. See [Phone field](phone-field.md)                                            |
| `accepts_marketing`                         | A checkbox. Unticked sends `accepts_marketing: false`; without the field it is `true`                                                           |
| `billing-<field>`                           | The same field for the billing address, for example `billing-line1` (`billing_line1` reads the same). See [Billing address](billing-address.md) |
| `cc-number`, `cvv`, `exp-month`, `exp-year` | Card fields. See [Payment methods](payment-methods.md)                                                                                          |

When two controls have the same name, the first one in the form is used. A checkbox reads as
`true` or `false`.

## Set by the SDK

| On                | Set                                                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------------------ |
| The control       | `has-error`, `next-error-field` and `aria-invalid="true"` while it has an error; `no-error` once it was left valid |
| Its wrapper       | `addErrorIcon` with an error, `addTick` when valid                                                                 |
| Its `.form-group` | `div.next-error-label[data-next-error-for="<field>"]` with the message                                             |

The wrapper is the closest `.form-group`, `.frm-flds`, `.form-input`, `.select-form-wrapper`,
`.field-wrapper`, `.input-wrapper` or `.form-field`. See [Error messages](error-messages.md).

## 0.4.x

| 0.4.x                         | Now                                 |
| ----------------------------- | ----------------------------------- |
| `os-checkout-field`           | `data-next-checkout-field`          |
| `fname`, `lname`              | `first_name`, `last_name`           |
| `address1`, `address2`        | `line1`, `line2`                    |
| `province`, `postal`, `phone` | `state`, `postcode`, `phone_number` |
| `cc-month`, `cc-year`         | `exp-month`, `exp-year`             |

## Events

[address.entered](/event-reference/checkout/address.entered) and
[address.updated](/event-reference/checkout/address.updated) once an address is complete or changes.
